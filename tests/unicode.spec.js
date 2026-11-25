import { describe, expect, test } from 'vitest'
import { convertUnicode, unicodeDecode, unicodeEncode } from '../src/utils/convert/unicode.js'

describe('Unicode 解码（PRD 4.3.7）', () => {
  test('\\uXXXX → 中文', () => {
    expect(unicodeDecode('\\u4f60\\u597d')).toBe('你好')
  })

  test('HTML 实体容错（无分号）', () => {
    expect(unicodeDecode('&#x4f60;&#x597d;')).toBe('你好')
    expect(unicodeDecode('&#20320;&#22909;')).toBe('你好')
  })

  test('混合 ASCII 保留', () => {
    expect(unicodeDecode('hi\\u4f60')).toBe('hi你')
  })

  test('非法码点用替换字符不崩溃', () => {
    expect(unicodeDecode('\\ud800')).toBe('\uFFFD')
    expect(unicodeDecode('&#x110000;')).toBe('\uFFFD')
  })
})

describe('Unicode 编码（PRD 4.3.7）', () => {
  test('中文 → \\uXXXX', () => {
    expect(unicodeEncode('你好')).toBe('\\u4f60\\u597d')
  })

  test('ASCII 保留', () => {
    expect(unicodeEncode('hi')).toBe('hi')
  })

  test('Emoji（BMP 外）拆代理对并往返一致', () => {
    const enc = unicodeEncode('🐼')
    expect(enc).toMatch(/^\\ud8[0-9a-f]{2}\\ud[0-9a-f]{3}$/)
    expect(unicodeDecode(enc)).toBe('🐼')
  })

  test('编解码往返一致', () => {
    const src = '你好 Hello 世界'
    expect(unicodeDecode(unicodeEncode(src))).toBe(src)
  })
})

describe('自动方向（convertUnicode）', () => {
  test('含 \\u 序列 → 解码', () => {
    const r = convertUnicode('\\u4f60\\u597d', 'auto')
    expect(r.direction).toBe('decode')
    expect(r.data).toBe('你好')
  })

  test('普通中文 → 编码', () => {
    const r = convertUnicode('你好', 'auto')
    expect(r.direction).toBe('encode')
    expect(r.data).toBe('\\u4f60\\u597d')
  })

  test('锁定模式', () => {
    expect(convertUnicode('你好', 'encode').data).toBe('\\u4f60\\u597d')
    expect(convertUnicode('\\u4f60', 'decode').data).toBe('你')
  })

  test('空输入', () => {
    expect(convertUnicode('', 'auto').empty).toBe(true)
  })
})
