/**
 * RSA 辅助（R2.8）——PEM 校验等纯函数
 * 加解密/签名的实际运算在 preload（node:crypto）与 services-mock（WebCrypto）中，
 * 此模块只做「粘贴即校验」的格式检查与展示辅助。
 */

const PEM_RES = {
  public: /^-----BEGIN (?:RSA )?PUBLIC KEY-----\n(?:[A-Za-z0-9+/=\r\n]+)-----END (?:RSA )?PUBLIC KEY-----\s*$/,
  private: /^-----BEGIN (?:RSA )?PRIVATE KEY-----\n(?:[A-Za-z0-9+/=\r\n]+)-----END (?:RSA )?PRIVATE KEY-----\s*$/,
}

export const RSA_BITS = [2048, 4096]

/**
 * 校验 PEM（kind: 'public' | 'private'）
 * @returns {{ ok:true } | { ok:false, error:string }}
 */
export function validatePem(pem, kind) {
  const s = String(pem ?? '').trim()
  if (!s) return { ok: false, error: kind === 'public' ? '请粘贴公钥 PEM' : '请粘贴私钥 PEM' }
  const m = s.match(/-----BEGIN ([A-Z ]+?)-----/)
  if (!m) return { ok: false, error: '不是 PEM 格式：缺少 -----BEGIN …----- 头' }
  if (!s.includes('-----END')) return { ok: false, error: 'PEM 不完整：缺少 -----END …----- 尾（内容可能被截断）' }
  if (!PEM_RES[kind].test(s)) {
    const isPrivatePasted = /PRIVATE/.test(m[1])
    return {
      ok: false,
      error:
        kind === 'public'
          ? isPrivatePasted
            ? '粘贴的是私钥，此处需要公钥（可在「私钥提取公钥」中由私钥导出）'
            : `PEM 类型不匹配：需要 PUBLIC KEY，收到 ${m[1].trim()}`
          : kind === 'private' && !isPrivatePasted
            ? '粘贴的是公钥，此处需要私钥'
            : `PEM 类型不匹配：收到 ${m[1].trim()}，或正文含非 Base64 字符`,
    }
  }
  return { ok: true }
}
