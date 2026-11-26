/**
 * 工具历史记录防抖写入（PRD 4.7.1）：输入停顿 1s 后记录一条
 * · 统一各工具此前分散的 histTimer 实现，行为与旧实现一致（与末条相同由 db.js 去重）
 * · 组件卸载时清理定时器并停止订阅（技术设计 §12：定时器组件卸载必清理）
 * · toOutput(v) 返回输出字符串（或 Promise）即记录 { input: v, output }；返回空值跳过
 * · toOutput 抛错（含异步 reject）静默跳过：历史记录不影响主流程
 */
import { watch, onUnmounted } from 'vue'
import { recordHistory } from './db.js'

export function useHistRecorder(toolId, source, toOutput) {
  let timer = null
  let seq = 0
  const stop = watch(source, (v) => {
    clearTimeout(timer)
    const my = ++seq
    timer = setTimeout(async () => {
      try {
        const output = await toOutput(v)
        if (my !== seq) return // 已有更新的输入，丢弃过期结果
        if (output) recordHistory(toolId, v, output)
      } catch (e) {
        /* 计算或记录失败不落盘 */
      }
    }, 1000)
  })
  onUnmounted(() => {
    clearTimeout(timer)
    stop()
  })
}
