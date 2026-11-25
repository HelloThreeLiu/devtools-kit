/* ============================================================
   DevTools Kit 原型 · 共享脚本
   主题联动 / 跨窗口导航 / toast / 复制 / 时钟 等通用能力
   ============================================================ */

(function () {
  const IN_FRAME = window.parent !== window

  /* ---------- 主题 ---------- */

  function storeTheme(v) {
    try { localStorage.setItem('proto-theme', v) } catch (e) { /* file:// 降级 */ }
  }

  function loadTheme() {
    // 优先 URL 参数（审阅入口指定），其次本地记忆，默认亮色
    const q = new URLSearchParams(location.search).get('theme')
    if (q === 'dark' || q === 'light') return q
    try { return localStorage.getItem('proto-theme') || 'light' } catch (e) { return 'light' }
  }

  function applyTheme(v) {
    document.documentElement.dataset.theme = v
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
      btn.textContent = v === 'dark' ? '☀' : '🌙'
      btn.title = v === 'dark' ? '切换到亮色' : '切换到暗色'
    })
  }

  applyTheme(loadTheme())

  window.addEventListener('message', (ev) => {
    const d = ev.data || {}
    if (d.type === 'proto-theme' && (d.theme === 'dark' || d.theme === 'light')) {
      applyTheme(d.theme)
    }
  })

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action="toggle-theme"]')
    if (!btn) return
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    storeTheme(next)
    if (IN_FRAME) parent.postMessage({ type: 'proto-theme', theme: next }, '*')
  })

  /* ---------- 导航 ---------- */

  window.protoNav = function (page) {
    if (IN_FRAME) parent.postMessage({ type: 'proto-nav', page }, '*')
    else location.href = page + '.html'
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-nav]')
    if (el) protoNav(el.dataset.nav)
  })

  /* ---------- Toast ---------- */

  let toastTimer = null
  window.protoToast = function (msg) {
    let t = document.getElementById('toast')
    if (!t) {
      t = document.createElement('div')
      t.id = 'toast'
      document.body.appendChild(t)
    }
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => t.classList.remove('show'), 1400)
  }

  /* ---------- 复制 ---------- */

  window.protoCopy = async function (text, label) {
    const val = String(text)
    let ok = false
    try {
      await navigator.clipboard.writeText(val)
      ok = true
    } catch (e) {
      try {
        const ta = document.createElement('textarea')
        ta.value = val
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch (e2) { ok = false }
    }
    window.protoToast(ok ? ('已复制' + (label ? ' · ' + label : '')) : '复制失败')
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-copy]')
    if (el) {
      ev.stopPropagation()
      window.protoCopy(el.dataset.copy || '', el.dataset.copyLabel || '')
    }
  })

  /* ---------- 实时时钟 ---------- */

  window.protoTick = function (fn) {
    const run = () => fn(new Date())
    run()
    return setInterval(run, 1000)
  }

  /* ---------- 工具函数 ---------- */

  window.protoEsc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  window.protoTimeAgo = function (ts) {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return m + ' 分钟前'
    const h = Math.floor(m / 60)
    if (h < 24) return h + ' 小时前'
    return Math.floor(h / 24) + ' 天前'
  }

  /* 日期时间格式化：YYYY-MM-DD HH:mm:ss */
  window.protoFmt = function (d) {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  const WEEKS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  window.protoWeek = function (d) { return WEEKS[d.getDay()] }

  /* 相对时间（用于时间戳工具输出） */
  window.protoRel = function (ts) {
    const diff = Date.now() - ts
    const abs = Math.abs(diff)
    const m = 60000, h = 3600000, day = 86400000
    if (abs < m) return diff >= 0 ? '刚刚' : '即将到来'
    if (abs < h) return Math.floor(abs / m) + ' 分钟' + (diff >= 0 ? '前' : '后')
    if (abs < day) return Math.floor(abs / h) + ' 小时' + (diff >= 0 ? '前' : '后')
    if (abs < day * 30) return Math.floor(abs / day) + ' 天' + (diff >= 0 ? '前' : '后')
    return Math.floor(abs / (day * 30)) + ' 个月' + (diff >= 0 ? '前' : '后')
  }
})()
