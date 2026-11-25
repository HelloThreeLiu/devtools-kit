/* 临时脚本：核对组件用到的 class 是否都在 main.css 中有定义 */
const fs = require('fs')
const css = fs.readFileSync('src/main.css', 'utf-8')
const files = [
  'src/tools/base64/index.vue',
  'src/tools/url-codec/index.vue',
  'src/tools/json/index.vue',
  'src/tools/radix/index.vue',
  'src/tools/uuid/index.vue',
  'src/tools/date-calc/index.vue',
  'src/tools/timestamp/index.vue',
  'src/views/HomeView.vue',
  'src/components/ToolShell.vue',
  'src/components/ThemeMenu.vue',
  'src/components/ToastHost.vue',
  'src/App.vue',
]
const used = new Set()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf-8')
  for (const m of src.matchAll(/class="([^"]+)"/g)) {
    m[1]
      .split(/\s+/)
      .forEach((c) => {
        if (c && !c.includes('$') && !c.startsWith(':')) used.add(c)
      })
  }
}
const dyn = [
  'icon', 'urow', 'urow-no', 'ln', 'ln-no', 'ln-toggle', 'ln-gutter', 'ln-code',
  'fold-mark', 'is-folded', 'ln-code-bracket', 'tk-key', 'tk-str', 'tk-num', 'tk-bool',
  'tk-pun', 'hero--source', 'show', 'caret', 'alert--stack', 'alert-body', 'n',
]
const missing = []
for (const c of [...used].sort()) {
  if (dyn.includes(c)) continue
  const re = new RegExp('\\.' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s,{:.[>+~])')
  if (!re.test(css)) missing.push(c)
}
console.log('组件用到但 main.css 缺失:', missing.length ? missing.join(', ') : '无')
