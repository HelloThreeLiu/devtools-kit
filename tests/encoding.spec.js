import { describe, expect, test } from 'vitest'
import { ENCODINGS, decodeText, encodeText, gbkTableSize, toB64, toHex } from '../src/utils/convert/encoding.js'

const hexOf = (str, enc, opts) => toHex(encodeText(str, enc, opts).bytes)

describe('GBK 编码（SPIKE-1 方案 d：运行时逆向映射表）', () => {
  test('「你好」→ C4 E3 BA C3（计划验收，勘误后正确字节）', () => {
    expect(hexOf('你好', 'gbk')).toBe('C4 E3 BA C3')
  })

  test('GBK 全量往返一致（抽查高频汉字、符号、全角）', () => {
    const samples = [
      '你好世界',
      '开发工具箱',
      '，。！？：；「」《》、',
      '①②③⑴⑵㎜㎏',
      'ASCII + digits 0189',
      '龥', // GB2312 末字
    ]
    for (const src of samples) {
      const r = encodeText(src, 'gbk')
      expect(r.ok, `编码失败: ${src}`).toBe(true)
      const d = decodeText(toHex(r.bytes), 'gbk')
      expect(d.ok, `解码失败: ${src}`).toBe(true)
      expect(d.data).toBe(src)
    }
  })

  test('逆向表规模与 SPIKE-1 实测一致（≈21,791 字符）', () => {
    const size = gbkTableSize()
    expect(size).toBeGreaterThan(21000)
    expect(size).toBeLessThan(22500)
  })

  test('GBK 范围外字符（Emoji）报错并指明字符', () => {
    const r = encodeText('你好🐼', 'gbk')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('🐼')
    // 前缀仍可部分编码校验：错误发生时不产出字节
  })

  test('ASCII 保持单字节', () => {
    expect(hexOf('A1', 'gbk')).toBe('41 31')
    expect(encodeText('abc', 'gbk').bytes.length).toBe(3)
  })
})

describe('UTF-16 编码（R1.4）', () => {
  test('「你」UTF-16 BE / LE 字节序', () => {
    expect(hexOf('你', 'utf16be')).toBe('4F 60')
    expect(hexOf('你', 'utf16le')).toBe('60 4F')
  })

  test('BOM 可选（FF FE / FE FF）', () => {
    expect(hexOf('你', 'utf16le', { bom: true })).toBe('FF FE 60 4F')
    expect(hexOf('你', 'utf16be', { bom: true })).toBe('FE FF 4F 60')
    expect(hexOf('你', 'utf16le')).toBe('60 4F')
  })

  test('Emoji 代理对（D83D DE00）往返一致', () => {
    for (const enc of ['utf16le', 'utf16be']) {
      const r = encodeText('🐼', enc)
      expect(r.ok).toBe(true)
      const d = decodeText(toHex(r.bytes), enc)
      expect(d.data).toBe('🐼')
    }
    expect(hexOf('🐼', 'utf16be')).toBe('D8 3D DC 3C') // 🐼 = U+1F43C → 代理对 D83D DC3C
  })

  test('空字符串带 BOM 仅 2 字节', () => {
    expect(encodeText('', 'utf16be', { bom: true }).bytes.length).toBe(2)
    expect(encodeText('', 'utf16be').bytes.length).toBe(0)
  })
})

describe('UTF-8 与四编码矩阵', () => {
  test('「你好」UTF-8 → E4 BD A0 E5 A5 BD', () => {
    expect(hexOf('你好', 'utf8')).toBe('E4 BD A0 E5 A5 BD')
  })

  test('四编码 × 编码/解码全矩阵往返（样本 GBK 可表示）', () => {
    const src = '你好 Hello 世界 123'
    for (const { id } of ENCODINGS) {
      const enc = encodeText(src, id)
      expect(enc.ok, id).toBe(true)
      for (const format of ['hex', 'b64']) {
        const dec = decodeText(format === 'b64' ? toB64(enc.bytes) : toHex(enc.bytes), id, { format })
        expect(dec.ok, `${id}/${format}`).toBe(true)
        expect(dec.data).toBe(src)
      }
    }
  })
})

describe('字节输入解析（Hex / Base64）', () => {
  test('Hex 容错：空格 / 逗号 / 0x 前缀 / 大小写', () => {
    expect(decodeText('C4 E3 BA C3', 'gbk').data).toBe('你好')
    expect(decodeText('c4e3bac3', 'gbk').data).toBe('你好')
    expect(decodeText('0xC4,0xE3,0xBA,0xC3', 'gbk').data).toBe('你好')
  })

  test('Hex 非法字符报错含字符', () => {
    const r = decodeText('C4E3BAG3', 'gbk')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('G')
  })

  test('Hex 奇数长度报错', () => {
    const r = decodeText('C4E3BAC', 'gbk')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('偶数')
  })

  test('Base64 字节格式：URL-Safe 容错', () => {
    // 「你」UTF-8 E4 BD A0 → 5L2g；UTF-16BE 4F60 → T2A？此处用完整字符串验证
    const utf8 = encodeText('你好', 'utf8')
    const b64 = toB64(utf8.bytes)
    expect(decodeText(b64, 'utf8', { format: 'b64' }).data).toBe('你好')
    // URL-Safe 变体（+/ →-_、去 padding）同样可解
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeText(urlSafe, 'utf8', { format: 'b64' }).data).toBe('你好')
  })

  test('解码 BOM 自动剥离（TextDecoder 默认行为）', () => {
    expect(decodeText('FEFF4F60', 'utf16be').data).toBe('你')
    expect(decodeText('FF FE 60 4F', 'utf16le').data).toBe('你')
    expect(decodeText('EFBBBFE4BDA0E5A5BD', 'utf8').data).toBe('你好')
  })

  test('非法字节序列报错不崩溃（平台行为差异已实测）', () => {
    // 不完整 GBK 双字节（0x81 为 lead、无 trail）→ fatal 抛错
    expect(decodeText('81', 'gbk').ok).toBe(false)
    expect(decodeText('C4', 'gbk').ok).toBe(false)
    // UTF-16 奇数字节 → fatal 抛错
    expect(decodeText('4F', 'utf16be').ok).toBe(false)
    // 0xFF 平台映射为单字节字符（WHATWG gbk 表如此定义）→ 正常解码，不视为错误
    expect(decodeText('FF', 'gbk').ok).toBe(true)
  })

  test('乱码复原（可逆方向实测勘误：UTF-8 字节按 GBK 打开 → GBK 编回 → UTF-8 解码）', () => {
    // 勘误：计划 §3.3 原表述「GBK 字节按 UTF-8 打开后可复原」一般不可逆——
    // GBK 双字节大量组合（如 C4E3 的 E3）不是合法 UTF-8 序列，解码已产生 U+FFFD 丢失信息；
    // 可复原的是反方向：UTF-8 字节被按 GBK 解读（每对字节恰为合法 GBK 码位），如 浣犲ソ ↔ 你好
    const utf8Bytes = encodeText('你好', 'utf8').bytes
    const mojibake = new TextDecoder('gbk').decode(utf8Bytes)
    expect(mojibake).toBe('浣犲ソ')
    const roundtrip = encodeText(mojibake, 'gbk')
    expect(decodeText(toHex(roundtrip.bytes), 'utf8').data).toBe('你好')
  })

  test('展示格式：toHex 大写空格分隔 / toB64 标准', () => {
    expect(toHex(new Uint8Array([0x01, 0xab]))).toBe('01 AB')
    expect(toB64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=')
  })
})
