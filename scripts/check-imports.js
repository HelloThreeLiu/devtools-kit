/* 临时脚本：核对组件 <script setup> 中常用标识符是否都有对应 import
   （vite 构建不检查未定义变量，运行时 ReferenceError 会导致组件白屏） */
const fs = require('fs')

// 标识符 → 应出现的导入来源标记（在 import 行里匹配该标记即视为已导入）
const KNOWN = {
  ref: 'vue',
  computed: 'vue',
  watch: 'vue',
  onMounted: 'vue',
  onUnmounted: 'vue',
  onBeforeUnmount: 'vue',
  recordHistory: 'db.js',
  favorites: 'db.js',
  toggleFavorite: 'db.js',
  getRecentTools: 'db.js',
  clearAllHistory: 'db.js',
  useHistRecorder: 'histRecorder.js',
  useMainResult: 'mainResult.js',
  useMainResultKey: 'mainResult.js',
  useReplay: 'replay.js',
  consumeEnterPayload: 'router.js',
  navigate: 'router.js',
  subInputText: 'router.js',
  route: 'router.js',
  copyText: 'clipboard.js',
  toast: 'toast.js',
  useTheme: 'theme.js',
  ensureSprite: 'icons.js',
}

const files = [
  ...fs
    .readdirSync('src/tools')
    .filter((d) => !d.includes('.'))
    .map((d) => `src/tools/${d}/index.vue`),
  'src/views/HomeView.vue',
  'src/components/ToolShell.vue',
  'src/components/ThemeMenu.vue',
  'src/App.vue',
]
let bad = 0
for (const f of files) {
  const src = fs.readFileSync(f, 'utf-8')
  const script = src.match(/<script setup>([\s\S]*?)<\/script>/)?.[1] || ''
  const importBlock = script.match(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*$/gm)?.join('\n') || ''
  for (const [id, srcMark] of Object.entries(KNOWN)) {
    const used = new RegExp(`(?<![\\w.$])${id}\\s*\\(`).test(script) || new RegExp(`(?<![\\w.$])${id}(?=[\\s,;)\\]])`).test(script)
    if (!used) continue
    const imported =
      new RegExp(`import[\\s\\S]*?\\b${id}\\b[\\s\\S]*?from\\s+['"][^'"]*${srcMark}`)
        .test(importBlock) ||
      new RegExp(`import\\s+${id}\\s+from\\s+['"][^'"]*${srcMark}`).test(importBlock)
    if (!imported) {
      bad++
      console.log(`✗ ${f}: 使用了 ${id}（应在 ${srcMark}）但未导入`)
    }
  }
}
console.log(bad === 0 ? '导入检查全部通过' : `共 ${bad} 处缺失`)
process.exit(bad ? 1 : 0)
