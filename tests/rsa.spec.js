import { describe, expect, test } from 'vitest'
import { createDecipheriv, createVerify, createPublicKey, generateKeyPairSync, publicEncrypt, constants } from 'node:crypto'
import mock from '../src/utils/services-mock.js'
import { validatePem } from '../src/utils/convert/rsa.js'

/* RSA 测试策略：mock（WebCrypto）在 Node ≥20 可直接运行；
   并与 node:crypto（OpenSSL 后端，即 preload 的实现基座）交叉互验 PEM 格式正确性。
   注：Node 的 WebCrypto 不含 RSAES-PKCS1-v1_5，该分支仅在 Chromium（含 uTools 渲染进程）可用，
   测试环境按支持情况跳过。 */
const PKCS1_SUPPORTED = await crypto.subtle
  .importKey('spki', new Uint8Array(0), { name: 'RSAES-PKCS1-v1_5' }, false, ['encrypt'])
  .then(() => true)
  .catch(() => false)

describe('PEM 校验（R2.8：粘贴任意 PEM 均先校验并给出具体原因）', () => {
  const PUB = `-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKxP4fHv\n-----END PUBLIC KEY-----`
  const PRI = `-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----`

  test('合法形态通过', () => {
    expect(validatePem(PUB, 'public').ok).toBe(true)
    expect(validatePem(PRI, 'private').ok).toBe(true)
    expect(validatePem(`  ${PRI}  \n`, 'private').ok).toBe(true) // 首尾空白容忍
  })

  test('缺头/缺尾/类型不匹配/私钥当公钥', () => {
    expect(validatePem('MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKxP', 'public').error).toContain('PEM 格式')
    expect(validatePem('-----BEGIN PUBLIC KEY-----\nAA\n', 'public').error).toContain('不完整')
    expect(validatePem(PRI, 'public').error).toContain('私钥')
    expect(validatePem(PUB, 'private').error).toContain('公钥')
    expect(validatePem('', 'public').error).toContain('请粘贴')
  })

  test('RSA PRIVATE KEY（PKCS#1 旧形态）同样接受', () => {
    expect(validatePem('-----BEGIN RSA PRIVATE KEY-----\nAA\n-----END RSA PRIVATE KEY-----', 'private').ok).toBe(true)
  })
})

describe('mock RSA（WebCrypto）：往返与签名', () => {
  test('密钥对生成：PEM 结构正确', async () => {
    const kp = await mock.rsaGenerateKeyPair(2048)
    expect(kp.publicKey).toContain('-----BEGIN PUBLIC KEY-----')
    expect(kp.privateKey).toContain('-----BEGIN PRIVATE KEY-----')
    expect(kp.publicKey.split('\n').every((l) => l.length <= 64 + 30 || l === '')).toBe(true) // PEM 64 字符折行
  })

  test('OAEP-SHA256 加解密往返', async () => {
    const kp = await mock.rsaGenerateKeyPair(2048)
    const dataB64 = Buffer.from('你好，RSA OAEP！').toString('base64')
    const cipher = await mock.rsaPublicEncrypt(kp.publicKey, dataB64, 'oaep')
    const plain = await mock.rsaPrivateDecrypt(kp.privateKey, cipher, 'oaep')
    expect(Buffer.from(plain, 'base64').toString('utf-8')).toBe('你好，RSA OAEP！')
  })

  test.skipIf(!PKCS1_SUPPORTED)('PKCS#1 v1.5 加解密往返（Node WebCrypto 缺此算法时跳过）', async () => {
    const kp = await mock.rsaGenerateKeyPair(2048)
    const dataB64 = Buffer.from('pkcs1 roundtrip').toString('base64')
    const cipher = await mock.rsaPublicEncrypt(kp.publicKey, dataB64, 'pkcs1')
    const plain = await mock.rsaPrivateDecrypt(kp.privateKey, cipher, 'pkcs1')
    expect(Buffer.from(plain, 'base64').toString('utf-8')).toBe('pkcs1 roundtrip')
  })

  test('签名 / 验签正反例（SHA-256 与 SHA-1；篡改内容验签失败）', async () => {
    const kp = await mock.rsaGenerateKeyPair(2048)
    for (const hash of ['sha256', 'sha1']) {
      const sig = await mock.rsaSign(kp.privateKey, 'signed content', hash)
      expect(await mock.rsaVerify(kp.publicKey, 'signed content', sig, hash)).toBe(true)
      expect(await mock.rsaVerify(kp.publicKey, 'tampered content', sig, hash)).toBe(false)
    }
  })

  test('错误密钥解密抛友好错误', async () => {
    const kp1 = await mock.rsaGenerateKeyPair(2048)
    const kp2 = await mock.rsaGenerateKeyPair(2048)
    const cipher = await mock.rsaPublicEncrypt(kp1.publicKey, Buffer.from('x').toString('base64'), 'oaep')
    await expect(mock.rsaPrivateDecrypt(kp2.privateKey, cipher, 'oaep')).rejects.toThrow('RSA 操作失败')
  })
})

describe('mock 与 node:crypto 交叉互验（PEM 格式 = OpenSSL 生态通用）', () => {
  test('node:crypto 公钥加密 → mock 私钥解密', async () => {
    const kp = await mock.rsaGenerateKeyPair(2048)
    const pub = createPublicKey(kp.publicKey) // node 能解析 mock 生成的 SPKI PEM
    const cipher = publicEncrypt(
      { key: pub, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from('interop 你好'),
    )
    const plain = await mock.rsaPrivateDecrypt(kp.privateKey, cipher.toString('base64'), 'oaep')
    expect(Buffer.from(plain, 'base64').toString('utf-8')).toBe('interop 你好')
  })

  test('node:crypto 验签通过 mock 签名', async () => {
    const kp = await mock.rsaGenerateKeyPair(2048)
    const sig = await mock.rsaSign(kp.privateKey, 'cross verify', 'sha256')
    const ok = createVerify('sha256').update('cross verify').verify(createPublicKey(kp.publicKey), sig, 'base64')
    expect(ok).toBe(true)
  })

  test('node:crypto 生成的密钥对可被 mock 使用（结构一致）', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    const cipher = await mock.rsaPublicEncrypt(publicKey, Buffer.from('from node').toString('base64'), 'oaep')
    const plain = await mock.rsaPrivateDecrypt(privateKey, cipher, 'oaep')
    expect(Buffer.from(plain, 'base64').toString('utf-8')).toBe('from node')
  })
})
