import { describe, expect, test } from 'vitest'
import {
  byteLen,
  buildRenderRows,
  computeFolds,
  escapeJsonText,
  formatJson,
  highlightJson,
  lint,
  rootSummary,
  unescapeJsonText,
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

describe('性能与边界（PRD §5 性能指标）', () => {
  test('1MB JSON 校验 + 格式化 ≤ 1 秒', () => {
    const big = JSON.stringify({
      items: Array.from({ length: 20000 }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        tags: ['a', 'b'],
        meta: { ok: true, score: i * 0.5, desc: `描述文本 ${i}` },
      })),
    })
    expect(byteLen(big)).toBeGreaterThan(1024 * 1024) // 确保用例本身超 1MB
    const t0 = performance.now()
    const r = formatJson(big, '2')
    const dt = performance.now() - t0
    expect(r.ok).toBe(true)
    expect(dt).toBeLessThan(1000)
  })

  test('大 JSON 末尾缺失括号的定位', () => {
    const big = JSON.stringify({ items: Array.from({ length: 5000 }, (_, i) => ({ id: i })) })
    const broken = big.slice(0, -1) // 去掉最后的 }
    const r = lint(broken)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('没有闭合')
  })

  test('空数组 / 空对象 / 纯标量', () => {
    expect(formatJson('[]', '2').ok).toBe(true)
    expect(formatJson('{}', '2').ok).toBe(true)
    expect(formatJson('42', '2').ok).toBe(true)
    expect(formatJson('"str"', '2').ok).toBe(true)
    expect(formatJson('null', '2').ok).toBe(true)
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

describe('行渲染模型 buildRenderRows（W4 真机反馈：3MB 折叠展开错乱回归）', () => {
  const LINES = [
    '[',
    '  {',
    '    "x": 113.47,',
    '  },',
    '  {',
    '    "x": 113.47,',
    '  },',
    '  {',
    '    "x": 113.47,',
    '  }',
    ']',
  ]
  const folds = computeFolds(LINES)

  test('展开态：行号连续、每个节点起始行 foldable（含根数组）', () => {
    const rows = buildRenderRows(LINES, folds, new Set(), highlightJson)
    expect(rows.map((r) => r.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    // 可折叠起始行：根数组（行 1）+ 三个对象（行 2/5/8）
    expect(rows.filter((r) => r.foldable).map((r) => r.no)).toEqual([1, 2, 5, 8])
    expect(rows.every((r) => !r.folded)).toBe(true)
  })

  test('折叠态：标记行行号 = 起始行（回归：此前显示为收尾行 + 1）', () => {
    const collapsed = new Set([1]) // 折叠 0-based 1（行 2 的对象，2→4）
    const rows = buildRenderRows(LINES, folds, collapsed, highlightJson)
    const marker = rows.find((r) => r.folded)
    expect(marker.no).toBe(2) // 起始行；此前错显为 4（收尾行 + 1）
    expect(marker.opener).toBe(1)
    expect(marker.close).toBe(3)
    // 隐藏 2 行（0-based 2），收尾行内联显示
    expect(rows.map((r) => r.no)).toEqual([1, 2, 5, 6, 7, 8, 9, 10, 11])
  })

  test('折叠标记行点击展开：按 opener 定位而非显示行号（真机反馈缺陷回归）', () => {
    const collapsed = new Set([1]) // 折叠 0-based 1（行 2 的对象，2→4）
    const rows = buildRenderRows(LINES, folds, collapsed, highlightJson)
    const marker = rows.find((r) => r.folded)
    // 模拟 toggleFold(row)：folded 行按 opener 定位
    const idx = marker.folded ? marker.opener : marker.no - 1
    expect(idx).toBe(1)
    // 修复前的错误定位：broken 版本标记 no = close + 1 = 4，按 4 - 1 = 3 定位
    // → 命中 0-based 3（收尾行），而非真正的起始行 1
    expect(marker.close + 1 - 1).toBe(3)
    expect(idx).not.toBe(marker.close + 1 - 1)
  })

  test('相邻对象各自折叠互不干扰（连续共享边界行的密集结构）', () => {
    const collapsed = new Set([1, 4]) // 行 2 与行 5 的对象分别折叠
    const rows = buildRenderRows(LINES, folds, collapsed, highlightJson)
    const markers = rows.filter((r) => r.folded)
    expect(markers.length).toBe(2)
    expect(markers[0].no).toBe(2)
    expect(markers[1].no).toBe(5)
    // 两个标记行各自内联收尾，第 3 个对象未折叠正常展开
    expect(rows.map((r) => r.no)).toEqual([1, 2, 5, 8, 9, 10, 11])
  })

  test('截断边界：未闭合的起始行不产生折叠标记', () => {
    const truncated = LINES.slice(0, 6) // 在对象内部截断
    const rows = buildRenderRows(truncated, computeFolds(truncated), new Set(), highlightJson)
    expect(rows.every((r) => !r.folded)).toBe(true)
    expect(rows.every((r) => r.no === r.opener + 1)).toBe(true)
  })

  test('大文件规模：1250 个连续对象（5000 行）折叠切换正确', () => {
    const big = ['[']
    for (let i = 0; i < 1250; i++) {
      big.push('  {', '    "x": 1.5,', '    "y": 2.5,', '    "z": 3.5', i < 1249 ? '  },' : '  }')
    }
    big.push(']')
    const f = computeFolds(big)
    // 排除根数组（0 → 末行），只折叠对象节点
    const allFolded = new Set([...f.keys()].filter((k) => k > 0))
    const rows = buildRenderRows(big, f, allFolded, highlightJson)
    expect(rows.length).toBe(1250 + 2) // 1250 个折叠标记行 + [ 与 ]
    expect(rows[0].no).toBe(1)
    expect(rows[rows.length - 1].no).toBe(big.length)
    // 每个标记行行号 = 起始行 + 1
    expect(rows.slice(1, -1).every((r, i) => r.no === r.opener + 1 && r.folded)).toBe(true)
  })
})

describe('JSON 转义 / 去转义（R1.6）', () => {
  test('转义：中英混排 + 引号 + 换行（计划验收样例）', () => {
    expect(escapeJsonText('他说:"hi"').data).toBe('"他说:\\"hi\\""')
    expect(escapeJsonText('a\nb\tc').data).toBe('"a\\nb\\tc"')
  })

  test('转义：可选去外层引号', () => {
    expect(escapeJsonText('他说:"hi"', { quotes: false }).data).toBe('他说:\\"hi\\"')
    expect(escapeJsonText('hi', { quotes: false }).data).toBe('hi')
    expect(escapeJsonText('hi').data).toBe('"hi"')
  })

  test('转义：控制字符与 Emoji（stringify 保留 Emoji 原字符，转义孤立代理对）', () => {
    expect(escapeJsonText('😀').data).toBe('"😀"')
    expect(escapeJsonText('a\u0001b').data).toBe('"a\\u0001b"')
    expect(escapeJsonText('\uD800').data).toBe('"\\ud800"')
  })

  test('去转义：带外层引号容错（含 \\uXXXX 还原中文）', () => {
    expect(unescapeJsonText('"\\u4f60"').data).toBe('你')
    expect(unescapeJsonText('\\u4f60\\u597d').data).toBe('你好')
  })

  test('去转义：往返一致（中英混排 + 引号 + 换行）', () => {
    const src = '他说:"hi"\n第二行\t制表符\\反斜杠/斜杠'
    const esc = escapeJsonText(src, { quotes: false }).data
    expect(unescapeJsonText(esc).data).toBe(src)
    const escQ = escapeJsonText(src).data
    expect(unescapeJsonText(escQ).data).toBe(src)
  })

  test('去转义：全部转义规则', () => {
    expect(unescapeJsonText('a\\nb\\tc\\rd\\"e\\\\f\\/g\\bh\\fi').data).toBe('a\nb\tc\rd"e\\f/g\bh\fi')
  })

  test('去转义：非法转义序列报错并给出位置', () => {
    const r = unescapeJsonText('abc\\x41def')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('位置 3')
    expect(r.error).toContain('\\x')
  })

  test('去转义：\\u 后不足 4 位报错', () => {
    const r = unescapeJsonText('\\u4f')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('4 位十六进制')
  })

  test('去转义：孤立代理对按字面还原不崩溃', () => {
    expect(unescapeJsonText('\\ud800').data).toBe('\ud800')
  })

  test('去转义：空输入报错', () => {
    expect(unescapeJsonText('').ok).toBe(false)
    expect(unescapeJsonText('  ').ok).toBe(false)
  })

  test('去转义：无引号模式保留首尾空格（审查 M-4 回归）', () => {
    const esc = escapeJsonText('hello ', { quotes: false }).data
    expect(unescapeJsonText(esc).data).toBe('hello ')
    expect(unescapeJsonText(' a\\nb ').data).toBe(' a\nb ')
    // 带引号时引号外空白视为排版噪音，引号内首尾空格保留
    expect(unescapeJsonText('  "a b"  ').data).toBe('a b')
  })

  test('去转义：错误位置为原始输入下标（审查 M-5 回归）', () => {
    // 带引号：原始串中 \ 在下标 3（引号占 0）
    expect(unescapeJsonText('"ab\\x41"').error).toContain('位置 3')
    // 无引号带前导空格：\ 在原始下标 4
    expect(unescapeJsonText('  ab\\x41').error).toContain('位置 4')
    // 无前缀场景不受影响
    expect(unescapeJsonText('ab\\x41').error).toContain('位置 2')
  })
})
