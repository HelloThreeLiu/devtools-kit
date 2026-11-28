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

describe('URL 智能模式（R1.1 产品决策）', () => {
  test('http(s):// 开头 → encodeURI 保留 URL 结构，仅转义非结构字符', () => {
    const r = encodeUrl('https://a.com/?kw=你好', 'smart')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('https://a.com/?kw=%E4%BD%A0%E5%A5%BD')
    expect(r.resolvedMode).toBe('uri')
  })

  test('非 http(s):// 开头 → encodeURIComponent 全编码', () => {
    const r = encodeUrl('a b&c=d', 'smart')
    expect(r.data).toBe('a%20b%26c%3Dd')
    expect(r.resolvedMode).toBe('component')
  })

  test('智能模式对 http 大小写不敏感', () => {
    expect(encodeUrl('HTTPS://a.com/ x', 'smart').resolvedMode).toBe('uri')
    expect(encodeUrl('Http://a.com/?q=x y', 'smart').data).toBe('Http://a.com/?q=x%20y')
  })

  test('localhost / 带路径 URL 走 encodeURI', () => {
    const r = encodeUrl('http://localhost:5173/api/测试?q=值', 'smart')
    expect(r.resolvedMode).toBe('uri')
    expect(r.data).toBe('http://localhost:5173/api/%E6%B5%8B%E8%AF%95?q=%E5%80%BC')
  })

  test('智能模式输入首尾空白按粘贴语义处理（审查 M-1）', () => {
    expect(encodeUrl(' https://a.com/?kw=你好', 'smart').data).toBe(
      'https://a.com/?kw=%E4%BD%A0%E5%A5%BD',
    )
    expect(encodeUrl('https://a.com\n', 'smart').data).toBe('https://a.com')
    expect(encodeUrl('  hello world  ', 'smart').data).toBe('hello%20world')
  })

  test('默认模式仍为 component（不改变既有调用方行为）', () => {
    expect(encodeUrl('https://a.com/?kw=你好').data).toBe(
      'https%3A%2F%2Fa.com%2F%3Fkw%3D%E4%BD%A0%E5%A5%BD',
    )
  })
})

describe('URL 解码（PRD 4.3.3）', () => {
  test('解码 % 转义序列', () => {
    expect(decodeUrl('%E4%BD%A0%E5%A5%BD').data).toBe('你好')
  })

  test('编解码往返一致', () => {
    const src = 'https://a.com/?kw=你好&q=100%'
    const enc = encodeUrl(src, 'component')
    expect(decodeUrl(enc.data).data).toBe(src)
  })
})

describe('URL 宽容解码（R1.1：非法 % 序列不再整体失败）', () => {
  test('裸 % 按字面保留并标注 partial（反馈案例「中文20%英文」）', () => {
    const r = decodeUrl('中文20%英文')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('中文20%英文')
    expect(r.partial).toBe(true)
  })

  test('合法片段正常解码，非法片段字面保留', () => {
    const r = decodeUrl('%E4%BD%A0%ZZ%E5%A5%BD')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('你%ZZ好')
    expect(r.partial).toBe(true)
  })

  test('截断的尾部 % 字面保留', () => {
    const r = decodeUrl('%E4%BD%A0%')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('你%')
    expect(r.partial).toBe(true)
  })

  test('非法 UTF-8 字节（%FF）字面保留，partial 标注', () => {
    const r = decodeUrl('%FF')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('%FF')
    expect(r.partial).toBe(true)
  })

  test('多字节序列被非法字节打断：合法前缀解码、剩余字面保留', () => {
    const r = decodeUrl('%E4%BD%A0%FF%E5%A5%BD')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('你%FF好')
    expect(r.partial).toBe(true)
  })

  test('连续 %XX 中混入裸 %：合法部分解码', () => {
    const r = decodeUrl('100%25%')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('100%%')
    expect(r.partial).toBe(true)
  })

  test('完全无法解码时输出原文并标注 partial', () => {
    const r = decodeUrl('%u4f60%E5%A5')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('%u4f60%E5%A5')
    expect(r.partial).toBe(true)
  })

  test('合法输入不带 partial 标注', () => {
    expect(decodeUrl('%E4%BD%A0%E5%A5%BD').partial).toBeUndefined()
    expect(decodeUrl('plain text').partial).toBeUndefined()
  })

  test('大小写混排 %XX 正常解码（审查 M-7）', () => {
    expect(decodeUrl('%e4%bd%a0%E5%A5%BD').data).toBe('你好')
    expect(decodeUrl('%e4%bd%a0%E5%A5%BD').partial).toBeUndefined()
  })

  test('strict 成功片段与裸 % 混合（审查 M-7）', () => {
    const r = decodeUrl('你%20好%')
    expect(r.ok).toBe(true)
    expect(r.data).toBe('你 好%')
    expect(r.partial).toBe(true)
  })

  test('宽容解码中解码器复用安全：非法序列后紧接合法序列（审查 B-1）', () => {
    // %FF 失败后 %E5%A5%BD 仍须正确解码——若 TextDecoder 复用引入状态污染此处即失败
    expect(decodeUrl('%E4%BD%A0%FF%E5%A5%BD').data).toBe('你%FF好')
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
