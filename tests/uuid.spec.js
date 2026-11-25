import { describe, expect, test } from 'vitest'
import { formatUuid, generateUuids, uuidV4, UUID_V4_RE } from '../src/utils/convert/uuid.js'

/** 可复现的确定性随机源（测试用） */
function seqRandom(seed = 0x2f6e2b1) {
  let s = seed
  return (len) => {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0
      out[i] = s & 0xff
    }
    return out
  }
}

describe('UUID v4（PRD 4.5.1）', () => {
  test('格式符合 RFC 4122：版本位 4、变体位 8/9/a/b', () => {
    for (let i = 0; i < 200; i++) {
      expect(uuidV4()).toMatch(UUID_V4_RE)
    }
  })

  test('批量 100 个无重复且全部合法', () => {
    const list = generateUuids(100)
    expect(list.length).toBe(100)
    expect(new Set(list).size).toBe(100)
    list.forEach((u) => expect(u).toMatch(UUID_V4_RE))
  })

  test('数量越界收敛到 1–100', () => {
    expect(generateUuids(0).length).toBe(1)
    expect(generateUuids(-5).length).toBe(1)
    expect(generateUuids(1000).length).toBe(100)
    expect(generateUuids('abc').length).toBe(1)
  })

  test('格式变换：无连字符 / 大写', () => {
    const u = '550e8400-e29b-41d4-a716-446655440000'
    expect(formatUuid(u, 'none')).toBe('550e8400e29b41d4a716446655440000')
    expect(formatUuid(u, 'upper')).toBe('550E8400-E29B-41D4-A716-446655440000') // 大写保留连字符
    expect(formatUuid(u, 'standard')).toBe(u)
  })

  test('生成结果应用格式', () => {
    const [u] = generateUuids(1, 'upper', seqRandom())
    expect(u).toBe(u.toUpperCase()) // 大写
    const [v] = generateUuids(1, 'none', seqRandom())
    expect(v).not.toContain('-') // 无连字符
  })

  test('确定性随机源下输出可复现', () => {
    const a = uuidV4(seqRandom(1))
    const b = uuidV4(seqRandom(1))
    expect(a).toBe(b)
  })
})
