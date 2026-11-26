/**
 * 路由（技术设计 §5）
 * 路由即状态：route = 'home' | toolId；无 URL 路由（BrowserView 内无意义）。
 * SubInput 联动：主界面接管 uTools 主输入框过滤工具；进入工具后交还（§5.3）。
 */
import { ref, computed } from 'vue'
import { utools, inUtoolsEnv } from './utils/utools.js'
import { toolByCode, toolById, MAIN_CODE } from './tools/index.js'
import { replay } from './utils/replay.js'

export const route = ref('home')
export const subInputText = ref('')
/** 进入插件时携带的载荷（匹配指令进入时使用，技术设计 §5.2） */
export const enterPayload = ref(null)

/** 匹配指令带入的文本，工具挂载时通过 consumeEnterPayload() 一次性取走 */
let pendingPayload = null

let subInputActive = false

function startSubInput() {
  if (subInputActive || typeof utools.setSubInput !== 'function') return
  try {
    utools.setSubInput(
      ({ text }) => {
        subInputText.value = text
      },
      '搜索工具…',
      false, // 不自动聚焦：主界面以键盘 ↑/↓ 浏览为主，聚焦交还用户
    )
    subInputActive = true
  } catch (e) {
    subInputActive = false
  }
}

function stopSubInput() {
  if (!subInputActive) return
  try {
    utools.removeSubInput()
  } catch (e) {
    /* 自定义窗口等场景返回 false，忽略 */
  }
  subInputActive = false
}

/** 内部导航（主界面 ↔ 工具页），同步 SubInput 状态 */
export function navigate(id) {
  route.value = id
  if (id === 'home') {
    startSubInput()
  } else {
    stopSubInput()
    // 离开主界面时清空过滤，回到主界面重新过滤
    subInputText.value = ''
    if (inUtoolsEnv && route.value !== 'home') focusToolInput()
  }
}

function focusToolInput() {
  // 工具页挂载后自行聚焦输入框（各自 onMounted 处理），此处预留
}

/** onPluginEnter 分发（技术设计 §5.2） */
export function handlePluginEnter(action) {
  enterPayload.value = action || null
  pendingPayload = null
  subInputText.value = ''
  const code = action && action.code
  if (code && code !== MAIN_CODE && toolByCode[code]) {
    // regex 匹配指令进入：携带匹配到的文本，工具挂载时预填（PRD 4.8.2）
    if (action.type === 'regex' && typeof action.payload === 'string') {
      pendingPayload = action.payload
    }
    const id = toolByCode[code].id
    if (route.value === id && pendingPayload) {
      // 已处于该工具页：组件不会重挂载、onMounted 不会重跑，
      // 直接回填避免 payload 残留（否则会污染下一次进入其他工具时的预填）
      replay(id, consumeEnterPayload())
    } else {
      navigate(id)
    }
  } else {
    navigate('home')
  }
}

/** 工具挂载时取走待预填的匹配文本（一次性） */
export function consumeEnterPayload() {
  const p = pendingPayload
  pendingPayload = null
  return p
}

/** onPluginOut 复位，等待下次进入 */
export function handlePluginOut() {
  subInputText.value = ''
  stopSubInput()
  route.value = 'home'
}

/** 当前工具对象（route 为工具 id 时；注意按 id 查 toolById，非 toolByCode） */
export const currentTool = computed(() => (route.value === 'home' ? null : toolById[route.value] || null))
