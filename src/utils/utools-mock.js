/**
 * 浏览器调试用 uTools API mock（无 window.utools 时生效）
 * 行为尽量贴近真实环境：onPluginEnter 自动以主入口进入；
 * dbStorage 用 localStorage 持久化，便于调试收藏/设置。
 * 控制台辅助：window.__devtoolsMock.enter('timestamp') 可模拟从指令进入工具。
 */

const listeners = { enter: [], out: [] }
const memory = (() => {
  try {
    localStorage.setItem('__probe__', '1')
    localStorage.removeItem('__probe__')
    return localStorage
  } catch (e) {
    const m = new Map()
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    }
  }
})()

const mock = {
  /* ---- 生命周期 ---- */
  onPluginReady(cb) {
    setTimeout(() => cb(), 0)
  },
  onPluginEnter(cb) {
    listeners.enter.push(cb)
    // 浏览器调试：默认以主入口进入
    setTimeout(() => cb({ code: 'devtools-kit', type: 'text', payload: null }), 30)
  },
  onPluginOut(cb) {
    listeners.out.push(cb)
  },

  /* ---- 子输入框 ---- */
  setSubInput(onChange) {
    mock.__subInputHandler = onChange
    return true
  },
  removeSubInput() {
    mock.__subInputHandler = null
    return true
  },
  setSubInputValue(text) {
    if (mock.__subInputHandler) mock.__subInputHandler({ text })
    return true
  },

  /* ---- 剪贴板（浏览器里走 Clipboard API，见 utils/clipboard.js）---- */
  copyText() {
    return false // 交由 clipboard.js 的浏览器降级路径
  },
  copyImage() {
    return false
  },

  /* ---- 数据 ---- */
  dbStorage: {
    getItem: (k) => {
      try {
        return JSON.parse(memory.getItem(k))
      } catch (e) {
        return null
      }
    },
    setItem: (k, v) => memory.setItem(k, JSON.stringify(v)),
    removeItem: (k) => memory.removeItem(k),
  },

  /* ---- 屏幕取色（浏览器里降级为 EyeDropper API，仅 Chrome/Edge 支持）---- */
  screenColorPick() {
    if (typeof window === 'undefined' || !window.EyeDropper) {
      return Promise.reject(new DOMException('EyeDropper unsupported', 'NotSupportedError'))
    }
    return new window.EyeDropper().open().then((r) => ({ hex: r.sRGBHex, rgb: '' }))
  },

  /* ---- 其他 ---- */
  isDarkColors: () => false,
  isMacOS: () => false,
  isWindows: () => true,
  isLinux: () => false,
  getWindowType: () => 'main',
  outPlugin() {},
  showNotification() {},
}

/** 浏览器控制台调试辅助 */
if (typeof window !== 'undefined') {
  window.__devtoolsMock = {
    /** 模拟通过指令进入插件，如 enter('timestamp') */
    enter(code = 'devtools-kit') {
      listeners.enter.forEach((cb) => cb({ code, type: 'text', payload: null }))
    },
    /** 模拟退出插件 */
    out() {
      listeners.out.forEach((cb) => cb(false))
    },
  }
}

export default mock
