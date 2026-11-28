/**
 * 图片/文件 ↔ Base64（R1.5，反馈热度第一）
 * · MIME 推断表：按扩展名（png/jpg/jpeg/gif/webp/svg/bmp/ico，未知回退 application/octet-stream）
 * · 魔数嗅探：PNG / JPG / GIF / WEBP(RIFF) / BMP / ICO；SVG 按 <svg / <?xml 文本特征识别
 * · Data URL 构造与解析；分块 bytes ↔ Base64（规避 call stack 限制）
 * · 纯函数：不依赖 DOM 与 uTools API；Base64 严格校验复用 encoding.js
 */
import { parseB64 } from './encoding.js'

export const UNKNOWN_MIME = 'application/octet-stream'

/** 体积警告阈值：10 MB（PRD 4.3.2 / R1.5） */
export const SIZE_WARN_BYTES = 10 * 1024 * 1024

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

/** 可预览的图片 MIME 集合 */
export const IMAGE_MIMES = new Set(Object.values(MIME_BY_EXT))

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
}

/** 按扩展名推断 MIME；未知返回 null（调用方决定回退） */
export function mimeFromExt(filename) {
  const m = String(filename ?? '').match(/\.([a-z0-9]+)\s*$/i)
  return m ? MIME_BY_EXT[m[1].toLowerCase()] || null : null
}

/** MIME → 建议扩展名（另存为默认文件名用）；未知返回 bin */
export function extFromMime(mime) {
  return EXT_BY_MIME[mime] || 'bin'
}

/**
 * 魔数嗅探 MIME 类型
 * @param {Uint8Array} bytes
 * @returns {string|null} 未识别返回 null
 */
export function sniffMime(bytes) {
  const b = bytes || []
  const starts = (arr, off = 0) => {
    if (b.length < off + arr.length) return false
    return arr.every((v, i) => b[off + i] === v)
  }
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (starts([0x47, 0x49, 0x46, 0x38])) return 'image/gif' // GIF87a / GIF89a
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp' // RIFF….WEBP
  if (starts([0x42, 0x4d])) return 'image/bmp' // 'BM'
  if (starts([0x00, 0x00, 0x01, 0x00])) return 'image/x-icon'
  // SVG：文本特征（允许 BOM 与前导空白；只读前 512 字节）
  if (b.length >= 5) {
    const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, Math.min(b.length, 512))).trimStart()
    if (/^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) return 'image/svg+xml'
  }
  return null
}

/* ---------- Data URL ---------- */

export function buildDataUrl(mime, base64) {
  return `data:${mime || UNKNOWN_MIME};base64,${base64}`
}

const DATA_URL_RE = /^data:([^;,]+)(?:;charset=[^;,]*)?;base64,([\s\S]*)$/

/** 解析 Base64 风味 Data URL；非该形态返回 null */
export function parseDataUrl(text) {
  const m = String(text ?? '').trim().match(DATA_URL_RE)
  if (!m) return null
  return { mime: m[1], base64: m[2].replace(/\s+/g, '') }
}

/* ---------- 字节 ↔ Base64（分块） ---------- */

export function bytesToB64(bytes) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function b64ToBytes(base64) {
  const bin = atob(String(base64 ?? '').replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/* ---------- 解码方向统一入口 ---------- */

/**
 * 解析解码输入（Data URL 或裸 Base64）
 * · Data URL：直接取 MIME 与载荷
 * · 裸 Base64：严格校验后按魔数嗅探 MIME
 * @returns {{ ok:true, mime:string, known:boolean, bytes:Uint8Array, base64:string, source:'dataurl'|'sniff', byteLen:number }
 *          | { ok:false, empty?:boolean, error?:string }}
 */
export function analyzeDecodeInput(text) {
  const s = String(text ?? '').trim()
  if (!s) return { ok: false, empty: true }
  const du = parseDataUrl(s)
  let mime = null
  let base64 = ''
  let source = 'sniff'
  if (du) {
    mime = du.mime
    base64 = du.base64
    source = 'dataurl'
  } else {
    base64 = s.replace(/\s+/g, '')
  }
  const r = parseB64(base64)
  if (!r.ok) {
    // Data URL 但非 base64 风味（URL 编码形态）时给出更贴切的提示
    if (du && !/;base64,/i.test(s)) return { ok: false, error: '不支持非 Base64 风味的 Data URL（URL 编码形态请先转 Base64）' }
    return r
  }
  const bytes = r.bytes
  if (source === 'sniff') mime = sniffMime(bytes)
  return {
    ok: true,
    mime: mime || UNKNOWN_MIME,
    known: !!mime,
    bytes,
    base64,
    source,
    byteLen: bytes.length,
  }
}

/* ---------- 展示辅助 ---------- */

/** 字节数人性化展示：0 → 0 B；512 → 512 B；1536 → 1.5 KB；1048576 → 1.0 MB */
export function formatBytes(n) {
  let v = Number(n) || 0
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}
