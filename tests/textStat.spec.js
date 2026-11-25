import { describe, expect, test } from 'vitest'
import { textStats } from '../src/utils/convert/textStat.js'

describe('文本统计（PRD 4.5.3）', () => {
  test('空文本', () => {
    expect(textStats('')).toEqual({
      chars: 0,
      noSpace: 0,
      words: 0,
      lines: 0,
      bytes: 0,
      latinWords: 0,
      cjkChars: 0,
    })
  })

  test('英文词数', () => {
    const r = textStats('hello world foo')
    expect(r.words).toBe(3)
    expect(r.chars).toBe(15)
    expect(r.noSpace).toBe(13)
    expect(r.lines).toBe(1)
    expect(r.bytes).toBe(15)
  })

  test('中文按字计词', () => {
    const r = textStats('你好世界')
    expect(r.cjkChars).toBe(4)
    expect(r.words).toBe(4)
    expect(r.chars).toBe(4)
    expect(r.bytes).toBe(12) // 每个汉字 3 字节
  })

  test('中英混合', () => {
    const r = textStats('你好 world')
    expect(r.words).toBe(3) // 你、好 + world
    expect(r.chars).toBe(8)
  })

  test('多行行数', () => {
    expect(textStats('a\nb\nc').lines).toBe(3)
    expect(textStats('a\n').lines).toBe(2) // 尾随换行算一行
  })

  test('UTF-8 字节数（中文 3 字节 / Emoji 4 字节）', () => {
    expect(textStats('a你').bytes).toBe(4) // 1 + 3
    expect(textStats('🐼').bytes).toBe(4)
  })

  test('字符数按码点计（Emoji 算 1 个字符）', () => {
    expect(textStats('🐼').chars).toBe(1)
  })
})
