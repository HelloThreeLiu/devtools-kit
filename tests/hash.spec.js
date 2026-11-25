import { describe, expect, test } from 'vitest'
import { md5Hex } from '../src/utils/md5.js'
import mockServices from '../src/utils/services-mock.js'

describe('MD5 纯 JS 实现（RFC 1321 标准向量）', () => {
  test('空串', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  test('abc（PRD 4.3.6 验收）', () => {
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  test('中文（UTF-8 编码，与 node:crypto 对齐）', () => {
    expect(md5Hex('你好')).toBe('7eca689f0d3389d9dea66ae112e5cfd7')
  })

  test('跨 64 字节块的长文本', () => {
    const r1 = md5Hex('a'.repeat(64))
    const r2 = md5Hex('a'.repeat(128))
    expect(r1).not.toBe(r2)
    expect(r1).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('services.hash（mock：Web Crypto + MD5）', () => {
  const VECTORS = {
    '': {
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sha512: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
    },
    abc: {
      md5: '900150983cd24fb0d6963f7d28e17f72',
      sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      sha512: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    },
  }

  for (const [text, expected] of Object.entries(VECTORS)) {
    for (const algo of ['md5', 'sha1', 'sha256', 'sha512']) {
      test(`${algo}("${text || '空串'}") 标准向量`, async () => {
        expect(await mockServices.hash(text, algo)).toBe(expected[algo])
      })
    }
  }

  test('中文 UTF-8 编码后哈希', async () => {
    expect(await mockServices.hash('你好', 'sha256')).toBe(
      await mockServices.hash('你好', 'sha256'),
    )
    expect(await mockServices.hash('你好', 'md5')).toMatch(/^[0-9a-f]{32}$/)
  })

  test('不支持的算法抛错', async () => {
    await expect(mockServices.hash('abc', 'sha3')).rejects.toThrow()
  })
})
