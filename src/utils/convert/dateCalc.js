/**
 * 日期换算（PRD 4.4.1 / 技术设计 §11.2）
 * · 农历：基于运行环境内置的中文历法（Intl chinese calendar，原型已验证真实可用），
 *   输出天干地支年 + 生肖 + 月日；覆盖范围与 ICU 一致（约 1900–2100）
 * · ISO 周（ISO 8601 标准）；年内序数；日期差取 UTC 12:00 规避夏令时误差
 */
import { fmtDate } from './timestamp.js'

export const LUNAR_MIN_YEAR = 1900
export const LUNAR_MAX_YEAR = 2100

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const ZODIAC = '鼠牛虎兔龙蛇马羊猴鸡狗猪'
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/**
 * 解析日期：YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日（可选 HH:mm[:ss]）
 * 逐字段回读校验，非法日期（如 2 月 30 日）返回 null
 * @returns {Date|null}
 */
export function parseDateYMD(str) {
  const s = String(str ?? '').trim()
  const m = s.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (!m) return null
  // 缺省的可选分组先归零再转数字：Number(undefined) = NaN 会绕过解构默认值
  const [y, mo, d, h = 0, mi = 0, sec = 0] = m.slice(1, 7).map((x) => (x === undefined ? 0 : Number(x)))
  const date = new Date(y, mo - 1, d, h, mi, sec, 0)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}

/** ISO 8601 周数（周四所在的周为第 1 周） */
export function isoWeek(date) {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return { year: t.getUTCFullYear(), week }
}

/** 年内第几天（1 起） */
export function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1)
  return Math.round((date - start) / 86400000) + 1
}

/** 闰年 */
export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/**
 * 日期差（自然日）：双方取 UTC 12:00 计算规避夏令时 ±1 天
 * @returns {number} b − a（a 早于 b 为正）
 */
export function dayDiff(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate(), 12)
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate(), 12)
  return Math.round((ub - ua) / 86400000)
}

let chineseFormatter = null
try {
  chineseFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
} catch (e) {
  chineseFormatter = null
}

/**
 * 公历 → 农历
 * @returns {{ text:string, zodiac:string, ganzhi:string, monthName:string, dayName:string }}
 * @throws {Error} 环境不支持或超出可用范围
 */
export function lunar(date) {
  if (!chineseFormatter) throw new Error('当前环境不支持农历计算')
  const parts = chineseFormatter.formatToParts(date)
  const get = (type) => {
    const p = parts.find((x) => x.type === type)
    return p ? p.value : ''
  }
  const ganzhi = get('yearName') // 天干地支，如「乙巳」
  const monthName = get('month') // 如「正月」「闰二月」
  const day = Number(get('day')) // 1–30
  if (!ganzhi || !monthName || !(day >= 1 && day <= 30)) throw new Error('当前环境无法给出农历结果')
  const zodiac = ZODIAC[BRANCHES.indexOf(ganzhi[1])] || ''
  const dayName = DAY_NAMES[day - 1] || `第 ${day} 日`
  return {
    ganzhi,
    zodiac,
    monthName,
    dayName,
    text: `${ganzhi}年 ${monthName}${dayName}`,
  }
}
