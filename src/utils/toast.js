import { ref } from 'vue'

/** 全局轻提示（PRD §7：成功操作 ≤ 1.5s 反馈） */
const message = ref('')
const visible = ref(false)
let timer = null

export function toast(msg) {
  message.value = msg
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, 1400)
}

export function useToast() {
  return { message, visible }
}
