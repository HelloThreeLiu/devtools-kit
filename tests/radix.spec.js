import { describe, expect, test } from 'vitest'
import { convertRadix } from '../src/utils/convert/radix.js'

describe('进制转换（PRD 4.3.5）', () => {
  test('255 → 各进制结果', () => {
    const r = convertRadix('255', 10)
    expect(r.ok).toBe(true)
    expect(r.outputs.bin).toBe('11111111')
    expect(r.outputs.oct).toBe('377')
    expect(r.outputs.hex).toBe('ff')
  })

  test('前缀自动识别优先于所选进制', () => {
    const r = convertRadix('0xff', 10)
    expect(r.ok).toBe(true)
    expect(r.base).toBe(16)
    expect(r.detected).toBe(true)
    expect(r.outputs.dec).toBe('255')
    expect(r.warning).toContain('识别到前缀')
  })

  test('0b / 0o 前缀', () => {
    expect(convertRadix('0b101', 10).outputs.dec).toBe('5')
    expect(convertRadix('0o17', 10).outputs.dec).toBe('15')
  })

  test('负数', () => {
    const r = convertRadix('-42', 10)
    expect(r.outputs.hex).toBe('-2a')
    expect(r.outputs.bin).toBe('-101010')
  })

  test('大数 BigInt 精确（PRD 验收：9007199254740993）', () => {
    const r = convertRadix('9007199254740993', 10)
    expect(r.ok).toBe(true)
    expect(r.outputs.dec).toBe('9007199254740993')
    expect(r.warning).toContain('安全整数')
  })

  test('36 进制只读输出', () => {
    expect(convertRadix('255', 10).outputs.b36).toBe('73')
  })

  test('非法字符按所选进制报错', () => {
    const r = convertRadix('129', 2)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('二进制')
  })

  test('16 进制接受字母', () => {
    expect(convertRadix('deadbeef', 16).outputs.hex).toBe('deadbeef')
  })

  test('纯文本报错', () => {
    const r = convertRadix('hello', 10)
    expect(r.ok).toBe(false)
  })

  test('空输入', () => {
    expect(convertRadix('', 10).empty).toBe(true)
  })
})
