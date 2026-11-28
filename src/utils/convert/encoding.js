/**
 * 字符编码转换（R1.4；PRD 4.3.2 同族，SPIKE-1 结论落地）
 * · 四编码 × 编码/解码矩阵：GBK / UTF-8 / UTF-16 LE / UTF-16 BE
 * · 解码：TextDecoder（gbk/utf-8/utf-16le/utf-16be，fatal 严格校验，BOM 自动剥离）——零依赖
 * · GBK 编码：运行时构建逆向映射表（SPIKE-1 方案 d）——遍历 GBK 双字节区间，
 *   用 TextDecoder('gbk', fatal) 反解每个码位，惰性构建、模块级缓存（实测 8.8ms / 21,791 字符）
 * · UTF-16 编码：纯 JS 按码元直排（UTF-16 码元即 JS charCodeAt 单元，含代理对）——零依赖
 * · 字节 IO：Hex（容忍空格/逗号/0x 前缀）与 Base64（URL-Safe 容错）两种展示
 */

export const ENCODINGS = [
  { id: 'gbk', label: 'GBK' },
  { id: 'utf8', label: 'UTF-8' },
  { id: 'utf16le', label: 'UTF-16 LE' },
  { id: 'utf16be', label: 'UTF-16 BE' },
]

const BOM_LE = 0xfeff // UTF-16 LE BOM 字序标记（字节序 FF FE）
const BOM_BE = 0xfffe

/* ---------- GBK 逆向映射表（SPIKE-1 方案 d） ---------- */

let gbkTable = null
let gbkFatal = null

function getGbkTable() {
  if (gbkTable) return gbkTable
  gbkFatal = gbkFatal || new TextDecoder('gbk', { fatal: true })
  const map = new Map()
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      if (trail === 0x7f) continue
      let ch
      try {
        ch = gbkFatal.decode(new Uint8Array([lead, trail]))
      } catch (e) {
        continue // 未分配码位
      }
      // 跳过 PUA 用户定义区占位（无法与真实字符互换）
      if (ch.length === 1 && !(ch.codePointAt(0) >= 0xe000 && ch.codePointAt(0) <= 0xf8ff)) {
        map.set(ch, (lead << 8) | trail)
      }
    }
  }
  gbkTable = map
  return map
}

/** 仅供测试/调试观察表规模 */
export function gbkTableSize() {
  return getGbkTable().size
}

/* ---------- 编码（文本 → 字节） ---------- */

function encodeGbk(str) {
  const table = getGbkTable()
  const out = []
  for (const ch of str) {
    const cp = ch.codePointAt(0)
    if (cp < 0x80) {
      out.push(cp)
      continue
    }
    const b = table.get(ch)
    if (b === undefined) {
      return { ok: false, error: `字符「${ch}」无法用 GBK 编码（超出 GBK 字符范围，如 Emoji 或生僻字）` }
    }
    out.push((b >>> 8) & 0xff, b & 0xff)
  }
  return { ok: true, bytes: Uint8Array.from(out) }
}

function encodeUtf8(str) {
  return { ok: true, bytes: new TextEncoder().encode(str) }
}

/**
 * UTF-16 编码：JS 字符串的码元（charCodeAt）即 UTF-16 码元，代理对原样保留
 * @param {string} str
 * @param {boolean} littleEndian
 * @param {boolean} withBom
 */
function encodeUtf16(str, littleEndian, withBom) {
  const bomSize = withBom ? 2 : 0
  const bytes = new Uint8Array(str.length * 2 + bomSize)
  if (withBom) {
    bytes[0] = littleEndian ? 0xff : 0xfe
    bytes[1] = littleEndian ? 0xfe : 0xff
  }
  for (let i = 0; i < str.length; i++) {
    const cu = str.charCodeAt(i)
    const o = bomSize + i * 2
    if (littleEndian) {
      bytes[o] = cu & 0xff
      bytes[o + 1] = cu >>> 8
    } else {
      bytes[o] = cu >>> 8
      bytes[o + 1] = cu & 0xff
    }
  }
  return { ok: true, bytes }
}

/**
 * 文本 → 目标编码字节
 * @param {string} str
 * @param {'gbk'|'utf8'|'utf16le'|'utf16be'} encodingId
 * @param {{ bom?: boolean }} [opts] 仅 UTF-16 生效
 * @returns {{ ok:true, bytes:Uint8Array } | { ok:false, error:string }}
 */
export function encodeText(str, encodingId, opts = {}) {
  const s = String(str ?? '')
  switch (encodingId) {
    case 'gbk': return encodeGbk(s)
    case 'utf8': return encodeUtf8(s)
    case 'utf16le': return encodeUtf16(s, true, opts.bom === true)
    case 'utf16be': return encodeUtf16(s, false, opts.bom === true)
    default: return { ok: false, error: `不支持的编码：${encodingId}` }
  }
}

/* ---------- 解码（字节 → 文本） ---------- */

/** Hex 输入容错：剥离空白 / 逗号 / 0x 前缀 */
function parseHex(input) {
  const s = String(input ?? '').replace(/0x/gi, '').replace(/[\s,]/g, '')
  if (!s) return { ok: false, error: '没有可解码的内容' }
  if (!/^[0-9a-fA-F]+$/.test(s)) {
    const bad = [...s].find((c) => !/^[0-9a-fA-F]$/.test(c)) || ''
    return { ok: false, error: `包含非法十六进制字符「${bad}」：Hex 仅支持 0–9 和 A–F` }
  }
  if (s.length % 2 !== 0) {
    return { ok: false, error: `长度不合法：Hex 长度需为偶数（当前 ${s.length} 位），或检查是否漏了前导 0` }
  }
  const bytes = new Uint8Array(s.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  }
  return { ok: true, bytes }
}

/** Base64 → 字节（URL-Safe 容错 + padding 容错，与 base64.js 同策略但输出原始字节） */
function parseB64(input) {
  let s = String(input ?? '').replace(/[\s\u200B-\u200D\u2060]/g, '')
  if (!s) return { ok: false, error: '没有可解码的内容' }
  const eq = s.indexOf('=')
  const body = (eq === -1 ? s : s.slice(0, eq)).replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*$/.test(body)) {
    return { ok: false, error: '包含非法字符：Base64 仅支持 A–Z a–z 0–9 + / - _ 和补位符 =' }
  }
  const rem = body.length % 4
  if (rem === 1) return { ok: false, error: '长度不合法：去掉补位符后的长度对 4 取余不能为 1' }
  try {
    const bin = atob(body + '='.repeat(rem === 0 ? 0 : 4 - rem))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { ok: true, bytes }
  } catch (e) {
    return { ok: false, error: '解码失败：内容不是合法的 Base64' }
  }
}

const TEXT_DECODERS = {
  gbk: () => new TextDecoder('gbk', { fatal: true }),
  utf8: () => new TextDecoder('utf-8', { fatal: true }),
  utf16le: () => new TextDecoder('utf-16le', { fatal: true }),
  utf16be: () => new TextDecoder('utf-16be', { fatal: true }),
}

const NAMES = { gbk: 'GBK', utf8: 'UTF-8', utf16le: 'UTF-16 LE', utf16be: 'UTF-16 BE' }

/**
 * 字节 → 文本（TextDecoder 默认剥离 BOM）
 * @param {string} input Hex 或 Base64 字节串
 * @param {'gbk'|'utf8'|'utf16le'|'utf16be'} encodingId
 * @param {{ format?: 'hex'|'b64' }} [opts]
 * @returns {{ ok:true, data:string, byteLen:number } | { ok:false, error:string }}
 */
export function decodeText(input, encodingId, opts = {}) {
  const parsed = opts.format === 'b64' ? parseB64(input) : parseHex(input)
  if (!parsed.ok) return parsed
  const bytes = parsed.bytes
  if (!bytes.length) return { ok: false, error: '没有可解码的内容' }
  try {
    const data = TEXT_DECODERS[encodingId]().decode(bytes)
    return { ok: true, data, byteLen: bytes.length }
  } catch (e) {
    return {
      ok: false,
      error: `解码失败：字节序列不是合法的 ${NAMES[encodingId]} 文本（${bytes.length} 字节），请确认编码选择与字节格式是否正确`,
    }
  }
}

/* ---------- 字节展示 ---------- */

/** 字节 → Hex 展示（大写、两位、空格分隔，如 C4 E3 BA C3） */
export function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

/** 字节 → Base64（分块规避 call stack 限制） */
export function toB64(bytes) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
