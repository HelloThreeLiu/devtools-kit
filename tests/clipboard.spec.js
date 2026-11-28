import { describe, expect, test } from 'vitest'
import { copyText, normalizeCopyText } from '../src/utils/clipboard.js'

describe('复制内容统一规整（R1.1：UUID 复制带隐形回车反馈）', () => {
  test('去除首尾空白与换行', () => {
    expect(normalizeCopyText('  hello  ')).toBe('hello')
    expect(normalizeCopyText('\n 550e8400-e29b-41d4-a716-446655440000\r\n')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(normalizeCopyText('\t9\n')).toBe('9')
  })

  test('中间空白不受影响', () => {
    expect(normalizeCopyText('a b\nc')).toBe('a b\nc')
  })

  test('空值归一为空字符串', () => {
    expect(normalizeCopyText(null)).toBe('')
    expect(normalizeCopyText(undefined)).toBe('')
    expect(normalizeCopyText('')).toBe('')
    expect(normalizeCopyText(0)).toBe('0')
  })

  test('非字符串入参转字符串后规整', () => {
    expect(normalizeCopyText(123)).toBe('123')
  })

  test('copyText 在无宿主环境（node 测试环境）下不抛错', async () => {
    // mock utools.copyText 返回 false → 走浏览器降级路径（无 DOM 时静默失败）
    const ok = await copyText('  hello  ', '结果')
    expect(ok).toBe(false)
  })
})
