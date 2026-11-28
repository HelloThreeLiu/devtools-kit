/**
 * 图片/文件 ↔ Base64（R1.5，反馈热度第一）
 * · MIME 推断表：按扩展名（png/jpg/jpeg/gif/webp/svg/bmp/ico，未知回退 application/octet-stream）
 * · 魔数嗅探：PNG / JPG / GIF / WEBP(RIFF) / BMP(含 DIB 头校验) / ICO(含计数校验)；SVG 按 <svg / <?xml 文本特征识别
 * · Data URL 构造与解析；解码方向统一入口（含回放载荷判定）
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
  if (starts([0x42, 0x4d]) && b.length >= 18) {
    // 'BM' 弱签名易误判文本（如 "BMW…"），加验 offset 14 的 DIB 头长度字段（uint32 LE，已知值）
    const dib = b[14] | (b[15] << 8) | (b[16] << 16) | (b[17] << 24)
    if ([12, 16, 40, 52, 56, 64, 108, 124].includes(dib)) return 'image/bmp'
  }
  if (starts([0x00, 0x00, 0x01, 0x00]) && b.length >= 6) {
    // 加验 type（offset 2-3，1=图标 2=光标）与图标数（offset 4-5）合理性，排除随机二进制
    const type = b[2] | (b[3] << 8)
    const count = b[4] | (b[5] << 8)
    if ((type === 1 || type === 2) && count >= 1 && count <= 128) return 'image/x-icon'
  }
  // SVG：文本特征（允许 BOM、前导空白、XML 声明与注释，但 <svg> 必须在其后紧邻出现；
  // 只读前 512 字节——声明/注释与 svg 相距过远时不识别，属启发式固有局限）
  if (b.length >= 5) {
    const head = new TextDecoder('utf-8', { fatal: false })
      .decode(b.subarray(0, Math.min(b.length, 512)))
      .trimStart()
      .replace(/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*/i, '')
    if (/^<svg[\s>/]/i.test(head)) return 'image/svg+xml'
  }
  return null
}

/* ---------- Data URL ---------- */

export function buildDataUrl(mime, base64) {
  return `data:${mime || UNKNOWN_MIME};base64,${base64}`
}

const DATA_URL_RE = /^data:([^;,]*)(?:;charset=[^;,]*)?;base64,([\s\S]*)$/i

/** 解析 Base64 风味 Data URL；非该形态返回 null */
export function parseDataUrl(text) {
  const m = String(text ?? '').trim().match(DATA_URL_RE)
  if (!m) return null
  return { mime: m[1], base64: m[2].replace(/\s+/g, '') }
}

/* ---------- 解码方向统一入口 ---------- */

/**
 * 解析解码输入（Data URL 或裸 Base64）
 * · Data URL：直接取 MIME 与载荷（MIME 为空时回退魔数嗅探）
 * · 裸 Base64：严格校验后按魔数嗅探 MIME
 * · 返回的 base64 已剥离空白与零宽字符（保证拼出的 Data URL 可渲染、复制不带隐形字符，W3 审查 I-2）
 * · known = 是否存在可信的 MIME 来源（Data URL 前缀或嗅探命中；W3 审查建议注释）
 * @returns {{ ok:true, mime:string, known:boolean, bytes:Uint8Array, base64:string, source:'dataurl'|'sniff', byteLen:number }
 *          | { ok:false, empty?:boolean, error?:string }}
 */
export function analyzeDecodeInput(text) {
  const s = String(text ?? '').trim()
  if (!s) return { ok: false, empty: true }
  const du = parseDataUrl(s)
  let mime = ''
  let base64 = ''
  let source = 'sniff'
  if (du) {
    mime = du.mime
    base64 = du.base64
    source = 'dataurl'
  } else {
    if (/^data:/i.test(s)) {
      // data: 开头但不是 base64 风味 / 缺少 ;base64, 分隔——统一给出贴切提示（W3 审查 M-2）
      return { ok: false, error: '不支持的 Data URL 形态：需为 data:<MIME>;base64,<载荷>（URL 编码形态请先转 Base64）' }
    }
    base64 = s
  }
  // 剥离空白与零宽字符：parseB64 内部同样剥离，但返回值必须同步消毒，
  // 否则隐形字符会进入预览 Data URL 与剪贴板（W3 审查 I-2）
  base64 = base64.replace(/[\s\u200B-\u200D\u2060]/g, '')
  const r = parseB64(base64)
  if (!r.ok) return r
  const bytes = r.bytes
  // MIME 缺失（data:;base64, 或裸 Base64）→ 魔数嗅探兜底；前缀 MIME 非空时视为可信
  if (!mime || source === 'sniff') {
    const sniffed = sniffMime(bytes)
    if (sniffed) mime = sniffed
  }
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

/* ---------- 历史回放判定 ---------- */

/**
 * 历史回放载荷判定：应回填解码方向的输入原样返回，文件名等非 Base64 文本返回空串（W3 审查 I-1）
 * 规则（启发式，宁可漏放不可误放）：
 * · data: 前缀 → 直接回放
 * · 其余须同时满足：无任何空白（文件名/自然语言首查）、长度 20–4800（超 4800 必被历史截断，
 *   回放必然破损）、字符集合法、长度为 4 的倍数（组装完整性）、大小写混合或含 +/=
 *   （排除 PROJ1234567890123456 这类全大写+数字的文件名）
 * @param {string} v 历史记录的 input
 * @returns {string} 可回填的文本；'' = 不回放
 */
export function asReplayPayload(v) {
  const t = String(v ?? '').trim()
  if (/^data:[^;,]*;base64,/i.test(t)) return t
  if (t.length < 20 || t.length > 4800) return ''
  if (/\s/.test(t)) return ''
  if (!/^[A-Za-z0-9+/=]+$/.test(t)) return ''
  if (t.length % 4 !== 0) return ''
  const hasLower = /[a-z]/.test(t)
  const hasUpperOrSpecial = /[A-Z+/=]/.test(t)
  return hasLower && hasUpperOrSpecial ? t : ''
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
