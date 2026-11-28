import { describe, expect, test } from 'vitest'
import {
  UNKNOWN_MIME,
  analyzeDecodeInput,
  b64ToBytes,
  buildDataUrl,
  bytesToB64,
  extFromMime,
  formatBytes,
  mimeFromExt,
  parseDataUrl,
  SIZE_WARN_BYTES,
  sniffMime,
} from '../src/utils/convert/fileB64.js'

const bytesOf = (s) => [...s].map((c) => c.charCodeAt(0))

describe('MIME 推断表（R1.5 验收：纯函数单测）', () => {
  test('计划规定的扩展名全覆盖', () => {
    expect(mimeFromExt('a.png')).toBe('image/png')
    expect(mimeFromExt('a.jpg')).toBe('image/jpeg')
    expect(mimeFromExt('a.jpeg')).toBe('image/jpeg')
    expect(mimeFromExt('a.gif')).toBe('image/gif')
    expect(mimeFromExt('a.webp')).toBe('image/webp')
    expect(mimeFromExt('a.svg')).toBe('image/svg+xml')
    expect(mimeFromExt('a.bmp')).toBe('image/bmp')
    expect(mimeFromExt('a.ico')).toBe('image/x-icon')
  })

  test('大小写不敏感、未知扩展与无扩展返回 null', () => {
    expect(mimeFromExt('IMG.PNG')).toBe('image/png')
    expect(mimeFromExt('archive.tar')).toBeNull()
    expect(mimeFromExt('noext')).toBeNull()
    expect(mimeFromExt('')).toBeNull()
    expect(mimeFromExt('.gitignore')).toBeNull() // gitignore 不在推断表内
  })

  test('MIME → 建议扩展名（另存为默认名）', () => {
    expect(extFromMime('image/png')).toBe('png')
    expect(extFromMime('image/jpeg')).toBe('jpg')
    expect(extFromMime('image/svg+xml')).toBe('svg')
    expect(extFromMime(UNKNOWN_MIME)).toBe('bin')
    expect(extFromMime('')).toBe('bin')
  })
})

describe('魔数嗅探（R1.5 验收：裸 Base64 无 MIME 时凭魔数识别）', () => {
  test('PNG / JPG / GIF / WEBP / BMP / ICO', () => {
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]))).toBe('image/png')
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffMime(new Uint8Array(bytesOf('GIF89a...')))).toBe('image/gif')
    expect(sniffMime(new Uint8Array(bytesOf('GIF87a...')))).toBe('image/gif')
    expect(sniffMime(new Uint8Array(bytesOf('RIFF1234WEBPVP8 ')))).toBe('image/webp')
    expect(sniffMime(new Uint8Array(bytesOf('BM…binary')))).toBe('image/bmp')
    expect(sniffMime(new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01]))).toBe('image/x-icon')
  })

  test('SVG 按文本特征识别（含 XML 声明与前导空白）', () => {
    expect(sniffMime(new Uint8Array(bytesOf('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))).toBe('image/svg+xml')
    expect(sniffMime(new Uint8Array(bytesOf('<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>')))).toBe('image/svg+xml')
    expect(sniffMime(new Uint8Array(bytesOf('\n\n  <svg xmlns="…"></svg>')))).toBe('image/svg+xml')
  })

  test('非图片与截断头部返回 null', () => {
    expect(sniffMime(new Uint8Array(bytesOf('hello world, plain text')))).toBeNull()
    expect(sniffMime(new Uint8Array(bytesOf('<xml-not-svg')))).toBeNull()
    expect(sniffMime(new Uint8Array(bytesOf('<?xml version="1.0"?><rss/>')))).toBeNull()
    expect(sniffMime(new Uint8Array([0x89, 0x50]))).toBeNull() // PNG 签名截断
    expect(sniffMime(new Uint8Array(bytesOf('RIFF1234')))).toBeNull() // 无 WEBP 标记
    expect(sniffMime(new Uint8Array([]))).toBeNull()
  })

  test('WEBP 必须同时满足 RIFF 前缀与 WEBP 标记', () => {
    expect(sniffMime(new Uint8Array(bytesOf('RIFF1234ABCD')))).toBeNull()
  })
})

describe('Data URL 构造与解析', () => {
  test('构造含正确 MIME（竞品翻车点：webp/svg 需正确 MIME 渲染）', () => {
    expect(buildDataUrl('image/webp', 'AAA')).toBe('data:image/webp;base64,AAA')
    expect(buildDataUrl('image/svg+xml', 'AAA')).toBe('data:image/svg+xml;base64,AAA')
    expect(buildDataUrl('', 'AAA')).toBe(`data:${UNKNOWN_MIME};base64,AAA`)
  })

  test('解析 Data URL（容忍空白与 charset 参数）', () => {
    expect(parseDataUrl('data:image/png;base64,AAA\nBBB')).toEqual({ mime: 'image/png', base64: 'AAABBB' })
    expect(parseDataUrl('data:image/gif;charset=utf8;base64,ZZ==')).toEqual({ mime: 'image/gif', base64: 'ZZ==' })
    // URL 编码（非 base64）形态返回 null
    expect(parseDataUrl('data:text/plain;charset=utf-8,%E4%BD%A0')).toBeNull()
    expect(parseDataUrl('not-a-data-url')).toBeNull()
    expect(parseDataUrl('')).toBeNull()
  })
})

describe('字节 ↔ Base64（分块）', () => {
  test('小数据往返一致（含中文与二进制）', () => {
    const src = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe])
    const b64 = bytesToB64(src)
    expect([...b64ToBytes(b64)]).toEqual([...src])
  })

  test('超分块边界大数据往返一致（2×0x8000+7 字节）', () => {
    const big = new Uint8Array(2 * 0x8000 + 7)
    for (let i = 0; i < big.length; i++) big[i] = i % 251
    const b64 = bytesToB64(big)
    const back = b64ToBytes(b64)
    expect(back.length).toBe(big.length)
    expect([...back]).toEqual([...big])
  })

  test('「你好」字节往返', () => {
    const bytes = b64ToBytes('5L2g5aW9')
    expect([...bytes]).toEqual([0xe4, 0xbd, 0xa0, 0xe5, 0xa5, 0xbd])
    expect(bytesToB64(bytes)).toBe('5L2g5aW9')
  })
})

describe('解码统一入口 analyzeDecodeInput', () => {
  const PNG_1X1_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  test('Data URL：直接取 MIME 不嗅探', () => {
    const r = analyzeDecodeInput(`data:image/jpeg;base64,${PNG_1X1_B64}`)
    expect(r.ok).toBe(true)
    expect(r.source).toBe('dataurl')
    expect(r.mime).toBe('image/jpeg')
    expect(r.known).toBe(true)
    expect(r.byteLen).toBeGreaterThan(0)
  })

  test('裸 Base64：魔数嗅探 PNG', () => {
    const r = analyzeDecodeInput(PNG_1X1_B64)
    expect(r.ok).toBe(true)
    expect(r.source).toBe('sniff')
    expect(r.mime).toBe('image/png')
    expect(r.known).toBe(true)
  })

  test('裸 Base64 携带换行/空白：剥离后嗅探', () => {
    const folded = PNG_1X1_B64.match(/.{1,20}/g).join('\n')
    const r = analyzeDecodeInput(folded)
    expect(r.ok).toBe(true)
    expect(r.mime).toBe('image/png')
  })

  test('非图片二进制：解出字节但标记 unknown，回退 octet-stream', () => {
    const b64 = bytesToB64(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])) // ZIP 头（不在嗅探表）
    const r = analyzeDecodeInput(b64)
    expect(r.ok).toBe(true)
    expect(r.known).toBe(false)
    expect(r.mime).toBe(UNKNOWN_MIME)
  })

  test('非法 Base64 报错', () => {
    expect(analyzeDecodeInput('ab!c').ok).toBe(false)
    expect(analyzeDecodeInput('aGVsbG8=x').ok).toBe(false) // 尾垃圾（严格校验）
    expect(analyzeDecodeInput('5L2g=5aW9').ok).toBe(false) // 中间 =（严格校验）
  })

  test('URL 编码风味 Data URL 给出专属提示', () => {
    const r = analyzeDecodeInput('data:text/plain;charset=utf-8,%E4%BD%A0')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Base64')
  })

  test('空输入 empty 标记', () => {
    expect(analyzeDecodeInput('').empty).toBe(true)
    expect(analyzeDecodeInput('   ').empty).toBe(true)
  })

  test('体积警告阈值常量为 10 MB', () => {
    expect(SIZE_WARN_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('展示辅助', () => {
  test('formatBytes 人性化', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB')
    expect(formatBytes(3145728)).toBe('3.0 MB')
  })
})
