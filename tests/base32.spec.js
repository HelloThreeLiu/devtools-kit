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

  test('中间补位符报错文案区分场景（审查 M-8）', () => {
    const r = decodeB32('NBSW=Y3DP')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('只能出现在末尾')
  })

  test('大写展开字符（ﬁ→FI / ß→SS）不得幻影合法（审查 M-2）', () => {
    expect(decodeB32('ﬁ').ok).toBe(false)
    expect(decodeB32('ß').ok).toBe(false)
    expect(decodeB32('ﬀ').ok).toBe(false)
  })

  test('长度不合法报错（余 1/3/6）', () => {
    expect(decodeB32('A').ok).toBe(false)
    expect(decodeB32('ABC').ok).toBe(false)
    expect(decodeB32('ABCDEF').ok).toBe(false)
    expect(decodeB32('AB').ok).toBe(true) // 余 2 合法
    expect(decodeB32('ABCDEFG').ok).toBe(true) // 余 7 合法
  })

  test('解码失败：全合法字符但结果非合法 UTF-8（审查 M-6 修正：原用例实际失败于字符集）', () => {
    // 'QQQQQQQQ' 全部在字母表内 → 解出 84 81 08 42 10（0x84 为非法 UTF-8 首字节）
    const r = decodeB32('QQQQQQQQ')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('UTF-8')
  })

  test('普通文本在显式解码方向按 Base32 校验并失败于 UTF-8 还原（无自动识别）', () => {
    // 'hello world' 剥空格后 'helloworld' 字符集合法 → 最终失败于 UTF-8 校验而非字符集
    expect(decodeB32('hello world').ok).toBe(false)
  })

  test('余数 4/5 合法路径可解码（审查 M-7 补充）', () => {
    expect(decodeB32('ABCD').ok).toBe(true) // 余 4 → 2 字节
    expect(decodeB32('ABCDE').ok).toBe(true) // 余 5 → 3 字节
    expect(decodeB32(encodeB32('ab', { padding: false }).data).data).toBe('ab')
    expect(decodeB32(encodeB32('abc', { padding: false }).data).data).toBe('abc')
  })

  test('零宽字符剥离（审查 M-7 补充）', () => {
    expect(decodeB32('NBSW\u200BY3DP').data).toBe('hello')
    expect(decodeB32('NBSWY3DP\u2060').data).toBe('hello')
  })
})
