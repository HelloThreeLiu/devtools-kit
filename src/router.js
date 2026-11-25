/**
 * 路由（技术设计 §5）
 * 路由即状态：route = 'home' | toolId；无 URL 路由（BrowserView 内无意义）。
 * SubInput 联动：主界面接管 uTools 主输入框过滤工具；进入工具后交还（§5.3）。
 */
import { ref, computed } from 'vue'
import { utools, inUtoolsEnv } from './utils/utools.js'
import { toolByCode, MAIN_CODE } from './tools/index.js'

export const route = ref('home')
export const subInputText = ref('')
/** 进入插件时携带的载荷（匹配指令进入时使用，M4 起） */
export const enterPayload = ref(null)

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
  const code = action && action.code
  subInputText.value = ''
  navigate(!code || code === MAIN_CODE || !toolByCode[code] ? 'home' : toolByCode[code].id)
}

/** onPluginOut 复位，等待下次进入 */
export function handlePluginOut() {
  subInputText.value = ''
  stopSubInput()
  route.value = 'home'
}

/** 当前工具对象（route 为工具 id 时） */
export const currentTool = computed(() => (route.value === 'home' ? null : toolByCode[route.value] || null))
