/**
 * 历史记录回填（技术设计 §6.2）
 * 工具组件 setup 时注册回填回调；ToolShell 历史面板点击记录后调用 replay() 回填输入
 */
import { onUnmounted } from 'vue'

const handlers = new Map() // toolId → (input) => void

/**
 * 注册当前工具的历史回填函数（onUnmounted 自动注销）
 */
export function useReplay(toolId, fn) {
  handlers.set(toolId, fn)
  onUnmounted(() => {
    if (handlers.get(toolId) === fn) handlers.delete(toolId)
  })
}

/** 把历史记录的输入回填给对应工具 */
export function replay(toolId, input) {
  const fn = handlers.get(toolId)
  if (fn) fn(input)
}
