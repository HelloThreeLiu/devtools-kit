/**
 * Unicode 转中文（PRD 4.3.7）
 * · 解码：\uXXXX（含 \u{...} 扩展写法）与 &#xXXXX; / &#dddd; HTML 实体（分号容错）
 * · 编码：非 ASCII → \uXXXX（BMP 外字符按代理对拆分，与原生语义一致）
 */

/** 解码：\uXXXX、\u{...}、&#xHHHH;、&#DDDD; */
export function unicodeDecode(str) {
  let s = String(str ?? '')
  // \u 序列：先整段收集再做代理对配对（两个连续 \u 半区合并为一个码点）
  s = s.replace(/(?:\\u([0-9a-f]{4}))+/gi, (seq) => {
    const codes = []
    for (const m of seq.matchAll(/\\u([0-9a-f]{4})/gi)) codes.push(parseInt(m[1], 16))
    return decodeCodes(codes)
  })
  // HTML 实体（分号容错）
  s = s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => safePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => safePoint(Number(d)))
  return s
}

/** 码点数组 → 字符串：合法代理对合并，孤立代理用替换字符 */
function decodeCodes(codes) {
  let out = ''
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i]
    const isHigh = c >= 0xd800 && c <= 0xdbff
    const next = codes[i + 1]
    const nextIsLow = next >= 0xdc00 && next <= 0xdfff
    if (isHigh && nextIsLow) {
      out += String.fromCodePoint(0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00))
      i++
    } else if (c >= 0xd800 && c <= 0xdfff) {
      out += '\uFFFD' // 孤立代理
    } else {
      out += String.fromCodePoint(c)
    }
  }
  return out
}

function safePoint(cp) {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
    return '\uFFFD' // 无效码点用替换字符表示，不抛错
  }
  return String.fromCodePoint(cp)
}

/** 编码：非 ASCII 字符 → \uXXXX（BMP 外拆代理对） */
export function unicodeEncode(str) {
  let out = ''
  for (const ch of String(str ?? '')) {
    const cp = ch.codePointAt(0)
    if (cp < 128) {
      out += ch
    } else if (cp > 0xffff) {
      const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800
      const lo = ((cp - 0x10000) % 0x400) + 0xdc00
      out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`
    } else {
      out += `\\u${cp.toString(16).padStart(4, '0')}`
    }
  }
  return out
}

/** 自动方向：含 \u / &# 序列 → 解码，否则编码 */
export function convertUnicode(str, mode = 'auto') {
  const s = String(str ?? '')
  if (!s) return { ok: false, empty: true }
  const hasSeq = /\\u[0-9a-f]{4}|&#x?[0-9a-f]+/i.test(s)
  const dir = mode === 'auto' ? (hasSeq ? 'decode' : 'encode') : mode
  return { ok: true, data: dir === 'decode' ? unicodeDecode(s) : unicodeEncode(s), direction: dir }
}
