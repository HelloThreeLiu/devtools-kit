/**
 * 数据层（技术设计 §8）
 * · 设置 / 收藏 → dbStorage（同步数据库键值存储，官方定位即用户偏好）
 * · 历史记录（P1）→ 插件本地数据目录文件，经 preload 桥接，此处暂不实现
 * 全部读写 try/catch 静默降级：收藏/设置失败不影响主流程
 */
import { ref } from 'vue'
import { utools } from './utools.js'

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
