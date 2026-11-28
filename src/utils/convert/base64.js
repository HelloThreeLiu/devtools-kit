/**
 * Base64 编解码（PRD 4.3.2 / 技术设计 §11.3；R1.2 健壮性增强）
 * · 编码：TextEncoder → 分块 btoa（UTF-8 安全，支持中文与 Emoji）；可选 Base64URL 输出
 * · 解码：URL-Safe 归一化 → 字符集/长度校验 → atob → TextDecoder（fatal 校验 UTF-8）
 * · 解码前剥离全部空白与零宽字符（PEM / 邮件折叠排版容错）
 * · 自动识别：符合 Base64 字符集且长度合法时默认解码，否则编码
 */

const B64_STD = /^[A-Za-z0-9+/]*={0,2}$/
const B64_URL = /^[A-Za-z0-9\-_]*={0,2}$/

/**
 * 剥离空白与零宽字符：\s 已含空格/换行/Tab/NBSP/U+FEFF 等，
 * 另补网页复制常见的零宽字符（U+200B–200D / U+2060）。
 * 解码方向全量剥离，支持 PEM、邮件折叠排版（R1.2）。
 */
const INVISIBLE = /[\s\u200B-\u200D\u2060]/g

function stripInvisible(str) {
  return String(str ?? '').replace(INVISIBLE, '')
}

/** 是否形似 Base64（自动识别用） */
export function looksLikeB64(str) {
  const t = stripInvisible(str)
  if (t.length < 4) return false
  const body = t.replace(/=+$/, '')
  const pad = t.slice(body.length)
  if (pad.length > 2) return false
  if (!/^[A-Za-z0-9+/\-_]+$/.test(body)) return false
  return body.length % 4 !== 1
}

/**
 * UTF-8 安全编码（分块拼接规避 call stack 限制）
 * @param {string} str
 * @param {{ urlSafe?: boolean }} [opts] Base64URL 输出（+/ → -_ 、去 padding，R1.2）
 */
export function encodeB64(str, opts = {}) {
  const bytes = new TextEncoder().encode(String(str ?? ''))
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  let data = btoa(bin)
  if (opts.urlSafe) data = data.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { ok: true, data, byteLen: bytes.length }
}

/** 解码：URL-Safe 容错 + 严格校验（解码前剥离全部空白与零宽字符），失败给出具体原因 */
export function decodeB64(str) {
  const raw = stripInvisible(str)
  if (!raw) return { ok: false, error: '没有可解码的内容' }

  // URL-Safe 归一化：- _ → + /（补位符 = 不受影响）
  const eq = raw.indexOf('=')
  const body = (eq === -1 ? raw : raw.slice(0, eq)).replace(/-/g, '+').replace(/_/g, '/')
  const pad = eq === -1 ? '' : raw.slice(eq)

  if (!/^[A-Za-z0-9+/]*$/.test(body)) {
    return { ok: false, error: '包含非法字符：Base64 仅支持 A–Z a–z 0–9 + / - _ 和补位符 =' }
  }

  const rem = body.length % 4
  if (rem === 1) {
    return { ok: false, error: '长度不合法：去掉补位符后的长度对 4 取余不能为 1' }
  }
  if (pad.length > 2) {
    return { ok: false, error: '长度不合法：补位符 = 最多 2 个' }
  }
  const expectPad = rem === 0 ? 0 : 4 - rem
  if (pad.length && pad.length !== expectPad) {
    return { ok: false, error: `长度不合法：当前内容长度需要 ${expectPad} 个补位符，实际 ${pad.length} 个` }
  }

  try {
    const bin = atob(body + '='.repeat(expectPad))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true, data: text, byteLen: bytes.length }
  } catch (e) {
    return {
      ok: false,
      error: '解码失败：内容不是合法的 Base64，或还原结果不是有效的 UTF-8 文本（空白字符已自动忽略，请检查是否混入其他不可见字符）',
    }
  }
}

/**
 * 统一入口
 * @param {string} str
 * @param {'auto'|'encode'|'decode'} mode
 * @param {{ urlSafe?: boolean }} [opts] 编码方向的输出选项（R1.2 Base64URL）
 * @returns {{ ok:boolean, data?:string, byteLen?:number, direction?:'encode'|'decode', error?:string, empty?:boolean }}
 */
export function convertBase64(str, mode = 'auto', opts = {}) {
  const s = String(str ?? '')
  if (!s) return { ok: false, empty: true }
  if (mode === 'auto') {
    if (looksLikeB64(s)) {
      const r = decodeB64(s)
      // 形似 Base64 但解码失败、且内容为纯字母数字（无 + / = - _ 特征字符）：
      // 大概率是普通单词（如 test / user / data）而非损坏的 Base64，回退为编码
      if (!r.ok && /^[A-Za-z0-9]+$/.test(s.trim())) return { ...encodeB64(s, opts), direction: 'encode' }
      return { ...r, direction: 'decode' }
    }
    return { ...encodeB64(s, opts), direction: 'encode' }
  }
  const r = mode === 'decode' ? decodeB64(s) : encodeB64(s, opts)
  return { ...r, direction: mode }
}
