/**
 * Base32 编解码（RFC 4648；R1.7，PRD 4.3.2 同族）
 * · 字母表 A–Z + 2–7（不含 0/1/8/9），补位符 =
 * · 编码：TextEncoder → 5-bit 分组（UTF-8 安全，支持中文与 Emoji）；可选无填充输出
 * · 解码：剥离空白与零宽字符 → 字符集/长度校验 → fatal TextDecoder（严格校验 UTF-8）
 *   容错：小写字母自动归一、补位符可有可无（数量不校验，缺失自动补齐）
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** 解码前剥离：与 Base64 同策略（\s 含 NBSP/U+FEFF，另补零宽字符） */
const INVISIBLE = /[\s\u200B-\u200D\u2060]/g

/**
 * Base32 编码
 * @param {string} str
 * @param {{ padding?: boolean }} [opts] 默认按 RFC 4648 补 = 至 8 的倍数
 * @returns {{ ok:true, data:string, byteLen:number }}
 */
export function encodeB32(str, opts = {}) {
  const bytes = new TextEncoder().encode(String(str ?? ''))
  let out = ''
  let bits = 0
  let value = 0
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  if (opts.padding !== false) {
    while (out.length % 8 !== 0) out += '='
  }
  return { ok: true, data: out, byteLen: bytes.length }
}

/**
 * Base32 解码
 * @param {string} str
 * @returns {{ ok:true, data:string, byteLen:number } | { ok:false, error:string }}
 */
export function decodeB32(str) {
  const raw = String(str ?? '').replace(INVISIBLE, '')
  if (!raw) return { ok: false, error: '没有可解码的内容' }

  // 补位符容错：全部剥离（缺失 / 多余均不报错）
  const body = raw.replace(/=+$/, '')
  if (!body) return { ok: false, error: '没有可解码的内容' }

  // 逐字符校验原始字符（不能整串 toUpperCase 后再校验：ﬁ→FI、ß→SS 等长度展开
  // 会把非法字符「幻影合法」并产生索引错位，W2 审查 M-2）
  const upper = body.toUpperCase()
  for (let i = 0; i < body.length; i++) {
    const up = body[i].toUpperCase()
    if (up.length !== 1 || !ALPHABET.includes(up)) {
      if (body[i] === '=') {
        return { ok: false, error: '补位符 = 只能出现在末尾（正文中间不允许出现）' }
      }
      return {
        ok: false,
        error: `包含非法字符「${body[i]}」：Base32 仅支持 A–Z 和 2–7（不含 0、1、8、9）与补位符 =`,
      }
    }
  }

  // RFC 4648：去掉补位后长度对 8 取余只能是 0/2/4/5/7（1/3/6 无法凑出完整字节边界）
  const rem = upper.length % 8
  if (rem === 1 || rem === 3 || rem === 6) {
    return { ok: false, error: `长度不合法：去掉补位符后长度为 ${upper.length}（余 ${rem}），不是合法的 Base32 分组` }
  }

  const bytes = []
  let bits = 0
  let value = 0
  for (let i = 0; i < upper.length; i++) {
    value = (value << 5) | ALPHABET.indexOf(upper[i])
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  // 末尾不足 8 bit 的剩余位按 RFC 允许丢弃（容错：不校验剩余位是否为 0）

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes))
    return { ok: true, data: text, byteLen: bytes.length }
  } catch (e) {
    return { ok: false, error: '解码失败：内容不是合法的 Base32，或还原结果不是有效的 UTF-8 文本' }
  }
}
