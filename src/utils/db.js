/**
 * 数据层（技术设计 §8）
 * · 设置 / 收藏 → dbStorage（同步数据库键值存储，官方定位即用户偏好）
 * · 历史记录（P1）→ 插件本地数据目录文件，经 preload 桥接，此处暂不实现
 * 全部读写 try/catch 静默降级：收藏/设置失败不影响主流程
 */
import { ref } from 'vue'
import { utools, services } from './utools.js'

const KEY_SETTINGS = 'devtools-kit:settings'
const KEY_FAVORITES = 'devtools-kit:favorites'

/* ---------- 设置 ---------- */

export function getSettings() {
  try {
    return utools.dbStorage.getItem(KEY_SETTINGS) || {}
  } catch (e) {
    return {}
  }
}

export function saveSettings(patch) {
  try {
    utools.dbStorage.setItem(KEY_SETTINGS, { ...getSettings(), ...patch })
    return true
  } catch (e) {
    return false
  }
}

/* ---------- 收藏（响应式，新收藏排最前，PRD 4.7.2） ---------- */

function loadFavorites() {
  try {
    const a = utools.dbStorage.getItem(KEY_FAVORITES)
    return Array.isArray(a) ? a : []
  } catch (e) {
    return []
  }
}

export const favorites = ref(loadFavorites())

export function isFavorite(toolId) {
  return favorites.value.includes(toolId)
}

export function toggleFavorite(toolId) {
  const list = favorites.value
  const next = list.includes(toolId) ? list.filter((x) => x !== toolId) : [toolId, ...list]
  try {
    utools.dbStorage.setItem(KEY_FAVORITES, next)
  } catch (e) {
    /* 降级：仅内存生效 */
  }
  favorites.value = next
  return next
}

/* ---------- 历史记录（PRD 4.7.1，技术设计 §8：本地数据目录文件，经 preload） ---------- */

const HISTORY_CAP = 50 // 每工具最多 50 条，LRU 淘汰
const INPUT_CAP = 5000 // 输入超长截断存储（回填以截断内容为准）
const OUTPUT_CAP = 200 // 输出仅存摘要

const historyCache = ref(null) // { version, history: { toolId: [{ input, output, ts }] } }
const historyTick = ref(0) // 变更计数：界面读取它建立响应依赖
const flushTimers = {}

async function ensureHistory() {
  if (historyReady()) return
  try {
    const data = await services.historyRead()
    historyCache.value = data && data.history ? data : { version: 1, history: {} }
  } catch (e) {
    historyCache.value = { version: 1, history: {} }
  }
}

function historyReady() {
  return historyCache.value !== null
}

/** 记录一条历史：1s 防抖落盘；与末条输入+输出均相同则跳过，输入相同而输出不同则原地更新（如切换输出开关后重录，W2 审查 I-1） */
export async function recordHistory(toolId, input, output) {
  await ensureHistory()
  const h = historyCache.value.history
  const sIn = String(input ?? '')
  if (!sIn) return
  const sOut = String(output ?? '').slice(0, OUTPUT_CAP)
  const list = h[toolId] || []
  if (list[0] && list[0].input === sIn) {
    if (list[0].output === sOut) return
    list[0] = { input: sIn.slice(0, INPUT_CAP), output: sOut, ts: Date.now() }
    historyTick.value++
    clearTimeout(flushTimers[toolId])
    flushTimers[toolId] = setTimeout(() => flushHistory(), 1000)
    return
  }
  list.unshift({ input: sIn.slice(0, INPUT_CAP), output: sOut, ts: Date.now() })
  h[toolId] = list.slice(0, HISTORY_CAP)
  historyTick.value++
  clearTimeout(flushTimers[toolId])
  flushTimers[toolId] = setTimeout(() => flushHistory(), 1000)
}

async function flushHistory() {
  if (!historyReady()) return
  try {
    services.historyWrite(historyCache.value)
  } catch (e) {
    /* 降级：仅内存生效 */
  }
}

/** 某工具的历史记录（最新在前） */
export function listHistory(toolId) {
  historyTick.value // 建立响应依赖
  if (!historyReady()) return []
  return (historyCache.value.history[toolId] || []).map((r) => ({ ...r }))
}

/** 删除单条 */
export function removeHistory(toolId, index) {
  if (!historyReady()) return
  const list = historyCache.value.history[toolId]
  if (!list || !list[index]) return
  list.splice(index, 1)
  historyTick.value++
  flushHistory()
}

/** 清空某工具历史 */
export function clearHistory(toolId) {
  if (!historyReady()) return
  delete historyCache.value.history[toolId]
  historyTick.value++
  flushHistory()
}

/** 清空全部历史（主界面入口，二次确认由界面负责） */
export function clearAllHistory() {
  if (!historyReady()) return
  historyCache.value.history = {}
  historyTick.value++
  flushHistory()
}

/** 最近使用工具（从历史推导，按最新时间排序，PRD 4.7.1：最多 10 个） */
export function getRecentTools(limit = 10) {
  historyTick.value // 建立响应依赖
  if (!historyReady()) return []
  const arr = []
  for (const [id, records] of Object.entries(historyCache.value.history)) {
    if (records.length) arr.push({ id, ts: records[0].ts })
  }
  return arr.sort((a, b) => b.ts - a.ts).slice(0, limit)
}

/** 应用启动时加载历史（App.vue 调用一次） */
export function initHistory() {
  ensureHistory()
}
