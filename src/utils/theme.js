/**
 * 主题（技术设计 §9.2）
 * 跟随 uTools 主题：官方推荐 prefers-color-scheme 媒体查询（自带变更监听）；
 * 提供「跟随系统 / 亮色 / 暗色」三选项（PRD 4.7.3），持久化到 dbStorage。
 */
import { ref, watchEffect } from 'vue'
import { getSettings, saveSettings } from './db.js'

const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

const themeMode = ref(['auto', 'light', 'dark'].includes(getSettings().theme) ? getSettings().theme : 'auto')
const resolvedDark = ref(false)

systemDark.addEventListener('change', (e) => {
  if (themeMode.value === 'auto') resolvedDark.value = e.matches
})

watchEffect(() => {
  resolvedDark.value = themeMode.value === 'dark' || (themeMode.value === 'auto' && systemDark.matches)
  document.documentElement.dataset.theme = resolvedDark.value ? 'dark' : 'light'
})

export function useTheme() {
  function setMode(mode) {
    if (!['auto', 'light', 'dark'].includes(mode)) return
    themeMode.value = mode
    saveSettings({ theme: mode })
  }
  return { themeMode, resolvedDark, setMode }
}
