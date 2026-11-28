import { utools } from './utools.js'
import { toast } from './toast.js'

/**
 * 复制文本 + 轻提示（PRD 4.2-2）
 * uTools 环境：utools.copyText；浏览器调试：Clipboard API → execCommand 降级
 */

/**
 * 复制前统一规整：去首尾空白/换行，杜绝隐形字符进入剪贴板
 * （R1.1 反馈修复：UUID 复制带隐形回车；全工具复制路径均经此出口）
 */
export function normalizeCopyText(text) {
  return text == null ? '' : String(text).trim()
}

export async function copyText(text, label = '') {
  const val = normalizeCopyText(text)
  if (!val) {
    toast('没有可复制的内容')
    return false
  }
  let ok = false
  try {
    ok = utools.copyText(val) === true
  } catch (e) {
    ok = false
  }
  if (!ok && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(val)
      ok = true
    } catch (e) {
      ok = fallbackCopy(val)
    }
  } else if (!ok) {
    ok = fallbackCopy(val)
  }
  toast(ok ? `已复制${label ? ' · ' + label : ''}` : '复制失败')
  return ok
}

function fallbackCopy(val) {
  try {
    const ta = document.createElement('textarea')
    ta.value = val
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch (e) {
    return false
  }
}
