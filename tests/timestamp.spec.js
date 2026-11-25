import { describe, expect, test } from 'vitest'
import {
  analyze,
  fmtLocal,
  fmtUTC,
  relTime,
  zoneLabel,
} from '../src/utils/convert/timestamp.js'

const NOW = new Date('2025-06-15T12:00:00+08:00').getTime()

describe('时间戳识别 analyze（PRD 4.3.1 v0.3）', () => {
  test('输入 0 → 1970-01-01（秒级）', () => {
    const r = analyze('0')
    expect(r.kind).toBe('ts')
    expect(r.unit).toBe('秒')
    expect(r.ms).toBe(0)
  })

  test('10 位与 13 位输出同一时刻', () => {
    const a = analyze('1735689600')
    const b = analyze('1735689600000')
    expect(a.ms).toBe(b.ms)
    expect(a.unit).toBe('秒')
    expect(b.unit).toBe('毫秒')
  })

  test('5 位数字按秒识别', () => {
    const r = analyze('12345')
    expect(r.kind).toBe('ts')
    expect(r.unit).toBe('秒')
    expect(r.ms).toBe(12345000)
  })

  test('16 位按微秒识别（÷1000，四舍五入）', () => {
    const r = analyze('1735689600123456')
    expect(r.kind).toBe('ts')
    expect(r.unit).toBe('微秒')
    expect(r.ms).toBe(1735689600123)
  })

  test('20 位报超范围错误', () => {
    const r = analyze('12345678901234567890')
    expect(r.kind).toBe('error')
    expect(r.message).toContain('超出可表示时间范围')
  })

  test('日期方向：本地 2025-01-01 08:00:00（时区无关断言）', () => {
    const r = analyze('2025-01-01 08:00:00')
    expect(r.kind).toBe('date')
    // 期望值用本地时区构造，与运行环境时区无关
    expect(r.ms).toBe(new Date(2025, 0, 1, 8, 0, 0).getTime())
  })

  test('非法日期 2025-02-30 报错不进位', () => {
    const r = analyze('2025-02-30')
    expect(r.kind).toBe('error')
    expect(r.message).toContain('2 月只有 28 天')
  })

  test('月份越界给出具体原因', () => {
    const r = analyze('2025-13-01')
    expect(r.kind).toBe('error')
    expect(r.message).toContain('月份须在 1–12')
  })

  test('ISO 8601 带时区解析（绝对时刻，时区无关）', () => {
    const r = analyze('2025-01-01T08:00:00+08:00')
    expect(r.kind).toBe('date')
    expect(r.ms).toBe(Date.UTC(2025, 0, 1, 0, 0, 0))
  })

  test('非日期非数字文本报错', () => {
    expect(analyze('abc').kind).toBe('error')
  })

  test('空输入为空态', () => {
    expect(analyze('').kind).toBe('empty')
    expect(analyze('   ').kind).toBe('empty')
  })
})

describe('格式化与时区辅助', () => {
  test('fmtLocal 输出固定格式', () => {
    const d = new Date(2025, 0, 1, 8, 5, 3)
    expect(fmtLocal(d)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(fmtLocal(d)).toContain(' 08:05:03')
  })

  test('fmtUTC 独立于运行环境时区', () => {
    expect(fmtUTC(new Date(Date.UTC(2025, 0, 1, 8, 5, 3)))).toBe('2025-01-01 08:05:03')
  })

  test('relTime 分档（固定 now）', () => {
    const now = NOW
    expect(relTime(now - 30_000, now)).toBe('刚刚')
    expect(relTime(now - 5 * 60_000, now)).toBe('5 分钟前')
    expect(relTime(now + 3 * 3600_000, now)).toBe('3 小时后')
    expect(relTime(now - 2 * 86_400_000, now)).toBe('2 天前')
    expect(relTime(now - 40 * 86_400_000, now)).toBe('1 个月前')
    expect(relTime(now + 400 * 86_400_000, now)).toBe('1 年后')
  })

  test('zoneLabel 返回 UTC 偏移格式', () => {
    expect(zoneLabel().short).toMatch(/^UTC[+-]\d+(\.\d)?$/)
  })
})
