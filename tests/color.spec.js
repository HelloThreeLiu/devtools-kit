import { describe, expect, test } from 'vitest'
import { formatColor, parseColor } from '../src/utils/convert/color.js'

describe('颜色解析（PRD 4.6.1）', () => {
  test('#1E80FF → rgb(30,128,255)', () => {
    const r = parseColor('#1E80FF')
    expect(r.ok).toBe(true)
    expect(r.color).toEqual({ r: 30, g: 128, b: 255, a: 1 })
  })

  test('3 位 HEX 扩展', () => {
    expect(parseColor('#f00').color).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  test('8 位 HEX 解析 alpha', () => {
    const r = parseColor('#1e80ff80')
    expect(r.color.a).toBeCloseTo(0.5, 1)
  })

  test('rgb() 解析', () => {
    expect(parseColor('rgb(30,128,255)').color).toEqual({ r: 30, g: 128, b: 255, a: 1 })
    expect(parseColor('rgba(30,128,255,0.5)').color.a).toBe(0.5)
  })

  test('hsl() 解析（舍入误差 ±1 内回环）', () => {
    const r = parseColor('hsl(214,100%,56%)')
    expect(r.ok).toBe(true)
    // hsl 分量本身是取整值，解析回 RGB 允许 ±1 舍入偏差（设计工具同理）
    expect(Math.abs(r.color.r - 30)).toBeLessThanOrEqual(1)
    expect(Math.abs(r.color.g - 128)).toBeLessThanOrEqual(1)
    expect(r.color.b).toBe(255)
  })

  test('非法输入报错', () => {
    expect(parseColor('notacolor').ok).toBe(false)
    expect(parseColor('#12345').ok).toBe(false)
    expect(parseColor('').empty).toBe(true)
  })
})

describe('颜色输出（PRD 4.6.1 验收）', () => {
  test('#1E80FF → rgb / hsl（与设计工具换算一致）', () => {
    const f = formatColor(parseColor('#1E80FF').color)
    expect(f.hex).toBe('#1e80ff')
    expect(f.rgb).toBe('rgb(30, 128, 255)')
    expect(f.hsl).toBe('hsl(214, 100%, 56%)')
    expect(f.cssVar).toBe('--brand: #1e80ff;')
  })

  test('HSL ↔ RGB 往返一致（抽样）', () => {
    for (const h of [0, 60, 120, 210, 240, 300]) {
      const r = parseColor(`hsl(${h},100%,50%)`)
      const back = rgbToHslOf(r.color)
      expect(back.h).toBe(h)
      expect(back.s).toBe(100)
      expect(back.l).toBe(50)
    }
  })

  test('alpha 输出 rgba / hsla', () => {
    const f = formatColor(parseColor('#1e80ff80').color)
    expect(f.rgb).toContain('rgba(')
    expect(f.hex).toBe('#1e80ff80')
  })
})

// 辅助：复用模块内的 rgbToHsl（通过 parseColor→formatColor 链路间接已测，这里直接构造）
function rgbToHslOf(color) {
  const f = formatColor(color)
  const m = f.hsl.match(/hsl\((\d+), (\d+)%, (\d+)%\)/)
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) }
}
