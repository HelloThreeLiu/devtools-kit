/**
 * 时间戳转换 · 纯函数（技术设计 §11.1，PRD 4.3.1 v0.3）
 *
 * 方向自动识别：纯数字 → 时间戳；含日期分隔符 → 日期。
 * 单位按数量级阈值识别，不限位数：
 *   n < 1e11            → 秒
 *   1e11 ≤ n < 1e14     → 毫秒
 *   1e14 ≤ n < 1e18     → 微秒（÷1000 转毫秒，四舍五入）
 *   n ≥ 1e18            → 报错（超出 Date 可表示范围 ±8.64e15 ms）
 * 日期解析全部显式正则，结果逐字段回读校验（2 月 30 日类输入报错不进位）。
 */

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const MS_MAX = 8.64e15 // Date 可表示范围（±100,000,000 天）

const pad = (n) => String(n).padStart(2, '0')

/** 日期部分逐项比对，排除 2 月 30 日这类被 JS 自动进位的输入 */
function validDate(date, y, mo, d, h = 0, mi = 0, s = 0) {
  return (
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === mi &&
    date.getSeconds() === s
  )
}

/**
 * 显式解析日期字符串，支持：
 *   YYYY-MM-DD[ HH:mm[:ss]] / YYYY/MM/DD[ HH:mm[:ss]] / YYYY-MM-DD / YYYY/MM/DD
 *   ISO 8601：YYYY-MM-DDTHH:mm[:ss[.mmm]][Z|±HH:MM]
 * @returns {Date|null} null = 无法解析或日期不真实存在
 */
export function parseDate(str) {
  const s = String(str).trim()

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (m) {
    const [y, mo, d, h = 0, mi = 0, sec = 0] = m.slice(1, 7).map(Number)
    const date = new Date(y, mo - 1, d, h, mi, sec, 0)
    return validDate(date, y, mo, d, h, mi, sec) ? date : null
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/)
  if (m) {
    const [y, mo, d, h, mi, sec = 0, ms = 0] = m.slice(1, 8).map((x) => (x ? Number(x) : 0))
    const zone = m[8]
    const utc = Date.UTC(y, mo - 1, d, h, mi, sec, ms)
    const check = new Date(utc)
    if (
      check.getUTCMonth() !== mo - 1 ||
      check.getUTCDate() !== d ||
      check.getUTCHours() !== h ||
      check.getUTCMinutes() !== mi ||
      check.getUTCSeconds() !== sec
    ) {
      return null
    }
    if (!zone) {
      // 无时区 → 按本地时区解释
      const local = new Date(y, mo - 1, d, h, mi, sec, ms)
      return validDate(local, y, mo, d, h, mi, sec) ? local : null
    }
    let offset = 0
    if (zone !== 'Z') offset = (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2))) * (zone[0] === '+' ? 1 : -1)
    return new Date(utc - offset * 60000)
  }

  return null
}

/** 时区标注（如 UTC+8 及 IANA 名称） */
export function zoneLabel(date = new Date()) {
  const off = -date.getTimezoneOffset() / 60
  const sign = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  const text = a % 1 === 0 ? String(a) : a.toFixed(1)
  let name = ''
  try {
    name = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch (e) {
    /* 无 Intl 环境 */
  }
  return { short: 'UTC' + sign + text, name }
}

/** YYYY-MM-DD HH:mm:ss（本地时区） */
export function fmtLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** YYYY-MM-DD（本地时区） */
export function fmtDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** YYYY-MM-DD HH:mm:ss（UTC） */
export function fmtUTC(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

/** 相对时间，如「3 天前」「2 个月后」（now 可注入便于测试） */
export function relTime(ts, now = Date.now()) {
  const diff = ts - now // 负数 = 过去
  const abs = Math.abs(diff)
  const suffix = diff < 0 ? '前' : '后'
  const MIN = 60000
  const HOUR = 3600000
  const DAY = 86400000
  if (abs < MIN) return '刚刚'
  if (abs < HOUR) return `${Math.floor(abs / MIN)} 分钟${suffix}`
  if (abs < DAY) return `${Math.floor(abs / HOUR)} 小时${suffix}`
  if (abs < DAY * 30) return `${Math.floor(abs / DAY)} 天${suffix}`
  if (abs < DAY * 365) return `${Math.floor(abs / (DAY * 30))} 个月${suffix}`
  return `${Math.floor(abs / (DAY * 365))} 年${suffix}`
}

/**
 * 识别输入（PRD 4.3.1 v0.3）
 * @returns {{
 *   kind: 'empty'|'ts'|'date'|'error',
 *   ms?: number, digits?: number, unit?: string,
 *   date?: Date,
 *   message?: string
 * }}
 */
export function analyze(raw) {
  const s = String(raw == null ? '' : raw).trim()
  if (!s) return { kind: 'empty' }

  // ---- 纯数字：时间戳（数量级阈值）----
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    if (n >= 1e18) {
      return {
        kind: 'error',
        message: `超出可表示时间范围：${s.length} 位数字超出 ±100,000,000 天（±8.64e15 ms）。`,
      }
    }
    if (n >= 1e14) return { kind: 'ts', ms: Math.round(n / 1000), digits: s.length, unit: '微秒' }
    if (n >= 1e11) return { kind: 'ts', ms: n, digits: s.length, unit: '毫秒' }
    return { kind: 'ts', ms: n * 1000, digits: s.length, unit: '秒' }
  }

  // ---- 负数时间戳（1970 前）：P2 预留提示 ----
  if (/^-\d+$/.test(s)) {
    return { kind: 'error', message: '暂不支持负数时间戳（1970 年前），将在后续版本提供。' }
  }

  // ---- 日期 ----
  const date = parseDate(s)
  if (date) return { kind: 'date', date, ms: date.getTime() }

  // 形似日期但数值非法时，给出更具体的原因
  const like = s.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/)
  if (like) {
    const [, y, mo, d] = like
    if (Number(mo) < 1 || Number(mo) > 12) return { kind: 'error', message: `月份须在 1–12 之间，收到 ${mo}。` }
    const days = new Date(Number(y), Number(mo), 0).getDate()
    if (Number(d) > days) return { kind: 'error', message: `${y} 年 ${mo} 月只有 ${days} 天，没有 ${d} 日。` }
  }

  return { kind: 'error', message: `无法识别「${s}」：请输入时间戳（秒 / 毫秒 / 微秒自动识别），或 2025-01-01 08:00:00 这样的日期。` }
}
