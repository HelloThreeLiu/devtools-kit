import { describe, expect, test } from 'vitest'
import { decodeUrl, encodeUrl, parseUrl } from '../src/utils/convert/urlCodec.js'

describe('URL 编码（PRD 4.3.3）', () => {
  test('Component 编码中文', () => {
    const r = encodeUrl('你好', 'component')
    expect(r.data).toBe('%E4%BD%A0%E5%A5%BD')
  })

  test('URI 模式保留结构字符', () => {
    const r = encodeUrl('https://a.com/?kw=你好', 'uri')
    expect(r.data).toBe('https://a.com/?kw=%E4%BD%A0%E5%A5%BD')
  })

  test('Component 编码保留字符也被转义', () => {
    const r = encodeUrl('a b&c=d', 'component')
    expect(r.data).toBe('a%20b%26c%3Dd')
  })
})

describe('URL 解码（PRD 4.3.3）', () => {
  test('解码 % 转义序列', () => {
    expect(decodeUrl('%E4%BD%A0%E5%A5%BD').data).toBe('你好')
  })

  test('非法 % 序列报错不崩溃', () => {
    const r = decodeUrl('%E4%BD%A0%')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('非法的 % 转义序列')
  })

  test('非法 UTF-8 字节组合报错', () => {
    const r = decodeUrl('%FF')
    expect(r.ok).toBe(false)
  })

  test('编解码往返一致', () => {
    const src = 'https://a.com/?kw=你好&q=100%'
    const enc = encodeUrl(src, 'component')
    expect(decodeUrl(enc.data).data).toBe(src)
  })
})

describe('URL 结构化解析（PRD 4.3.3）', () => {
  test('完整 URL 解析出协议/主机/路径/参数', () => {
    const r = parseUrl('https://a.com/api?kw=你好&n=1')
    expect(r).not.toBeNull()
    expect(r.protocol).toBe('https')
    expect(r.hostname).toBe('a.com')
    expect(r.pathname).toBe('/api')
    expect(r.params).toEqual([
      ['kw', '你好'],
      ['n', '1'],
    ])
  })

  test('http 默认端口标注', () => {
    const r = parseUrl('http://a.com/')
    expect(r.port).toContain('80')
  })

  test('非 URL 文本返回 null（按纯文本处理）', () => {
    expect(parseUrl('hello world')).toBeNull()
    expect(parseUrl('%E4%BD%A0%E5%A5%BD')).toBeNull()
  })
})
