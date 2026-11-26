/* 组件 class 完整性检查：核对组件模板用到的 class 是否都有定义
   （main.css 或组件 <style scoped>），缺失即退出码 1。
   - 仅提取静态 class="..."（排除 :class/@click 等动态绑定）
   - 定义集合从 CSS 选择器 token 中提取（.a、.a:hover、.x.y 均可识别）
   - v-html / JS 动态拼接的类在 DYN 动态类白名单中维护 */
const fs = require('fs')

const css = fs.readFileSync('src/main.css', 'utf-8')

const files = [
  ...fs
    .readdirSync('src/tools')
    .filter((d) => !d.includes('.'))
    .map((d) => `src/tools/${d}/index.vue`),
  'src/views/HomeView.vue',
  'src/components/ToolShell.vue',
  'src/components/ThemeMenu.vue',
  'src/components/ToastHost.vue',
  'src/components/Icon.vue',
  'src/App.vue',
]

/* v-html 与 JS 拼接产生的类（不出现在静态 class="" 中） */
const DYN = [
  'icon', // Icon.vue 动态 class 前缀
  'tk-key', 'tk-str', 'tk-num', 'tk-bool', 'tk-pun', // jsonFormat.js 高亮
  'fold-mark', 'ln-code-bracket', // jsonFormat 折叠标记
]

const used = new Set()
const defined = new Set()

/** 从 CSS 文本提取类选择器 token（.tag、.tag--ok、.ln.is-folded 等） */
function collectDefined(text) {
  for (const m of text.matchAll(/\.([a-zA-Z][\w-]*)/g)) defined.add(m[1])
}

collectDefined(css)

for (const f of files) {
  const src = fs.readFileSync(f, 'utf-8')
  // (?<![:@]) 排除 :class="..." / @xxx 中的 class=" 字样，只取静态类
  for (const m of src.matchAll(/(?<![:@\w])class="([^"]+)"/g)) {
    m[1]
      .split(/\s+/)
      .forEach((c) => {
        if (c && !c.includes('$') && !c.startsWith(':')) used.add(c)
      })
  }
  // 组件 scoped 样式中的定义同样有效
  const style = src.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  if (style) collectDefined(style[1])
}

const missing = []
for (const c of [...used].sort()) {
  if (DYN.includes(c)) continue
  if (!defined.has(c)) missing.push(c)
}
console.log('组件用到但无样式定义:', missing.length ? missing.join(', ') : '无')
process.exit(missing.length ? 1 : 0)
