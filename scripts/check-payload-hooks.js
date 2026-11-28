/* 临时脚本：核对工具的 payload 预填接入完整性 */
const fs = require('fs')
const files = [
  'timestamp', 'base64', 'base32', 'url-codec', 'json', 'radix', 'date-calc',
  'hash', 'color', 'unicode', 'encoding', 'case-convert', 'text-stat', 'qrcode',
]
let bad = []
for (const f of files) {
  const s = fs.readFileSync(`src/tools/${f}/index.vue`, 'utf-8')
  const uses = s.includes('consumeEnterPayload')
  const imports = s.includes("from '../../router.js'")
  if (uses && !imports) bad.push(`${f}: 使用了 consumeEnterPayload 但未从 router.js 导入`)
  if (!uses) bad.push(`${f}: 未接入 payload 预填`)
}
console.log(bad.length ? bad.join('; ') : `${files.length} 个工具 payload 接入完整`)
process.exit(bad.length ? 1 : 0)
