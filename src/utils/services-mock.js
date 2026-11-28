/**
 * preload services 浏览器 mock（utils/utools.js 在非 uTools 环境启用）
 * 接口与 public/preload.js 一致：hash / historyRead / historyWrite
 * · SHA 系列：Web Crypto（Node ≥20 的 vitest 环境同样可用，正确性有单测保证）
 * · MD5：纯 JS 实现（src/utils/md5.js）
 * · 历史：localStorage 持久化（不可用则内存）
 */
import { md5Hex } from './md5.js'

const SHA_NAMES = { sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' }

/* ---------- RSA mock（WebCrypto）：与 preload 行为对齐（OAEP-SHA256 / PKCS#1 v1.5 / RSASSA-PKCS1-v1_5） ---------- */

const RSA_BITS = [2048, 4096]

function pemEncode(label, der) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)))
  const lines = b64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function pemDecode(pem, label) {
  const s = String(pem ?? '')
  const body = s.replace(new RegExp(`-----(BEGIN|END) ${label}-----`, 'g'), '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/=]+$/.test(body) || body.length < 100) throw new Error('PEM 格式不正确')
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
}

function rsaAlg(padding) {
  return padding === 'pkcs1' ? 'RSAES-PKCS1-v1_5' : 'RSA-OAEP'
}

/** 与 preload 的 rsaWrap 对齐：统一友好错误；PKCS#1 v1.5 需要内核支持（Node 的 WebCrypto 不含该算法） */
function rsaWrapAsync(promise, padding) {
  return promise.catch((e) => {
    if (padding === 'pkcs1' && (e?.name === 'NotSupportedError' || /Unrecognized algorithm/i.test(e?.message || ''))) {
      throw new Error('当前浏览器内核不支持 PKCS#1 v1.5（WebCrypto），请在 uTools 中使用')
    }
    throw new Error('RSA 操作失败：密钥格式不正确，或密文 / 填充方式与密钥不匹配')
  })
}

const memory = (() => {
  try {
    localStorage.setItem('__probe__', '1')
    localStorage.removeItem('__probe__')
    return localStorage
  } catch (e) {
    const m = new Map()
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    }
  }
})()

const HS_KEY = 'devtools-kit:history'

function readHistory() {
  try {
    const data = JSON.parse(memory.getItem(HS_KEY))
    if (data && typeof data === 'object' && data.version === 1 && data.history) return data
  } catch (e) {
    /* 首次/损坏 */
  }
  return { version: 1, history: {} }
}

export default {
  __mock: true,
  __buildTag: 'mock-browser',

  async hash(text, algo) {
    const t = String(text ?? '')
    if (algo === 'md5') return md5Hex(t)
    const name = SHA_NAMES[algo]
    if (!name) throw new Error('不支持的算法: ' + algo)
    const buf = await crypto.subtle.digest(name, new TextEncoder().encode(t))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  },

  historyRead() {
    return readHistory()
  },

  historyWrite(data) {
    if (!data || typeof data !== 'object' || data.version !== 1) return false
    memory.setItem(HS_KEY, JSON.stringify(data))
    return true
  },

  /** 另存为在浏览器调试模式不可用（UI 按环境隐藏入口），此处仅兜底 */
  saveFile() {
    throw new Error('浏览器调试模式不支持保存文件')
  },

  /* ---- RSA mock（WebCrypto）：行为与 preload 对齐 ---- */

  async rsaGenerateKeyPair(bits) {
    const modulusLength = RSA_BITS.includes(Number(bits)) ? Number(bits) : 2048
    const kp = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    )
    return {
      publicKey: pemEncode('PUBLIC KEY', await crypto.subtle.exportKey('spki', kp.publicKey)),
      privateKey: pemEncode('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', kp.privateKey)),
    }
  },

  /** WebCrypto 无法从 PKCS#8 直接派生 SPKI，浏览器调试模式不提供该操作 */
  async rsaExtractPublic() {
    throw new Error('浏览器调试模式不支持「私钥提取公钥」，请在 uTools 中使用')
  },

  async rsaPublicEncrypt(publicPem, dataB64, padding) {
    const alg = rsaAlg(padding)
    return rsaWrapAsync(
      (async () => {
        const key = await crypto.subtle.importKey(
          'spki',
          pemDecode(publicPem, 'PUBLIC KEY'),
          alg === 'RSA-OAEP' ? { name: alg, hash: 'SHA-256' } : { name: alg },
          false,
          ['encrypt'],
        )
        const plain = Uint8Array.from(atob(String(dataB64 || '')), (c) => c.charCodeAt(0))
        const cipher = await crypto.subtle.encrypt({ name: alg }, key, plain)
        return btoa(String.fromCharCode(...new Uint8Array(cipher)))
      })(),
      padding,
    )
  },

  async rsaPrivateDecrypt(privatePem, cipherB64, padding) {
    const alg = rsaAlg(padding)
    return rsaWrapAsync(
      (async () => {
        const key = await crypto.subtle.importKey(
          'pkcs8',
          pemDecode(privatePem, 'PRIVATE KEY'),
          alg === 'RSA-OAEP' ? { name: alg, hash: 'SHA-256' } : { name: alg },
          false,
          ['decrypt'],
        )
        const cipher = Uint8Array.from(atob(String(cipherB64 || '')), (c) => c.charCodeAt(0))
        const plain = await crypto.subtle.decrypt({ name: alg }, key, cipher)
        return btoa(String.fromCharCode(...new Uint8Array(plain)))
      })(),
      padding,
    )
  },

  async rsaSign(privatePem, data, hash) {
    const name = SHA_NAMES[hash] || 'SHA-256'
    return rsaWrapAsync(
      (async () => {
        const key = await crypto.subtle.importKey(
          'pkcs8',
          pemDecode(privatePem, 'PRIVATE KEY'),
          { name: 'RSASSA-PKCS1-v1_5', hash: name },
          false,
          ['sign'],
        )
        const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(String(data ?? '')))
        return btoa(String.fromCharCode(...new Uint8Array(sig)))
      })(),
    )
  },

  async rsaVerify(publicPem, data, sigB64, hash) {
    const name = SHA_NAMES[hash] || 'SHA-256'
    return rsaWrapAsync(
      (async () => {
        const key = await crypto.subtle.importKey(
          'spki',
          pemDecode(publicPem, 'PUBLIC KEY'),
          { name: 'RSASSA-PKCS1-v1_5', hash: name },
          false,
          ['verify'],
        )
        const sig = Uint8Array.from(atob(String(sigB64 || '')), (c) => c.charCodeAt(0))
        return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, new TextEncoder().encode(String(data ?? '')))
      })(),
    )
  },
}
