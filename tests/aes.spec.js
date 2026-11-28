import { describe, expect, test } from 'vitest'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { aesDecrypt, aesEncrypt, generateAesKey } from '../src/utils/convert/aes.js'

const PLAIN = '你好，DevTools Kit！AES roundtrip 🐼'

describe('密钥生成（R2.5）', () => {
  test('长度与格式', () => {
    for (const bits of [128, 192, 256]) {
      const hex = generateAesKey(bits, 'hex')
      expect(hex.key).toMatch(/^[0-9a-f]+$/)
      expect(hex.key.length).toBe((bits / 8) * 2)
      const b64 = generateAesKey(bits, 'base64')
      expect(atob(b64.key).length).toBe(bits / 8)
    }
  })

  test('随机性：两次生成不同', () => {
    expect(generateAesKey(128).key).not.toBe(generateAesKey(128).key)
  })

  test('raw 格式返回字节', () => {
    const r = generateAesKey(128, 'raw')
    expect(r.key).toBeInstanceOf(Uint8Array)
    expect(r.key.length).toBe(16)
  })

  test('非法位数显式抛错（审查 M-7）', () => {
    expect(() => generateAesKey(512)).toThrow('不支持的 AES 密钥长度')
    expect(() => generateAesKey(100)).toThrow('不支持的 AES 密钥长度')
  })
})

describe('AES-CBC 加解密（与 node:crypto / OpenSSL 互验）', () => {
  test('128 位：固定 IV 与 node:crypto 产物逐字节一致（OpenSSL 等价验证）', async () => {
    const key = randomBytes(16)
    const iv = randomBytes(16)
    const mine = await aesEncrypt({ key: key.toString('hex'), keyFormat: 'hex', mode: 'CBC', plaintext: PLAIN, output: 'hex', iv: iv.toString('hex') })
    expect(mine.ok).toBe(true)
    // node:crypto（OpenSSL 后端）同参数加密
    const c = createCipheriv('aes-128-cbc', key, iv)
    const cipher = Buffer.concat([c.update(Buffer.from(PLAIN, 'utf-8')), c.final()])
    expect(mine.data).toBe(cipher.toString('hex'))
    // 反向：node:crypto 产物由本实现解密
    const d = createDecipheriv('aes-128-cbc', key, iv)
    const plain = Buffer.concat([d.update(cipher), d.final()])
    expect(plain.toString('utf-8')).toBe(PLAIN)
    const back = await aesDecrypt({ key: key.toString('hex'), mode: 'CBC', iv: iv.toString('hex'), cipher: cipher.toString('hex'), inputFormat: 'hex' })
    expect(back.ok).toBe(true)
    expect(back.data).toBe(PLAIN)
  })

  test('192 / 256 位自动生成 IV 往返一致', async () => {
    for (const bits of [192, 256]) {
      const k = generateAesKey(bits, 'hex').key
      const enc = await aesEncrypt({ key: k, keyFormat: 'hex', mode: 'CBC', plaintext: PLAIN, output: 'base64' })
      expect(enc.ok).toBe(true)
      const dec = await aesDecrypt({ key: k, mode: 'CBC', iv: enc.iv, cipher: enc.data, inputFormat: 'base64' })
      expect(dec.ok).toBe(true)
      expect(dec.data).toBe(PLAIN)
    }
  })

  test('Base64 密钥格式往返', async () => {
    const k = generateAesKey(256, 'base64').key
    const enc = await aesEncrypt({ key: k, keyFormat: 'base64', mode: 'CBC', plaintext: PLAIN })
    const dec = await aesDecrypt({ key: k, keyFormat: 'base64', mode: 'CBC', iv: enc.iv, cipher: enc.data })
    expect(dec.data).toBe(PLAIN)
  })
})

describe('AES-GCM 加解密（R2.5：认证标签随密文）', () => {
  test('往返一致；密文长度 = 明文 + 16 字节标签', async () => {
    const k = generateAesKey(256, 'hex').key
    const enc = await aesEncrypt({ key: k, mode: 'GCM', plaintext: PLAIN, output: 'hex' })
    expect(enc.ok).toBe(true)
    expect(enc.iv.length).toBe(24) // GCM 12 字节 IV → hex 24 位
    const plainBytes = new TextEncoder().encode(PLAIN).length
    expect(enc.data.length / 2).toBe(plainBytes + 16) // hex 2 位/字节
    const dec = await aesDecrypt({ key: k, mode: 'GCM', iv: enc.iv, cipher: enc.data, inputFormat: 'hex' })
    expect(dec.data).toBe(PLAIN)
  })

  test('与 node:crypto GCM 互验', async () => {
    const key = randomBytes(32)
    const iv = randomBytes(12)
    const mine = await aesEncrypt({ key: key.toString('hex'), mode: 'GCM', plaintext: PLAIN, output: 'hex', iv: iv.toString('hex') })
    const c = createCipheriv('aes-256-gcm', key, iv)
    const expected = Buffer.concat([c.update(Buffer.from(PLAIN, 'utf-8')), c.final(), c.getAuthTag()]).toString('hex')
    expect(mine.data).toBe(expected)
  })

  test('篡改密文 / 错误密钥 → GCM 友好报错（验收）', async () => {
    const k = generateAesKey(256, 'hex').key
    const enc = await aesEncrypt({ key: k, mode: 'GCM', plaintext: PLAIN, output: 'hex' })
    const tampered = enc.data.slice(0, -2) + (enc.data.endsWith('00') ? 'ff' : '00')
    const r1 = await aesDecrypt({ key: k, mode: 'GCM', iv: enc.iv, cipher: tampered, inputFormat: 'hex' })
    expect(r1.ok).toBe(false)
    expect(r1.error).toContain('密文或密钥不匹配')
    const r2 = await aesDecrypt({ key: generateAesKey(256, 'hex').key, mode: 'GCM', iv: enc.iv, cipher: enc.data, inputFormat: 'hex' })
    expect(r2.ok).toBe(false)
    expect(r2.error).toContain('密文或密钥不匹配')
  })
})

describe('错误处理（验收：错误密钥友好提示不崩溃）', () => {
  test('CBC 错误密钥/IV → 友好报错', async () => {
    const enc = await aesEncrypt({ key: generateAesKey(128, 'hex').key, mode: 'CBC', plaintext: PLAIN })
    const wrong = await aesDecrypt({ key: generateAesKey(128, 'hex').key, mode: 'CBC', iv: enc.iv, cipher: enc.data })
    expect(wrong.ok).toBe(false)
    expect(wrong.error).toContain('解密失败')
  })

  test('密钥长度非法报错', async () => {
    const r = await aesEncrypt({ key: 'aabbcc', mode: 'CBC', plaintext: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('密钥长度不合法')
  })

  test('超 122KB 输入不再栈溢出，可正常加解密（审查 I-6 回归）', async () => {
    const big = 'x'.repeat(130 * 1024) // 曾触发 String.fromCharCode spread 栈溢出
    const k = generateAesKey(256, 'hex').key
    const enc = await aesEncrypt({ key: k, mode: 'CBC', plaintext: big })
    expect(enc.ok).toBe(true)
    const dec = await aesDecrypt({ key: k, mode: 'CBC', iv: enc.iv, cipher: enc.data, inputFormat: 'base64' })
    expect(dec.ok).toBe(true)
    expect(dec.data).toBe(big)
  })

  test('明文超 1 MB 给出分段指引（审查 I-6 软上限）', async () => {
    const k = generateAesKey(256, 'hex').key
    const r = await aesEncrypt({ key: k, mode: 'CBC', plaintext: 'a'.repeat(1024 * 1024 + 1) })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('超过 1 MB')
  })

  test('IV 长度非法报错（CBC 需要 16 字节）', async () => {
    const k = generateAesKey(128, 'hex').key
    const r = await aesEncrypt({ key: k, mode: 'CBC', plaintext: 'x', iv: 'aabb' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('16 字节')
  })

  test('密钥格式非法报错', async () => {
    const r = await aesEncrypt({ key: 'zz!!', mode: 'CBC', plaintext: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('密钥')
  })
})
