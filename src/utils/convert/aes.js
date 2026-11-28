/**
 * AES 加解密（R2.5）—— WebCrypto 实现，零依赖
 * · CBC（默认，PKCS#7 填充，与 OpenSSL enc -aes-<bits>-cbc 互操作）/ GCM（推荐，认证标签拼接在密文尾部）
 * · IV：CBC 16 字节、GCM 12 字节，自动生成并随密文分栏返回；解密支持粘贴 Hex / Base64
 * · 密钥：128 / 192 / 256 位，Hex / Base64 输入；crypto.getRandomValues 生成
 * · 异步纯函数：不依赖 DOM 与 uTools API；Node ≥20 的 vitest 环境可直接单测
 *   （node:crypto 同为 OpenSSL 后端，测试中互验即等价于 OpenSSL 互验）
 */

const ALGO = { CBC: 'AES-CBC', GCM: 'AES-GCM' }
const IV_LEN = { CBC: 16, GCM: 12 }
const KEY_LEN = [16, 24, 32] // 128 / 192 / 256 位

export const MODES = [
  { id: 'CBC', label: 'CBC', hint: '默认 · PKCS#7 填充' },
  { id: 'GCM', label: 'GCM', hint: '推荐 · 带认证标签' },
]

export const KEY_BITS = [128, 192, 256]

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const s = String(hex ?? '').replace(/[\s,]/g, '')
  if (!s) return { ok: false, error: '没有可解析的内容' }
  if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 !== 0) {
    return { ok: false, error: 'Hex 格式不正确：仅支持 0–9 / A–F，且长度为偶数' }
  }
  const bytes = new Uint8Array(s.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return { ok: true, bytes }
}

function b64ToBytes(b64) {
  try {
    const bin = atob(String(b64 ?? '').replace(/\s+/g, ''))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { ok: true, bytes }
  } catch (e) {
    return { ok: false, error: 'Base64 格式不正确：包含非法字符或长度不为 4 的倍数' }
  }
}

function parseBytes(str, format, what) {
  const r = format === 'hex' ? hexToBytes(str) : b64ToBytes(str)
  return r.ok ? r : { ok: false, error: `${what}：${r.error}` }
}

/** 生成随机密钥（crypto.getRandomValues），format: 'hex' | 'base64' | 'raw'（raw 返回 Uint8Array） */
export function generateAesKey(bits = 256, format = 'hex') {
  const len = KEY_LEN.includes(Math.round(bits / 8)) ? Math.round(bits / 8) : 32
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return {
    ok: true,
    key: format === 'raw' ? bytes : aesKeyToString(bytes, format),
    bits: len * 8,
    bytes: format === 'raw' ? bytes : undefined,
  }
}

/** 密钥字节 → 字符串（'hex' | 'base64'） */
export function aesKeyToString(bytes, format = 'hex') {
  return format === 'base64' ? btoa(String.fromCharCode(...bytes)) : bytesToHex(bytes)
}

/** 生成随机 IV（CBC 16B / GCM 12B），format: 'hex' | 'base64' */
export function generateAesIv(mode, format = 'hex') {
  const len = IV_LEN[mode] || 16
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return { ok: true, iv: format === 'base64' ? btoa(String.fromCharCode(...bytes)) : bytesToHex(bytes), bytes }
}

/**
 * AES 加密
 * @param {object} p
 * @param {string} p.key 密钥文本（Hex 或 Base64，按 keyFormat）
 * @param {'hex'|'base64'} [p.keyFormat]
 * @param {'CBC'|'GCM'} [p.mode]
 * @param {string} p.plaintext 明文（UTF-8）
 * @param {'base64'|'hex'} [p.output] 密文与 IV 的输出格式
 * @param {string} [p.iv] 可选固定 IV（Hex/Base64，按 output 同格式解析；测试与复现用，生产建议留空自动生成）
 * @returns {Promise<{ ok:true, iv:string, data:string, mode:string } | { ok:false, error:string }>}
 */
export async function aesEncrypt(p = {}) {
  const mode = ALGO[p.mode] ? p.mode : 'CBC'
  const output = p.output === 'hex' ? 'hex' : 'base64'
  const fmt = output // IV 与密文同格式输出

  const kr = parseBytes(p.key, p.keyFormat === 'base64' ? 'base64' : 'hex', '密钥')
  if (!kr.ok) return kr
  if (!KEY_LEN.includes(kr.bytes.length)) {
    return { ok: false, error: `密钥长度不合法：AES 支持 128 / 192 / 256 位，即 ${KEY_LEN.join(' / ')} 字节，当前 ${kr.bytes.length} 字节` }
  }
  let ivBytes
  if (p.iv) {
    const ir = parseBytes(p.iv, output, 'IV')
    if (!ir.ok) return ir
    if (ir.bytes.length !== IV_LEN[mode]) {
      return { ok: false, error: `IV 长度不合法：${mode} 模式需要 ${IV_LEN[mode]} 字节，当前 ${ir.bytes.length} 字节` }
    }
    ivBytes = ir.bytes
  } else {
    ivBytes = generateAesIv(mode, 'raw').bytes
  }

  try {
    const key = await crypto.subtle.importKey('raw', kr.bytes, { name: ALGO[mode] }, false, ['encrypt'])
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt({ name: ALGO[mode], iv: ivBytes }, key, new TextEncoder().encode(String(p.plaintext ?? ''))),
    )
    const enc = (bytes) => (output === 'hex' ? bytesToHex(bytes) : btoa(String.fromCharCode(...bytes)))
    return { ok: true, iv: enc(ivBytes), data: enc(cipher), mode }
  } catch (e) {
    return { ok: false, error: '加密失败：输入包含无效字符（如孤立的代理字符）' }
  }
}

/**
 * AES 解密
 * @param {object} p
 * @param {string} p.key 密钥文本（Hex 或 Base64，按 keyFormat）
 * @param {'hex'|'base64'} [p.keyFormat]
 * @param {'CBC'|'GCM'} [p.mode]
 * @param {string} p.iv IV（Hex / Base64，按 inputFormat）
 * @param {string} p.cipher 密文（Hex / Base64，按 inputFormat）
 * @param {'base64'|'hex'} [p.inputFormat]
 * @returns {Promise<{ ok:true, data:string, mode:string } | { ok:false, error:string }>}
 */
export async function aesDecrypt(p = {}) {
  const mode = ALGO[p.mode] ? p.mode : 'CBC'
  const inputFormat = p.inputFormat === 'hex' ? 'hex' : 'base64'

  const kr = parseBytes(p.key, p.keyFormat === 'base64' ? 'base64' : 'hex', '密钥')
  if (!kr.ok) return kr
  if (!KEY_LEN.includes(kr.bytes.length)) {
    return { ok: false, error: `密钥长度不合法：AES 支持 128 / 192 / 256 位，即 ${KEY_LEN.join(' / ')} 字节，当前 ${kr.bytes.length} 字节` }
  }
  const ir = parseBytes(p.iv, inputFormat, 'IV')
  if (!ir.ok) return ir
  if (ir.bytes.length !== IV_LEN[mode]) {
    return { ok: false, error: `IV 长度不合法：${mode} 模式需要 ${IV_LEN[mode]} 字节，当前 ${ir.bytes.length} 字节` }
  }
  const cr = parseBytes(p.cipher, inputFormat, '密文')
  if (!cr.ok) return cr

  try {
    const key = await crypto.subtle.importKey('raw', kr.bytes, { name: ALGO[mode] }, false, ['decrypt'])
    const plain = await crypto.subtle.decrypt({ name: ALGO[mode], iv: ir.bytes }, key, cr.bytes)
    const text = new TextDecoder('utf-8', { fatal: true }).decode(plain)
    return { ok: true, data: text, mode }
  } catch (e) {
    if (mode === 'GCM') {
      return { ok: false, error: '解密失败：密文或密钥不匹配（GCM 认证校验未通过）' }
    }
    return { ok: false, error: '解密失败：密钥或 IV 不正确，或密文已损坏' }
  }
}
