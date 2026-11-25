/**
 * 命名风格转换（PRD 4.5.2）
 * 任意输入拆词后输出五种命名：camelCase / PascalCase / snake_case / CONSTANT_CASE / kebab-case
 */

/**
 * 拆词：空格 / _ - . / 连接符 + camelCase 边界 + 字母数字边界
 * @returns {string[]} 小写词数组
 */
export function splitWords(input) {
  const s = String(input ?? '').trim()
  if (!s) return []
  let t = s.replace(/[_\-.\\/]+/g, ' ')
  t = t
    .replace(/([a-z])([A-Z])/g, '$1 $2') // aB → a B
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // HTTPServer → HTTP Server
    .replace(/([a-zA-Z])(\d)/g, '$1 $2') // v2 → v 2
    .replace(/(\d)([a-zA-Z])/g, '$1 $2') // 2x → 2 x
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)

/**
 * @param {string[]} words
 * @param {'camel'|'pascal'|'snake'|'constant'|'kebab'} style
 */
export function toCase(words, style) {
  switch (style) {
    case 'camel':
      return words.map((w, i) => (i ? cap(w) : w)).join('')
    case 'pascal':
      return words.map(cap).join('')
    case 'snake':
      return words.join('_')
    case 'constant':
      return words.map((w) => w.toUpperCase()).join('_')
    case 'kebab':
      return words.join('-')
    default:
      return words.join(' ')
  }
}

/**
 * 一次输出全部风格
 * @returns {{ camel, pascal, snake, constant, kebab }}
 */
export function convertNaming(input) {
  const words = splitWords(input)
  return {
    camel: toCase(words, 'camel'),
    pascal: toCase(words, 'pascal'),
    snake: toCase(words, 'snake'),
    constant: toCase(words, 'constant'),
    kebab: toCase(words, 'kebab'),
  }
}
