import { describe, expect, test } from 'vitest'
import {
  computeFolds,
  formatJson,
  highlightJson,
  lint,
} from '../src/utils/convert/jsonFormat.js'

const esc = (s) => s

describe('lint 自写校验器（技术设计 §11.5）', () => {
  test('合法 JSON 通过', () => {
    expect(lint('{"a":1}').ok).toBe(true)
    expect(lint('[1, 2, {"b": [true, null]}]').ok).toBe(true)
    expect(lint(' {} ').ok).toBe(true)
  })

  test('内容为空报错', () => {
    const r = lint('   ')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('内容为空')
  })

  test('多余逗号：对象尾随逗号', () => {
    const r = lint('{"a":1,}')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('多了一个逗号')
  })

  test('缺少冒号', () => {
    const r = lint('{"a" 1}')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('缺少冒号')
  })

  test('缺少逗号', () => {
    const r = lint('{"a":1 "b":2}')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('应为逗号')
  })

  test('未闭合括号给出需要补上的符号', () => {
    const r = lint('{"a":[1')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('2 个括号')
    expect(r.reason).toContain(']')
  })

  test('字符串未闭合', () => {
    const r = lint('{"a')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('没有闭合')
  })

  test('非法转义序列', () => {
    const r = lint('"\\q"')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('无效的转义')
  })

  test('\\u 转义需要 4 位十六进制', () => {
    expect(lint('"\\u00e1"').ok).toBe(true)
    const r = lint('"\\u00zz"')
    expect(r.reason).toContain('4 位十六进制')
  })

  test('未转义控制字符', () => {
    const r = lint('"a\nb"')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('控制字符')
  })

  test('非法字面量定位到字面量开头', () => {
    const r = lint('[tru]')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('这里应为 true')
    expect(r.col).toBe(2) // 指向 t
  })

  test('数字前导零报错', () => {
    const r = lint('[01]')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('前导零')
  })

  test('顶层多余内容', () => {
    const r = lint('{"a":1} xyz')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('多余的内容')
  })

  test('行号列号正确（多行输入）', () => {
    const r = lint('{\n  "a": 1,\n  "b" 2\n}')
    expect(r.ok).toBe(false)
    expect(r.line).toBe(3)
    expect(r.col).toBe(7) // 指向 "2"
  })
})

describe('formatJson（PRD 4.3.4）', () => {
  const src = '{"a":1,"b":[true,null]}'

  test('2 空格缩进', () => {
    const r = formatJson(src, '2')
    expect(r.ok).toBe(true)
    expect(r.data.split('\n')[1]).toBe('  "a": 1,')
  })

  test('压缩为一行', () => {
    const r = formatJson(src + '  ', 'min')
    expect(r.data).toBe('{"a":1,"b":[true,null]}')
  })

  test('校验失败返回定位', () => {
    const r = formatJson('{"a":1,}', '2')
    expect(r.ok).toBe(false)
    expect(r.line).toBe(1)
  })
})

describe('高亮与折叠', () => {
  test('highlightJson 输出含 tk-* 标签且已转义', () => {
    const html = highlightJson('{"k":"<b>"}')
    expect(html).toContain('tk-key')
    expect(html).toContain('tk-str')
    expect(html).not.toContain('<b>') // 原始 HTML 被转义
  })

  test('computeFolds 记录区间', () => {
    const lines = ['{', '  "a": [', '    1,', '    2', '  ]', '}']
    const m = computeFolds(lines)
    expect(m.get(0)).toBe(5)
    expect(m.get(1)).toBe(4)
  })
})
