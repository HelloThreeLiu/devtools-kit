import { describe, expect, test } from 'vitest'
import {
  dayDiff,
  dayOfYear,
  isLeapYear,
  isoWeek,
  lunar,
  parseDateYMD,
} from '../src/utils/convert/dateCalc.js'

/** 春节（正月初一）公历日期表——公开常识数据，作为农历对拍基准（PRD 4.4.1 验收） */
const SPRING_FESTIVALS = [
  ['2010-02-14', '庚寅'],
  ['2011-02-03', '辛卯'],
  ['2012-01-23', '壬辰'],
  ['2013-02-10', '癸巳'],
  ['2014-01-31', '甲午'],
  ['2015-02-19', '乙未'],
  ['2016-02-08', '丙申'],
  ['2017-01-28', '丁酉'],
  ['2018-02-16', '戊戌'],
  ['2019-02-05', '己亥'],
  ['2020-01-25', '庚子'],
  ['2021-02-12', '辛丑'],
  ['2022-02-01', '壬寅'],
  ['2023-01-22', '癸卯'],
  ['2024-02-10', '甲辰'],
  ['2025-01-29', '乙巳'],
]

describe('农历（Intl 中文历法，PRD 4.4.1）', () => {
  test.each(SPRING_FESTIVALS)('%s → %s 年正月初一', (solar, ganzhi) => {
    const [y, m, d] = solar.split('-').map(Number)
    const lu = lunar(new Date(y, m - 1, d))
    expect(lu.ganzhi).toBe(ganzhi)
    expect(lu.monthName).toBe('正月')
    expect(lu.dayName).toBe('初一')
  })

  test('2025 中秋 = 八月十五（蛇年）', () => {
    const lu = lunar(new Date(2025, 9, 6))
    expect(lu.monthName).toBe('八月')
    expect(lu.dayName).toBe('十五')
    expect(lu.zodiac).toBe('蛇')
  })

  test('闰月标注：2025 年闰六月（闰六月初一 = 2025-07-25）', () => {
    const lu = lunar(new Date(2025, 6, 25))
    expect(lu.monthName).toContain('闰')
  })
})

describe('星期 / 年内序数 / ISO 周（PRD 4.4.1 验收）', () => {
  test('2025-01-29 是星期三', () => {
    const d = new Date(2025, 0, 29)
    expect(['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]).toBe('星期三')
  })

  test('2024-01-01 是年内第 1 天、ISO 第 1 周', () => {
    const d = new Date(2024, 0, 1)
    expect(dayOfYear(d)).toBe(1)
    expect(isoWeek(d)).toEqual({ year: 2024, week: 1 })
  })

  test('2024-12-30 属于 2025 年 ISO 第 1 周', () => {
    expect(isoWeek(new Date(2024, 11, 30))).toEqual({ year: 2025, week: 1 })
  })

  test('闰年判断', () => {
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2025)).toBe(false)
  })
})

describe('日期差（PRD 4.4.1 验收）', () => {
  test('2025-01-01 → 2025-03-01 相差 59 天', () => {
    expect(dayDiff(new Date(2025, 0, 1), new Date(2025, 2, 1))).toBe(59)
  })

  test('跨闰年二月：2024-01-01 → 2024-03-01 为 60 天', () => {
    expect(dayDiff(new Date(2024, 0, 1), new Date(2024, 2, 1))).toBe(60)
  })
})

describe('日期解析（PRD 4.2-4）', () => {
  test('三种格式均可解析', () => {
    expect(parseDateYMD('2025-01-29').getTime()).toBe(new Date(2025, 0, 29).getTime())
    expect(parseDateYMD('2025/1/29').getTime()).toBe(new Date(2025, 0, 29).getTime())
    expect(parseDateYMD('2025年1月29日').getTime()).toBe(new Date(2025, 0, 29).getTime())
  })

  test('非法日期报错不进位', () => {
    expect(parseDateYMD('2025-02-30')).toBeNull()
    expect(parseDateYMD('2025-13-01')).toBeNull()
    expect(parseDateYMD('abc')).toBeNull()
  })
})
