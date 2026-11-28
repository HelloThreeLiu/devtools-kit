/**
 * preload services 浏览器 mock（utils/utools.js 在非 uTools 环境启用）
 * 接口与 public/preload.js 一致：hash / historyRead / historyWrite
 * · SHA 系列：Web Crypto（Node ≥20 的 vitest 环境同样可用，正确性有单测保证）
 * · MD5：纯 JS 实现（src/utils/md5.js）
 * · 历史：localStorage 持久化（不可用则内存）
 */
import { md5Hex } from './md5.js'

const SHA_NAMES = { sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' }

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

const HS_KEY = 'devtools-kit:history'

function readHistory() {
  try {
    const data = JSON.parse(memory.getItem(HS_KEY))
    if (data && typeof data === 'object' && data.version === 1 && data.history) return data
  } catch (e) {
    /* 首次/损坏 */
  }
  return { version: 1, history: {} }
}

export default {
  __mock: true,

  async hash(text, algo) {
    const t = String(text ?? '')
    if (algo === 'md5') return md5Hex(t)
    const name = SHA_NAMES[algo]
    if (!name) throw new Error('不支持的算法: ' + algo)
    const buf = await crypto.subtle.digest(name, new TextEncoder().encode(t))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  },

  historyRead() {
    return readHistory()
  },

  historyWrite(data) {
    if (!data || typeof data !== 'object' || data.version !== 1) return false
    memory.setItem(HS_KEY, JSON.stringify(data))
    return true
  },

  /** 另存为在浏览器调试模式不可用（UI 按环境隐藏入口），此处仅兜底 */
  saveFile() {
    throw new Error('浏览器调试模式不支持保存文件')
  },
}
