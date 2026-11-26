/**
 * 主结果复制（PRD 4.2-2）：Ctrl/Cmd + Enter 复制当前工具的主结果
 * · 工具组件 setup 时用 useMainResult() 注册主结果 getter
 * · ToolShell 用 useMainResultKey() 在工具页激活期间接管 document 键盘事件
 * · 监听随 ToolShell 卸载移除、getter 随工具卸载注销，无泄漏
 */
import { onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { copyText } from './clipboard.js'

let getMainResult = null // () => { value: string, label?: string } | null

/** 注册当前工具的主结果（onUnmounted 自动注销） */
export function useMainResult(fn) {
  getMainResult = fn
  onUnmounted(() => {
    if (getMainResult === fn) getMainResult = null
  })
}

/** ToolShell 使用：工具页激活期间接管 Ctrl/Cmd + Enter */
export function useMainResultKey() {
  function onKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return
    let r = null
    try {
      r = typeof getMainResult === 'function' ? getMainResult() : null
    } catch (err) {
      r = null
    }
    if (r && r.value) {
      e.preventDefault()
      copyText(r.value, r.label || '主结果')
    }
  }
  onMounted(() => document.addEventListener('keydown', onKey))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
}
