/**
 * 文本统计（PRD 4.5.3）
 * 字符数（含 / 不含空白）、单词数（中文按字计）、行数、UTF-8 字节数
 */

export function textStats(text) {
  const s = String(text ?? '')
  const chars = [...s].length // 按 Unicode 码点计数
  const noSpace = [...s.replace(/\s/g, '')].length
  const lines = s === '' ? 0 : s.split('\n').length
  const bytes = new TextEncoder().encode(s).length

  // 单词：拉丁/数字词段 + CJK 字符（每个汉字计 1）
  const tokens = s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []
  let latinWords = 0
  let cjkChars = 0
  for (const w of tokens) {
    if (/^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(w)) cjkChars += w.length
    else latinWords += 1
  }

  return { chars, noSpace, words: latinWords + cjkChars, lines, bytes, latinWords, cjkChars }
}
