/**
 * UUID 生成（PRD 4.5.1 / 技术设计 §11.7）
 * · crypto.getRandomValues 实现标准 RFC 4122 v4（版本位 / 变体位）
 * · 批量 1–100；格式：标准（连字符小写）/ 无连字符 / 大写
 * · 唯一性由 128bit 随机源保证，不做去重检查
 */

export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** 默认随机源 */
function defaultRandom(len) {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('当前环境缺少 crypto.getRandomValues')
  }
  return crypto.getRandomValues(new Uint8Array(len))
}

/**
 * 生成单个 UUID v4
 * @param {(len:number) => Uint8Array} random 可注入随机源（测试用）
 */
export function uuidV4(random = defaultRandom) {
  const b = random(16)
  b[6] = (b[6] & 0x0f) | 0x40 // 版本位 → 4
  b[8] = (b[8] & 0x3f) | 0x80 // 变体位 → 10x
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * 格式变换
 * @param {'standard'|'none'|'upper'} format
 */
export function formatUuid(u, format = 'standard') {
  const t = String(u ?? '').trim().toLowerCase()
  if (format === 'none') return t.replace(/-/g, '')
  if (format === 'upper') return t.toUpperCase()
  return t
}

/**
 * 批量生成
 * @param {number} count 1–100（越界自动收敛）
 */
export function generateUuids(count, format = 'standard', random) {
  const n = Math.min(100, Math.max(1, Math.floor(Number(count) || 1)))
  return Array.from({ length: n }, () => formatUuid(uuidV4(random), format))
}
