import { describe, expect, test } from 'vitest'
import { createDecipheriv, createVerify, createPublicKey, publicEncrypt, constants, randomBytes } from 'node:crypto'

/* 真实 preload.js 冒烟（此前 preload 从未纳入测试，rsaGenerateKeyPair 漏挂 services 的缺陷正是盲区）。
   Node 环境 stub window / utools 全局后按副作用加载，node:crypto 可用（与 uTools 宿主同基座）。 */
globalThis.utools = {
  getPluginLocalDataPath: () => '.',
  onPluginReady() {},
  onPluginEnter() {},
  onPluginOut() {},
  setSubInput() {
    return true
  },
  removeSubInput() {},
  setSubInputValue() {},
}
globalThis.window = { services: null }

await import('../public/preload.js')
const services = globalThis.window.services

const ALL_ACTIONS = [
  'hash',
  'rsaGenerateKeyPair',
  'rsaExtractPublic',
  'rsaPublicEncrypt',
  'rsaPrivateDecrypt',
  'rsaSign',
  'rsaVerify',
  'historyRead',
  'historyWrite',
  'saveFile',
]

describe('preload 动作清单完整性（真机反馈：rsaGenerateKeyPair 漏挂 services 回归）', () => {
  test('全部业务动作都挂在 services 上且为函数', () => {
    expect(services).not.toBeNull()
    for (const m of ALL_ACTIONS) {
      expect(typeof services[m], `services.${m} 缺失`).toBe('function')
    }
  })

  test('__buildTag 存在（版本偏差诊断用）', () => {
    expect(typeof services.__buildTag).toBe('string')
    expect(services.__buildTag.length).toBeGreaterThan(0)
  })
})

describe('preload RSA 功能冒烟（node:crypto 真实路径）', () => {
  test('密钥对生成 → node:crypto 公钥加密 → preload 私钥解密往返', async () => {
    const kp = services.rsaGenerateKeyPair(2048)
    expect(kp.publicKey).toContain('-----BEGIN PUBLIC KEY-----')
    expect(kp.privateKey).toContain('-----BEGIN PRIVATE KEY-----')
    const cipher = publicEncrypt(
      { key: createPublicKey(kp.publicKey), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from('preload smoke 你好'),
    )
    const plain = services.rsaPrivateDecrypt(kp.privateKey, cipher.toString('base64'), 'oaep')
    expect(Buffer.from(plain, 'base64').toString('utf-8')).toBe('preload smoke 你好')
  })

  test('preload 签名 → node:crypto 验签通过；篡改失败', () => {
    const kp = services.rsaGenerateKeyPair(2048)
    const sig = services.rsaSign(kp.privateKey, 'preload sign', 'sha256')
    expect(createVerify('sha256').update('preload sign').verify(createPublicKey(kp.publicKey), sig, 'base64')).toBe(true)
    expect(createVerify('sha256').update('tampered').verify(createPublicKey(kp.publicKey), sig, 'base64')).toBe(false)
  })

  test('私钥提取公钥（导出结果可被 node:crypto 使用）', () => {
    const kp = services.rsaGenerateKeyPair(2048)
    const pub = services.rsaExtractPublic(kp.privateKey)
    const cipher = publicEncrypt(
      { key: createPublicKey(pub), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      randomBytes(32),
    )
    const plain = services.rsaPrivateDecrypt(kp.privateKey, cipher.toString('base64'), 'oaep')
    expect(plain.length).toBeGreaterThan(0)
  })

  test('哈希动作可用（既有能力回归）', () => {
    expect(services.hash('abc', 'md5')).toMatch(/^[0-9a-f]{32}$/)
  })

  test('动作清单与 services-mock 一致（两侧共同演进，防漏挂回归——真机 rsaGenerateKeyPair 缺口即此模式）', async () => {
    const mock = await import('../src/utils/services-mock.js')
    const preloadMethods = Object.keys(services)
      .filter((k) => typeof services[k] === 'function')
      .sort()
    const mockMethods = Object.keys(mock.default)
      .filter((k) => typeof mock.default[k] === 'function')
      .sort()
    expect(preloadMethods).toEqual(mockMethods)
    expect(preloadMethods).toContain('rsaGenerateKeyPair') // 真机缺口专项盯防
  })

  test('明文超长给出准确指引而非误导性密钥错误（审查 I-1 回归）', () => {
    const kp = services.rsaGenerateKeyPair(2048)
    const big = Buffer.from('a'.repeat(300), 'utf-8').toString('base64')
    expect(() => services.rsaPublicEncrypt(kp.publicKey, big, 'oaep')).toThrow('明文超长')
    expect(() => services.rsaPublicEncrypt(kp.publicKey, Buffer.from('a'.repeat(100)).toString('base64'), 'oaep')).not.toThrow()
  })

  test('未知哈希显式抛错（审查 M-6）', () => {
    const kp = services.rsaGenerateKeyPair(2048)
    expect(() => services.rsaSign(kp.privateKey, 'x', 'sha512')).toThrow('不支持的哈希算法')
  })

  test('非法输入走统一友好错误', () => {
    expect(() => services.rsaPublicEncrypt('not a pem', 'AAAA', 'oaep')).toThrow('RSA 操作失败')
  })
})
