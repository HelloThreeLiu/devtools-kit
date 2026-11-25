/* ============================================================
   DevTools Kit 原型 · 共享脚本
   SVG 图标集 / 主题（跟随系统·亮色·暗色）/ 收藏与最近使用 /
   导航 / Toast / 复制 / 工具页头部（ToolShell 雏形）/ 工具函数
   ============================================================ */
(function () {
  'use strict'

  const IN_FRAME = window.parent !== window
  const $ = (sel, root) => (root || document).querySelector(sel)
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel))
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  /* localStorage 不可用时退回内存（原型用；正式版对应 utools.db 与本地历史文件） */
  const store = (() => {
    try {
      localStorage.setItem('__proto__', '1')
      localStorage.removeItem('__proto__')
      return localStorage
    } catch (e) {
      const m = new Map()
      return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)) }, removeItem: (k) => { m.delete(k) } }
    }
  })()

  /* ---------- SVG 图标集：24 网格单线，2 单位描边，currentColor ---------- */
  const ICONS = {
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2.1"/>',
    'calendar': '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M3.5 10.5h17M8 3.5v4M16 3.5v4"/><circle cx="12" cy="15.2" r="1.4" fill="currentColor" stroke="none"/>',
    'base64': '<path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H16M9.5 8.5h5M9.5 12h5M9.5 15.5h5"/>',
    'json': '<path d="M9.5 4.5c-2.2 0-2.8 1.1-2.8 2.7v2c0 1.5-.8 2.5-2.2 2.8 1.4.3 2.2 1.3 2.2 2.8v2c0 1.6.6 2.7 2.8 2.7M14.5 4.5c2.2 0 2.8 1.1 2.8 2.7v2c0 1.5.8 2.5 2.2 2.8-1.4.3-2.2 1.3-2.2 2.8v2c0 1.6-.6 2.7-2.8 2.7"/>',
    'link': '<g transform="rotate(-45 12 12)"><path d="M9.2 7.2H7.8a4.8 4.8 0 0 0 0 9.6h1.4M14.8 7.2h1.4a4.8 4.8 0 0 1 0 9.6h-1.4M9.5 12h5"/></g>',
    'radix': '<ellipse cx="7.6" cy="12" rx="3.6" ry="5.6"/><path d="M13.6 7.6l6.4 8.8M20 7.6l-6.4 8.8"/>',
    'uuid': '<path d="M8.2 11.5a3.8 3.8 0 0 1 7.6 0c0 3.2-.5 6.2-1.5 8.8M4.8 11.2a7.2 7.2 0 0 1 14.4.4c0 2.6-.2 5-.8 7.4M12 15.2c0 1.9-.3 3.6-.9 5.3M4.9 15.2c.2 1.8 0 3.4-.6 4.8"/>',
    'hash': '<path d="M5 9.2h14.5M4.5 14.8H19M10 4.5L7.8 19.5M16.2 4.5L14 19.5"/>',
    'globe': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.3 3.9 5.1 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.1-3.9-8.5S9.4 5.8 12 3.5z"/>',
    'qrcode': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path fill="currentColor" stroke="none" d="M6.1 6.1h1.8v1.8H6.1zM16.1 6.1h1.8v1.8h-1.8zM6.1 16.1h1.8v1.8H6.1zM13.5 13.5h3.2v3.2h-3.2zM17.9 13.5h2.6v2.6h-2.6zM13.5 17.9h2.6v2.6h-2.6zM17.7 17.7h2.8v2.8h-2.8z"/>',
    'case': '<path d="M2.5 19L8 4.5 13.5 19M4.4 14.3h7.2M21.5 19v-5.7a2.9 2.9 0 1 0-2.9 2.9h2.9"/>',
    'text-stat': '<path d="M3.5 6h17M3.5 11h8.5M3.5 16h6M15.5 19.5v-5.5M20 19.5V9.5"/>',
    'color': '<path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.3a1.9 1.9 0 0 0 1.4-3.2l-.2-.3a1.9 1.9 0 0 1 1.4-3.2h2a3.6 3.6 0 0 0 3.6-3.6C21.5 5.8 17.2 3.5 12 3.5z"/><path fill="currentColor" stroke="none" d="M8.7 10.2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM13.2 7.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM17.6 10.2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/>',
    'grid': '<rect x="4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8"/>',
    'search': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L20.5 20.5"/>',
    'arrow-left': '<path d="M19 12H5.5M11.5 18.5L5 12l6.5-6.5"/>',
    'arrow-right': '<path d="M4.5 12H18M12 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 19V5.5M5.5 11.5L12 5l6.5 6.5"/>',
    'arrow-down': '<path d="M12 5v13.5M5.5 12.5L12 19l6.5-6.5"/>',
    'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
    'star': '<path d="M12 3.4l2.291 6.044 6.458.311-5.039 4.05 1.696 6.238-5.406-3.543-5.406 3.543 1.696-6.238-5.039-4.05 6.458-.311z"/>',
    'copy': '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h.5"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'x': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    'alert': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.2"/>',
    'swap': '<path d="M7 4v13.5M3.5 14L7 17.5 10.5 14M17 20V6.5M13.5 10L17 6.5 20.5 10"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    'moon': '<path d="M20.46 12.78A8.5 8.5 0 1 1 11.22 3.54 6.6 6.6 0 1 0 20.46 12.78z"/>',
    'monitor': '<rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M9 20.5h6M12 17v3.5"/>',
    'shield': '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 7.8-7.5 9.5-4.3-1.7-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2 3.8-4"/>',
    'dots': '<path fill="currentColor" stroke="none" d="M13.3 6a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0zM13.3 12a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0zM13.3 18a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z"/>',
  }

  const SPRITE =
    '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">' +
    Object.keys(ICONS).map((k) => `<symbol id="i-${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`).join('') +
    '</svg>'

  const icon = (name, cls) =>
    `<svg class="${cls || 'icon'}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`

  /* ---------- 工具注册表（对应 src/tools/index.js，PRD 4.8.1 指令）---------- */
  const TOOLS = [
    { id: 'timestamp', name: '时间戳转换', desc: '秒 / 毫秒时间戳与日期时间双向转换', cat: 'codec', p: 'P0', icon: 'clock', page: 'tool-timestamp', cmds: ['时间戳', '时间戳转换', 'timestamp'], kw: 'unix 毫秒 日期转时间戳 epoch' },
    { id: 'base64', name: 'Base64 编解码', desc: '文本与 Base64 双向转换，自动识别方向', cat: 'codec', p: 'P0', icon: 'base64', page: 'tool-base64', cmds: ['base64', 'Base64转码', 'base64编码'], kw: 'encode decode 编码 解码 b64' },
    { id: 'url-codec', name: 'URL 编解码', desc: 'URL 编解码与查询参数结构化解析', cat: 'codec', p: 'P0', icon: 'link', cmds: ['url编码', 'url解码', 'URL编解码'], kw: 'uri encode decode 参数 转义' },
    { id: 'json', name: 'JSON 格式化', desc: '格式化、压缩、校验并定位语法错误', cat: 'codec', p: 'P0', icon: 'json', page: 'tool-json', cmds: ['json', 'JSON格式化', 'json校验'], kw: 'format 格式化 校验 压缩' },
    { id: 'radix', name: '进制转换', desc: '2 / 8 / 10 / 16 进制互转，大数安全', cat: 'codec', p: 'P0', icon: 'radix', cmds: ['进制转换', '进制', 'hex转十进制'], kw: 'hex bin oct 二进制 八进制 十六进制 0x' },
    { id: 'hash', name: '哈希计算', desc: 'MD5 / SHA-1 / SHA-256 / SHA-512', cat: 'codec', p: 'P1', icon: 'hash', cmds: ['哈希', 'hash', 'md5', 'sha'], kw: 'md5 sha 摘要 digest' },
    { id: 'unicode', name: 'Unicode 转中文', desc: '\\uXXXX 转义与中文互转', cat: 'codec', p: 'P1', icon: 'globe', cmds: ['unicode', 'unicode转中文'], kw: '转义 实体 u4f60' },
    { id: 'date-calc', name: '日期换算', desc: '农历、星期、年内序数与日期差', cat: 'datetime', p: 'P0', icon: 'calendar', page: 'tool-date-calc', cmds: ['日期换算', '农历', '日期计算', 'datecalc'], kw: '时间日期 农历 星期 天数差 lunar' },
    { id: 'uuid', name: 'UUID 生成', desc: 'UUID v4 批量生成，多种格式', cat: 'text', p: 'P0', icon: 'uuid', cmds: ['uuid', 'UUID生成', 'guid'], kw: 'guid 标识 生成 v4' },
    { id: 'case', name: '命名风格转换', desc: 'camel / snake / kebab 等五种命名互转', cat: 'text', p: 'P1', icon: 'case', cmds: ['命名转换', '驼峰转换'], kw: 'camel snake kebab 大小写' },
    { id: 'text-stat', name: '文本统计', desc: '字数、行数、UTF-8 字节数统计', cat: 'text', p: 'P1', icon: 'text-stat', cmds: ['文本统计', '字数统计'], kw: 'count 字数 行数 utf8' },
    { id: 'qrcode', name: '二维码生成', desc: '文本转二维码，本地生成可复制', cat: 'text', p: 'P1', icon: 'qrcode', cmds: ['二维码', 'qrcode'], kw: '扫码' },
    { id: 'color', name: '颜色格式转换', desc: 'HEX / RGB / HSL 互转与预览', cat: 'design', p: 'P1', icon: 'color', cmds: ['颜色转换', 'color', '取色'], kw: 'hex rgb hsl 取色' },
  ]

  const CATEGORIES = [
    { id: 'all', name: '全部' },
    { id: 'codec', name: '编解码' },
    { id: 'datetime', name: '时间日期' },
    { id: 'text', name: '文本生成' },
    { id: 'design', name: '设计辅助' },
  ]

  const toolById = new Map(TOOLS.map((t) => [t.id, t]))
  const PAGE_OF = {} // 页面名 → 工具
  TOOLS.forEach((t) => { if (t.page) PAGE_OF[t.page] = t })

  const params = new URLSearchParams(location.search)
  const DEMO = params.get('demo') || ''
  const DEMO_FRESH = DEMO === 'fresh' // 首次使用：无收藏、无历史（不落盘）

  /* ---------- 主题：auto 跟随 prefers-color-scheme（技术设计 §9.2）---------- */
  const THEME_KEY = 'proto.theme'
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener() {} }
  let themeMode = (() => {
    const q = params.get('theme')
    if (q === 'light' || q === 'dark') return q
    const s = store.getItem(THEME_KEY)
    return s === 'light' || s === 'dark' || s === 'auto' ? s : 'auto'
  })()

  const resolvedTheme = (mode) => (mode === 'auto' ? (mq.matches ? 'dark' : 'light') : mode)

  function applyTheme() {
    document.documentElement.dataset.theme = resolvedTheme(themeMode)
    $$('[data-theme-option]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeOption === themeMode)))
    $$('[data-theme-icon]').forEach((b) => {
      const name = themeMode === 'auto' ? 'monitor' : themeMode === 'dark' ? 'moon' : 'sun'
      const svg = b.querySelector('.icon use')
      if (svg) svg.setAttribute('href', '#i-' + name)
    })
  }

  function setTheme(mode, broadcast) {
    themeMode = mode
    if (broadcast !== false) {
      store.setItem(THEME_KEY, mode)
      if (IN_FRAME) window.parent.postMessage({ type: 'proto:theme', mode }, '*')
    }
    applyTheme()
    document.dispatchEvent(new CustomEvent('proto:theme'))
  }

  applyTheme()
  if (mq.addEventListener) mq.addEventListener('change', applyTheme)

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-theme-option]')
    if (!b) return
    setTheme(b.dataset.themeOption)
  })

  /* ---------- 收藏 / 最近使用（原型用 localStorage 模拟持久化）---------- */
  const FAV_KEY = 'proto.favorites'
  const RECENT_KEY = 'proto.recent'
  const FAV_SEED = ['timestamp', 'json', 'base64']
  const RECENT_SEED = [['date-calc', 2], ['radix', 60], ['uuid', 185]] // [工具, 分钟前] 演示数据

  function getFavorites() {
    try {
      const a = JSON.parse(store.getItem(FAV_KEY))
      if (Array.isArray(a)) return a.filter((id) => toolById.has(id))
    } catch (e) { /* 首次打开 */ }
    return DEMO_FRESH ? [] : FAV_SEED.slice()
  }

  function getRecent() {
    if (!DEMO_FRESH) {
      try {
        const a = JSON.parse(store.getItem(RECENT_KEY))
        if (Array.isArray(a)) return a.filter((r) => r && toolById.has(r.id))
      } catch (e) { /* 首次打开 */ }
    }
    const now = Date.now()
    return (DEMO_FRESH ? [] : RECENT_SEED).map(([id, min]) => ({ id, ts: now - min * 60000 }))
  }

  function markUsed(id) {
    if (DEMO_FRESH || !toolById.has(id)) return
    const list = getRecent().filter((r) => r.id !== id)
    list.unshift({ id, ts: Date.now() })
    store.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10))) // 最多 10 个（PRD 4.7.1）
    document.dispatchEvent(new CustomEvent('proto:recent'))
  }

  function toggleFav(id) {
    const t = toolById.get(id)
    if (!t) return
    const had = getFavorites().includes(id)
    const next = had ? getFavorites().filter((x) => x !== id) : [id].concat(getFavorites()) // 新收藏的排最前
    store.setItem(FAV_KEY, JSON.stringify(next))
    syncFavButtons()
    window.protoToast(had ? `已取消收藏 ${t.name}` : `已收藏 ${t.name}`)
    document.dispatchEvent(new CustomEvent('proto:fav'))
  }

  function syncFavButtons() {
    const favs = getFavorites()
    $$('[data-fav]').forEach((b) => {
      const on = favs.includes(b.dataset.fav)
      const t = toolById.get(b.dataset.fav)
      b.setAttribute('aria-pressed', String(on))
      b.setAttribute('aria-label', (on ? '取消收藏 ' : '收藏 ') + (t ? t.name : ''))
      b.title = on ? '取消收藏' : '收藏'
    })
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-fav]')
    if (!b) return
    ev.preventDefault()
    ev.stopPropagation()
    toggleFav(b.dataset.fav)
  })

  const favButton = (t, extra) =>
    `<button type="button" class="icon-btn star ${extra || ''}" data-fav="${t.id}">${icon('star', 'icon icon--sm')}</button>`

  /* ---------- 导航 ---------- */
  function nav(page) {
    const q = params.get('theme')
    if (IN_FRAME) {
      window.parent.postMessage({ type: 'proto:nav', page }, '*')
    } else {
      window.location.href = page + '.html' + (q ? '?theme=' + q : '')
    }
  }

  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return
    const el = ev.target.closest('[data-nav]')
    if (!el) return
    ev.preventDefault()
    nav(el.dataset.nav)
  })

  /* ---------- Toast：role=status 常驻 DOM，悬停 / 聚焦时暂停消失 ---------- */
  const toast = { el: null, timer: 0 }
  function toastHide() { if (toast.el) toast.el.classList.remove('show') }
  function toastArm(ms) {
    clearTimeout(toast.timer)
    toast.timer = setTimeout(toastHide, ms)
  }

  window.protoToast = function (msg) {
    if (!toast.el) return
    toast.el.querySelector('span').textContent = msg
    toast.el.classList.add('show')
    toastArm(1400) // ≤ 1.5s（PRD §7 反馈）
  }

  /* ---------- 复制：原型用 Clipboard API，正式版为 utools.copyText() ---------- */
  function fallbackCopy(val) {
    try {
      const ta = document.createElement('textarea')
      ta.value = val
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch (e) {
      return false
    }
  }

  window.protoCopy = async function (text, label) {
    const val = text == null ? '' : String(text)
    if (!val) {
      window.protoToast('没有可复制的内容')
      return false
    }
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(val)
        ok = true
      }
    } catch (e) { /* 降级到 execCommand */ }
    if (!ok) ok = fallbackCopy(val)
    window.protoToast(ok ? (label ? '已复制 · ' + label : '已复制') : '复制失败')
    return ok
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-copy]')
    if (!el) return
    ev.preventDefault()
    window.protoCopy(el.dataset.copy, el.dataset.copyLabel || '')
  })

  /* ---------- Ctrl+Enter 复制主结果（PRD 4.2-2），页面注入 protoMainCopy ---------- */
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      const fn = window.protoMainCopy
      if (typeof fn !== 'function') return
      ev.preventDefault()
      fn()
    }
  })

  /* ---------- 工具页头部（ToolShell：返回 / 图标 + 名称 / 指令 / 收藏）---------- */
  function renderShellHeader() {
    const el = document.getElementById('shell-header')
    const t = el && toolById.get(el.dataset.tool)
    if (!t) return
    el.innerHTML =
      `<button type="button" class="back" data-nav="home">${icon('arrow-left')}<span>返回</span></button>` +
      `<div class="tool-id">${icon(t.icon)}<h1>${esc(t.name)}</h1></div>` +
      `<span class="cmds" title="在 uTools 主输入框输入指令可直接打开">${esc(t.cmds.join(' / '))}</span>` +
      '<span class="grow"></span>' + favButton(t)
    el.setAttribute('aria-label', t.name)
    markUsed(t.id) // 进入工具即计入「最近使用」
  }

  /* ---------- 行内错误：红字 + 原因 + 可选恢复操作 ---------- */
  function setError(alertEl, inputEl, err) {
    const body = `<span>${esc(err.message)}</span>` + (err.detail || '') // detail：补充说明的 HTML
    alertEl.hidden = false
    alertEl.classList.toggle('alert--stack', !!err.detail)
    alertEl.innerHTML = icon('alert') +
      (err.detail ? `<div class="alert-body">${body}</div>` : body) +
      (err.action ? `<button type="button" class="act">${esc(err.action.label)}</button>` : '')
    if (err.action) {
      alertEl.querySelector('.act').addEventListener('click', err.action.run)
    }
    if (inputEl) {
      inputEl.setAttribute('aria-invalid', 'true')
      if (!inputEl.getAttribute('aria-describedby')) inputEl.setAttribute('aria-describedby', alertEl.id)
    }
  }

  function clearError(alertEl, inputEl) {
    alertEl.hidden = true
    alertEl.innerHTML = ''
    alertEl.classList.remove('alert--stack')
    if (inputEl) inputEl.removeAttribute('aria-invalid')
  }

  /* ---------- 工具函数 ---------- */
  const pad = (n) => String(n).padStart(2, '0')
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const fmtDateTime = (d) => `${fmtDate(d)} ${fmtTime(d)}`

  function relTime(ts, now) {
    const diff = ts - (now == null ? Date.now() : now) // 负数 = 过去
    const abs = Math.abs(diff)
    const suffix = diff < 0 ? '前' : '后'
    const MIN = 60000, HOUR = 3600000, DAY = 86400000
    if (abs < MIN) return '刚刚'
    if (abs < HOUR) return Math.floor(abs / MIN) + ' 分钟' + suffix
    if (abs < DAY) return Math.floor(abs / HOUR) + ' 小时' + suffix
    if (abs < DAY * 30) return Math.floor(abs / DAY) + ' 天' + suffix
    if (abs < DAY * 365) return Math.floor(abs / (DAY * 30)) + ' 个月' + suffix
    return Math.floor(abs / (DAY * 365)) + ' 年' + suffix
  }

  function zoneLabel() {
    const off = -new Date().getTimezoneOffset() / 60
    const sign = off >= 0 ? '+' : '-'
    const a = Math.abs(off)
    const text = a % 1 === 0 ? String(a) : a.toFixed(1)
    let name = ''
    try { name = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch (e) { /* 无 Intl */ }
    return { short: 'UTC' + sign + text, name }
  }

  /* ---------- 宿主（审阅台）通信 ---------- */
  window.addEventListener('message', (ev) => {
    const d = ev.data || {}
    if (d.type === 'proto:theme' && (d.mode === 'auto' || d.mode === 'light' || d.mode === 'dark')) {
      setTheme(d.mode, false)
    }
    document.dispatchEvent(new CustomEvent('proto:host', { detail: d }))
  })

  const toHost = (msg) => { if (IN_FRAME) window.parent.postMessage(msg, '*') }

  /* ---------- 启动 ---------- */
  function boot() {
    document.body.insertAdjacentHTML('afterbegin', SPRITE)
    applyTheme() // 脚本在 <head> 里先于正文执行；页面里的外观选项此时才解析出来，补一次选中态

    toast.el = document.createElement('div')
    toast.el.id = 'toast'
    toast.el.setAttribute('role', 'status')
    toast.el.setAttribute('aria-live', 'polite')
    toast.el.innerHTML = icon('check') + '<span></span>'
    toast.el.addEventListener('mouseenter', () => clearTimeout(toast.timer))
    toast.el.addEventListener('mouseleave', () => toastArm(800))
    document.body.appendChild(toast.el)

    renderShellHeader()
    syncFavButtons()
    document.dispatchEvent(new CustomEvent('proto:ready'))
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()

  window.proto = {
    IN_FRAME, DEMO, DEMO_FRESH, esc, icon, store, TOOLS, CATEGORIES, toolById, PAGE_OF,
    getFavorites, getRecent, markUsed, toggleFav, syncFavButtons, favButton,
    nav, setTheme, themeMode: () => themeMode, setError, clearError, toHost,
    pad, WEEKDAYS, fmtDate, fmtTime, fmtDateTime, relTime, zoneLabel,
  }
})()
