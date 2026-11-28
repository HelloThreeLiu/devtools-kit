import { describe, expect, test } from 'vitest'
import { decodeB32, encodeB32 } from '../src/utils/convert/base32.js'

describe('Base32 编码（RFC 4648，R1.7）', () => {
  test('RFC 4648 官方向量', () => {
    expect(encodeB32('').data).toBe('')
    expect(encodeB32('f').data).toBe('MY======')
    expect(encodeB32('fo').data).toBe('MZXQ====')
    expect(encodeB32('foo').data).toBe('MZXW6===')
    expect(encodeB32('foob').data).toBe('MZXW6YQ=')
    expect(encodeB32('fooba').data).toBe('MZXW6YTB')
    expect(encodeB32('foobar').data).toBe('MZXW6YTBOI======')
  })

  test('计划验收样例：hello → NBSWY3DP', () => {
    expect(encodeB32('hello').data).toBe('NBSWY3DP')
  })

  test('无填充输出（padding: false）', () => {
    expect(encodeB32('hello', { padding: false }).data).toBe('NBSWY3DP')
    expect(encodeB32('f', { padding: false }).data).toBe('MY')
    expect(encodeB32('fo', { padding: false }).data).toBe('MZXQ')
  })

  test('中文 UTF-8 往返一致', () => {
    const src = '你好，DevTools Kit 🐼'
    const enc = encodeB32(src).data
    expect(decodeB32(enc).data).toBe(src)
  })

  test('空输入', () => {
    expect(encodeB32('').data).toBe('')
    expect(decodeB32('').ok).toBe(false)
  })
})

describe('Base32 解码（R1.7）', () => {
  test('带/不带 padding 均可解码（容错）', () => {
    expect(decodeB32('NBSWY3DP').data).toBe('hello')
    expect(decodeB32('NBSWY3DP====').data).toBe('hello')
    expect(decodeB32('MZXW6YTB').data).toBe('fooba')
    expect(decodeB32('MZXW6YTBOI').data).toBe('foobar') // 缺失 padding 也接受
  })

  test('小写字母自动归一', () => {
    expect(decodeB32('nbswy3dp').data).toBe('hello')
    expect(decodeB32('NbSwY3dP').data).toBe('hello')
  })

  test('空白与换行剥离（邮件折叠排版容错）', () => {
    expect(decodeB32('NBSW Y3DP').data).toBe('hello')
    expect(decodeB32('NBSW\nY3DP\r\n').data).toBe('hello')
  })

  test('非法字符报错含原因（0/1/8/9 不在字母表）', () => {
    const r = decodeB32('NBSWY3D0')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('0')
    expect(r.error).toContain('A–Z')
  })

  test('长度不合法报错（余 1/3/6）', () => {
    expect(decodeB32('A').ok).toBe(false)
    expect(decodeB32('ABC').ok).toBe(false)
    expect(decodeB32('ABCDEF').ok).toBe(false)
    expect(decodeB32('AB').ok).toBe(true) // 余 2 合法
    expect(decodeB32('ABCDEFG').ok).toBe(true) // 余 7 合法
  })

  test('解码失败（非合法 UTF-8 结果）报错', () => {
    // 'E///////' 解出高字节 0x80… 开头，非合法 UTF-8
    expect(decodeB32('EA//////').ok).toBe(false)
  })

  test('auto 无自动识别：解码方向显式指定', () => {
    // 显式解码方向对普通文本也按 Base32 校验（与 Base64 的 auto 策略不同，R1.7 计划允许后置）
    expect(decodeB32('hello world').ok).toBe(false)
  })
})
