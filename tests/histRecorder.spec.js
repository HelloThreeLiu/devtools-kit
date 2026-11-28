import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { useHistRecorder } from '../src/utils/histRecorder.js'
import { clearHistory, listHistory, recordHistory } from '../src/utils/db.js'

const TOOL = 't-hist-test'

beforeEach(() => {
  vi.useFakeTimers()
  clearHistory(TOOL)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('历史记录链路（W2 审查 I-1 回归）', () => {
  test('getter 数组形式：入库 input 为首元素字符串，不被隐式 join 污染', async () => {
    const extra = ref(false)
    useHistRecorder(TOOL, () => ['hello', extra.value], (src) => src[0] + (src[1] ? '!' : ''))
    extra.value = true
    await vi.advanceTimersByTimeAsync(1100)
    const list = listHistory(TOOL)
    expect(list.length).toBe(1)
    expect(list[0].input).toBe('hello') // 修复前为 'hello,true'
    expect(list[0].output).toBe('hello!')
  })

  test('同输入切换输出开关：原地更新不新增条目（M-3 语义保留）', async () => {
    const extra = ref(false)
    useHistRecorder(TOOL, () => ['hello', extra.value], (src) => src[0] + (src[1] ? '!' : ''))
    extra.value = true
    await vi.advanceTimersByTimeAsync(1100)
    extra.value = false
    await vi.advanceTimersByTimeAsync(1100)
    const list = listHistory(TOOL)
    expect(list.length).toBe(1)
    expect(list[0].output).toBe('hello')
  })

  test('字符串 source：普通工具路径行为不变', async () => {
    const input = ref('abc')
    useHistRecorder(TOOL, input, (v) => v.toUpperCase())
    input.value = 'xyz'
    await vi.advanceTimersByTimeAsync(1100)
    const list = listHistory(TOOL)
    expect(list.length).toBe(1)
    expect(list[0].input).toBe('xyz')
    expect(list[0].output).toBe('XYZ')
  })

  test('db 层去重：与末条输入+输出相同则跳过，同输入不同输出原地更新', async () => {
    await recordHistory(TOOL, 'abc', 'ABC')
    await recordHistory(TOOL, 'abc', 'ABC')
    expect(listHistory(TOOL).length).toBe(1)
    // 同输入、输出变化 → 原地更新（切换输出开关后重录的语义）
    await recordHistory(TOOL, 'abc', 'ABCD')
    let list = listHistory(TOOL)
    expect(list.length).toBe(1)
    expect(list[0].output).toBe('ABCD')
    // 不同输入 → 正常新增
    await recordHistory(TOOL, 'xyz', 'XYZ')
    list = listHistory(TOOL)
    expect(list.length).toBe(2)
    expect(list[0].input).toBe('xyz')
  })
})
