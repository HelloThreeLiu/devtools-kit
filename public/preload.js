/**
 * DevTools Kit · preload 桥接层
 * 规范（docs/技术设计.md §7）：CommonJS；window.services 统一命名空间；
 * 最小暴露原则——仅暴露「业务动作」，禁止透传 fs/path/child_process 等原始对象。
 */
const {
  createHash,
  generateKeyPairSync,
  createPublicKey,
  publicEncrypt,
  privateDecrypt,
  createSign,
  createVerify,
  constants,
} = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const ALGOS = ['md5', 'sha1', 'sha256', 'sha512']

/* ---------- RSA（R2.8，最小暴露：仅业务动作，密钥/数据均以 PEM / Base64 字符串进出） ---------- */

const RSA_PADDINGS = {
  oaep: constants.RSA_PKCS1_OAEP_PADDING,
  pkcs1: constants.RSA_PKCS1_PADDING,
}
const RSA_HASHES = ['sha1', 'sha256']

function rsaWrap(fn) {
  try {
    return fn()
  } catch (e) {
    const msg = String(e?.message || '')
    // 明文超长是最高频失败场景（OAEP-SHA256/2048 单块上限 190 字节），必须与密钥错误区分开（W4 审查 I-1）
    if (/data too large|too long/i.test(msg)) {
      throw new Error('明文超长：超出当前密钥的单块加密上限（OAEP-SHA256 / RSA-2048 约为 190 字节），请缩短明文、改用 4096 位密钥，或改用 AES 加密')
    }
    throw new Error('RSA 操作失败：密钥格式不正确，或密文 / 填充方式与密钥不匹配')
  }
}

/**
 * 生成 RSA 密钥对（2048/4096；4096 耗时秒级，UI 需先显示 loading 再调用）
 * @returns {{ publicKey: string, privateKey: string }} SPKI PEM / PKCS#8 PEM
 */
function rsaGenerateKeyPair(bits) {
  const modulusLength = Number(bits) === 4096 ? 4096 : 2048
  return rsaWrap(() => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    return { publicKey, privateKey }
  })
}

/** 基于私钥导出公钥（等价 openssl rsa -pubout） */
function rsaExtractPublic(privatePem) {
  return rsaWrap(() => createPublicKey(String(privatePem)).export({ type: 'spki', format: 'pem' }).toString())
}

/** 公钥加密（OAEP-SHA256 默认 / PKCS#1 v1.5 可选）→ Base64 */
function rsaPublicEncryptDo(publicPem, dataB64, padding) {
  return publicEncrypt(
    {
      key: String(publicPem),
      padding: RSA_PADDINGS[padding] || constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(String(dataB64 || ''), 'base64'),
  ).toString('base64')
}

/** 私钥解密（对应加密填充）→ Base64（UTF-8 解码由 UI 负责） */
function rsaPrivateDecryptDo(privatePem, cipherB64, padding) {
  return privateDecrypt(
    {
      key: String(privatePem),
      padding: RSA_PADDINGS[padding] || constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(String(cipherB64 || ''), 'base64'),
  ).toString('base64')
}

/** 私钥签名（SHA-256 / SHA-1，PKCS#1 v1.5）→ Base64；data 为 UTF-8 文本 */
function rsaSignDo(privatePem, data, hash) {
  return createSign(hash).update(String(data ?? ''), 'utf-8').sign(String(privatePem)).toString('base64')
}

/** 公钥验签 → boolean */
function rsaVerifyDo(publicPem, data, sigB64, hash) {
  return createVerify(hash).update(String(data ?? ''), 'utf-8').verify(String(publicPem), String(sigB64 || ''), 'base64')
}

/* ---------- 历史记录文件（插件本地数据目录，不入同步库，官方《数据存储》规范） ---------- */

function historyFile() {
  return path.join(utools.getPluginLocalDataPath(), 'history.json')
}

function readHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(historyFile(), 'utf-8'))
    if (data && typeof data === 'object' && data.version === 1 && data.history) return data
  } catch (e) {
    /* 不存在或损坏 → 返回空结构 */
  }
  return { version: 1, history: {} }
}

function writeHistory(data) {
  const dir = utools.getPluginLocalDataPath()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(historyFile(), JSON.stringify(data), 'utf-8')
}

window.services = {
  /** 构建标记：preload 只在插件装载时执行一次，用于诊断「渲染进程新、preload 旧」的版本偏差 */
  __buildTag: 'v1.1.0-20261128',
  /**
   * 哈希计算（PRD 4.3.6）
   * @param {string} text
   * @param {'md5'|'sha1'|'sha256'|'sha512'} algo
   * @returns {string} 小写 hex
   */
  hash(text, algo) {
    if (!ALGOS.includes(algo)) throw new Error('不支持的算法: ' + algo)
    return createHash(algo).update(String(text ?? ''), 'utf-8').digest('hex')
  },

  /** 基于私钥导出公钥（等价 openssl rsa -pubout）——委托顶层实现，避免双份逻辑漂移（W4 审查 I-5） */
  rsaExtractPublic(privatePem) {
    return rsaExtractPublic(privatePem)
  },

  /**
   * 生成 RSA 密钥对（2048/4096；4096 耗时秒级，UI 需先显示 loading 再调用）
   * @returns {{ publicKey: string, privateKey: string }} SPKI PEM / PKCS#8 PEM
   */
  rsaGenerateKeyPair(bits) {
    return rsaGenerateKeyPair(bits)
  },

  /** 公钥加密（OAEP-SHA256 默认 / PKCS#1 v1.5 可选）→ Base64 */
  rsaPublicEncrypt(publicPem, dataB64, padding) {
    return rsaWrap(() => rsaPublicEncryptDo(publicPem, dataB64, padding))
  },

  /** 私钥解密（对应加密填充）→ Base64（UTF-8 解码由 UI 负责） */
  rsaPrivateDecrypt(privatePem, cipherB64, padding) {
    return rsaWrap(() => rsaPrivateDecryptDo(privatePem, cipherB64, padding))
  },

  /** 私钥签名（SHA-256 / SHA-1，PKCS#1 v1.5）→ Base64；data 为 UTF-8 文本 */
  rsaSign(privatePem, data, hash) {
    if (!RSA_HASHES.includes(hash)) throw new Error('不支持的哈希算法：' + hash + '（仅支持 SHA-256 / SHA-1）')
    return rsaWrap(() => rsaSignDo(privatePem, data, hash))
  },

  /** 公钥验签 → boolean */
  rsaVerify(publicPem, data, sigB64, hash) {
    if (!RSA_HASHES.includes(hash)) throw new Error('不支持的哈希算法：' + hash + '（仅支持 SHA-256 / SHA-1）')
    return rsaWrap(() => rsaVerifyDo(publicPem, data, sigB64, hash))
  },

  /** 读取全部历史：{ version, history: { toolId: [{ input, output, ts }] } } */
  historyRead() {
    return readHistory()
  },

  /** 全量覆盖写入（前端负责合并与裁剪） */
  historyWrite(data) {
    if (!data || typeof data !== 'object' || data.version !== 1) return false
    writeHistory(data)
    return true
  },

  /**
   * 保存文件（R1.5 另存为：前端经 utools.showSaveDialog 取得路径后落盘）
   * @param {string} filePath 绝对路径（来自宿主保存对话框）
   * @param {string} base64 文件内容的 Base64（不含 Data URL 前缀）
   * @returns {boolean}
   */
  saveFile(filePath, base64) {
    if (typeof filePath !== 'string' || !filePath) throw new Error('缺少保存路径')
    fs.writeFileSync(filePath, Buffer.from(String(base64 || ''), 'base64'))
    return true
  },
}
