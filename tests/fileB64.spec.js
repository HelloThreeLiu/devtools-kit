import { describe, expect, test } from 'vitest'
import {
  UNKNOWN_MIME,
  analyzeDecodeInput,
  asReplayPayload,
  buildDataUrl,
  extFromMime,
  formatBytes,
  mimeFromExt,
  parseDataUrl,
  SIZE_WARN_BYTES,
  sniffMime,
} from '../src/utils/convert/fileB64.js'

const bytesOf = (s) => [...s].map((c) => c.charCodeAt(0))
const b64Of = (bytes) => Buffer.from(bytes).toString('base64')

const PNG_1X1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

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
    // BMP：'BM' + offset 14 的 DIB 头长度（BITMAPINFOHEADER = 40）
    const bmp = [...bytesOf('BM'), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 28, 0, 0, 0, 1, 2, 3]
    bmp[14] = 40
    expect(sniffMime(new Uint8Array(bmp))).toBe('image/bmp')
    // ICO：type=1 且计数合理
    expect(sniffMime(new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0xaa]))).toBe('image/x-icon')
  })

  test('弱签名误判面收紧（审查 M-1）', () => {
    // "BMW owners manual…" 的 Base64：'BM' 命中但 DIB 头不合法 → 不再误判
    expect(sniffMime(new Uint8Array(bytesOf('BMW owners manual for the car')))).toBeNull()
    // 随机二进制命中 ICO 签名但 type/计数不合法 → 不再误判
    expect(sniffMime(new Uint8Array([0x00, 0x00, 0x01, 0x00, 0xff, 0xff]))).toBeNull()
    // RIFF 无 WEBP 标记
    expect(sniffMime(new Uint8Array(bytesOf('RIFF1234')))).toBeNull()
  })

  test('SVG 按文本特征识别（含 XML 声明、前导空白与前导注释）', () => {
    expect(sniffMime(new Uint8Array(bytesOf('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))).toBe('image/svg+xml')
    expect(sniffMime(new Uint8Array(bytesOf('<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>')))).toBe('image/svg+xml')
    expect(sniffMime(new Uint8Array(bytesOf('\n\n  <svg xmlns="…"></svg>')))).toBe('image/svg+xml')
    // 前导注释（Inkscape 等工具导出常见，审查 M-1）
    expect(sniffMime(new Uint8Array(bytesOf('<!-- Generator: X --><svg xmlns="…"></svg>')))).toBe('image/svg+xml')
    expect(sniffMime(new Uint8Array(bytesOf('<?xml version="1.0"?><!-- c --><svg/>')))).toBe('image/svg+xml')
  })

  test('SVG 顺序校验与误判排除（审查 M-1）', () => {
    // XHTML：svg 深埋文档内部（前面有其他元素）→ 不判为 SVG
    expect(sniffMime(new Uint8Array(bytesOf('<?xml version="1.0"?><html><body><svg/></body></html>')))).toBeNull()
    expect(sniffMime(new Uint8Array(bytesOf('hello world, plain text')))).toBeNull()
    expect(sniffMime(new Uint8Array(bytesOf('<xml-not-svg')))).toBeNull()
    expect(sniffMime(new Uint8Array([0x89, 0x50]))).toBeNull() // PNG 签名截断
    expect(sniffMime(new Uint8Array([]))).toBeNull()
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

describe('解码统一入口 analyzeDecodeInput', () => {
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

  test('返回的 base64 已消毒：零宽字符不进入结果与 Data URL（审查 I-2 回归）', () => {
    const poisoned = PNG_1X1_B64.slice(0, 20) + '\u200B' + PNG_1X1_B64.slice(20)
    const r = analyzeDecodeInput(poisoned)
    expect(r.ok).toBe(true)
    expect(r.base64).toBe(PNG_1X1_B64)
    expect(buildDataUrl(r.mime, r.base64)).not.toContain('\u200B')
    // Data URL 载荷中夹带零宽同样消毒
    const r2 = analyzeDecodeInput(`data:image/png;base64,${PNG_1X1_B64.slice(0, 10)}\uFEFF${PNG_1X1_B64.slice(10)}`)
    expect(r2.ok).toBe(true)
    expect(r2.base64).toBe(PNG_1X1_B64)
  })

  test('Data URL 的 MIME 缺失（data:;base64,）时回退魔数嗅探（审查 M-2）', () => {
    const r = analyzeDecodeInput(`data:;base64,${PNG_1X1_B64}`)
    expect(r.ok).toBe(true)
    expect(r.mime).toBe('image/png')
    expect(r.source).toBe('dataurl')
  })

  test('data: 开头但形态非法给出专属提示（审查 M-2）', () => {
    expect(analyzeDecodeInput('data:image/png;base64=AAAA').error).toContain('Data URL 形态')
    expect(analyzeDecodeInput('data:text/plain;charset=utf-8,%E4%BD%A0').error).toContain('Data URL 形态')
  })

  test('非图片二进制：解出字节但标记 unknown，回退 octet-stream', () => {
    const b64 = b64Of(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])) // ZIP 头（不在嗅探表）
    const r = analyzeDecodeInput(b64)
    expect(r.ok).toBe(true)
    expect(r.known).toBe(false)
    expect(r.mime).toBe(UNKNOWN_MIME)
  })

  test('非法 Base64 报错', () => {
    expect(analyzeDecodeInput('ab!c').ok).toBe(false)
    expect(analyzeDecodeInput('aGVsbG8=x').ok).toBe(false) // 尾垃圾（严格校验）
    expect(analyzeDecodeInput('5L2g=5aW9').ok).toBe(false) // 中间 =（严格校验）
    expect(analyzeDecodeInput('data:image/png;base64,').ok).toBe(false) // 空载荷
  })

  test('空输入 empty 标记', () => {
    expect(analyzeDecodeInput('').empty).toBe(true)
    expect(analyzeDecodeInput('   ').empty).toBe(true)
  })

  test('体积警告阈值常量为 10 MB', () => {
    expect(SIZE_WARN_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('历史回放载荷判定 asReplayPayload（审查 I-1 回归）', () => {
  test('Data URL 直接回放', () => {
    const du = `data:image/png;base64,${PNG_1X1_B64}`
    expect(asReplayPayload(du)).toBe(du)
  })

  test('编码方向的普通文件名不回放（实测误判样本）', () => {
    expect(asReplayPayload('application form signed')).toBe('') // 含空格
    expect(asReplayPayload('holiday snapshots backup')).toBe('') // 含空格（剥空白后恰为合法 Base64 的案例）
    expect(asReplayPayload('final revised draft v2')).toBe('')
    expect(asReplayPayload('PROJ1234567890123456')).toBe('') // 全大写+数字、无大小写混合
    expect(asReplayPayload('meeting notes archive.docx')).toBe('') // 含空格与扩展名
  })

  test('形似 Base64 的解码历史可回放', () => {
    expect(asReplayPayload(PNG_1X1_B64)).toBe(PNG_1X1_B64)
    // 标准 Base64（大小写混合、长度为 4 倍数）
    const std = Buffer.from('The quick brown fox jumps over the lazy dog').toString('base64')
    expect(asReplayPayload(std)).toBe(std)
  })

  test('回放不完整/不可信场景拒绝', () => {
    expect(asReplayPayload('short')).toBe('') // <20
    expect(asReplayPayload('A'.repeat(4900))).toBe('') // >4800：历史截断必不完整（审查 M-4）
    expect(asReplayPayload(PNG_1X1_B64.slice(0, 90))).toBe('') // 长度非 4 倍数（组装不完整）
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
