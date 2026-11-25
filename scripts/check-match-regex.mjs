/* 临时脚本：验证 plugin.json 匹配指令正则的命中/不命中行为 */
import fs from 'node:fs'
const cfg = JSON.parse(fs.readFileSync('public/plugin.json', 'utf-8'))

const cases = {
  timestamp: {
    hit: ['1735689600', '1735689600000', '1234567890123'],
    miss: ['12345', '0', 'abc', '2025-01-01', '-1735689600'],
  },
  'url-codec': {
    hit: ['https://a.com/?kw=%E4%BD%A0', 'http://localhost:5173', 'HTTPS://A.COM'],
    miss: ['hello world', 'a.com', 'ftp://a.com', '你好'],
  },
  json: {
    hit: ['{"a":1}', '[1, 2]', '{\n  "a": 1,\n  "b": [true]\n}', '{"中文":"值"}'],
    miss: ['{abc', 'hello {world}', '{"a":1', 'plain text'],
  },
  uuid: {
    hit: ['550e8400-e29b-41d4-a716-446655440000', '550E8400-E29B-41D4-A716-446655440000'],
    miss: ['550e8400-e29b-41d4-a716-44665544000', 'uuid-not-a-uuid', '时间戳'],
  },
  color: {
    hit: ['#1E80FF', '#f00', '#1e80ff80', 'rgb(30,128,255)', 'rgba(30,128,255,0.5)', 'hsl(214,100%,56%)'],
    miss: ['hello', '#12345', 'rgb(a,b,c)', '214,100%,56%'],
  },
}

let bad = 0
for (const f of cfg.features) {
  const regexCmd = (f.cmds || []).find((c) => typeof c === 'object' && c.type === 'regex')
  if (!regexCmd) continue
  // 从 plugin.json 的字符串形式还原正则（与 uTools 运行时一致）
  const src = regexCmd.match.slice(1, regexCmd.match.lastIndexOf('/'))
  const flags = regexCmd.match.slice(regexCmd.match.lastIndexOf('/') + 1)
  const re = new RegExp(src, flags)
  console.log(`\n[${f.code}] /${src}/${flags}`)
  for (const s of cases[f.code]?.hit || []) {
    const hit = re.test(s)
    if (!hit) bad++
    console.log(`  ${hit ? '✓ 命中' : '✗ 漏配'}: ${JSON.stringify(s.slice(0, 40))}`)
  }
  for (const s of cases[f.code]?.miss || []) {
    const hit = re.test(s)
    if (hit) bad++
    console.log(`  ${hit ? '✗ 误配' : '✓ 排除'}: ${JSON.stringify(s.slice(0, 40))}`)
  }
}
console.log(bad === 0 ? '\n全部符合预期' : `\n存在 ${bad} 处不符`)
process.exit(bad === 0 ? 0 : 1)
