import { describe, expect, test } from 'vitest'
import { convertBase64, decodeB64, encodeB64, looksLikeB64 } from '../src/utils/convert/base64.js'

describe('Base64 编码（PRD 4.3.2）', () => {
  test('hello → aGVsbG8=，反向可还原', () => {
    expect(encodeB64('hello').data).toBe('aGVsbG8=')
    expect(decodeB64('aGVsbG8=').data).toBe('hello')
  })

  test('中文与 Emoji UTF-8 往返一致', () => {
    const src = '你好，DevTools Kit 🐼'
    const enc = encodeB64(src)
    expect(decodeB64(enc.data).data).toBe(src)
  })

  test('URL-Safe 与缺省 padding 容错', () => {
    // 「你」→ 5L2g5aW9；无 padding 形式也应可解码
    expect(decodeB64('5L2g5aW9').data).toBe('你好')
    expect(decodeB64('aGVsbG8').data).toBe('hello')
    expect(decodeB64('5L2g5aW9==').ok).toBe(false) // 已完整编码再补 = 属非法输入，正确拒绝
  })

  test('非法字符报错', () => {
    const r = decodeB64('ab!c')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('非法字符')
  })

  test('长度非法报错', () => {
    expect(decodeB64('abcde').ok).toBe(false) // 5 位
    expect(decodeB64('a').ok).toBe(false)
  })

  test('空输入', () => {
    expect(decodeB64('').ok).toBe(false)
    expect(convertBase64('', 'auto').empty).toBe(true)
  })
})

describe('自动识别（PRD 4.3.2）', () => {
  test('Base64 特征内容默认解码', () => {
    const r = convertBase64('aGVsbG8=', 'auto')
    expect(r.direction).toBe('decode')
    expect(r.data).toBe('hello')
  })

  test('普通文本默认编码', () => {
    const r = convertBase64('你好', 'auto')
    expect(r.direction).toBe('encode')
    expect(r.data).toBe('5L2g5aW9')
  })

  test('锁定编码模式不受自动识别影响', () => {
    const r = convertBase64('aGVsbG8=', 'encode')
    expect(r.direction).toBe('encode')
    expect(r.data).toBe('YUdWc2JHOD0=')
  })

  test('looksLikeB64 边界', () => {
    expect(looksLikeB64('aGVsbG8=')).toBe(true)
    expect(looksLikeB64('你好')).toBe(false)
    expect(looksLikeB64('abc')).toBe(false) // <4 位
    expect(looksLikeB64('a')).toBe(false)
  })
})
