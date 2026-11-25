/**
 * 进制转换（PRD 4.3.5 / 技术设计 §11.6）
 * · BigInt 计算，规避 >2^53−1 精度丢失
 * · 自动识别 0b / 0o / 0x 前缀（优先于所选进制）
 * · 超出安全整数范围时提示精度说明
 */

const DIGIT_RE = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-f]+$/ }
const PREFIX = { 2: '0b', 8: '0o', 10: '', 16: '0x' }
const PREFIX_BASE = { '0b': 2, '0o': 8, '0x': 16 }
const BASE_NAME = { 2: '二进制', 8: '八进制', 10: '十进制', 16: '十六进制' }
const SAFE = BigInt(Number.MAX_SAFE_INTEGER) // 2^53 − 1

/**
 * @param {string} input 支持前缀 0b/0o/0x 与负号
 * @param {2|8|10|16} base 所选进制（有前缀时被前缀覆盖）
 * @returns {{ ok:true, n:BigInt, base:number, detected:boolean, warning?:string,
 *             outputs:{ bin:string, oct:string, dec:string, hex:string, b36:string } }
 *            | { ok:false, error:string }
 *            | { ok:false, empty:true }}
 */
export function convertRadix(input, base = 10) {
  let s = String(input ?? '').trim().toLowerCase()
  if (!s) return { ok: false, empty: true }

  let sign = ''
  let digits = s
  let detected = null

  const pm = s.match(/^(-?)(0[bxo])([0-9a-f]+)$/)
  if (pm) {
    sign = pm[1]
    digits = pm[3]
    detected = PREFIX_BASE[pm[2]]
  } else {
    const m = s.match(/^(-?)([0-9a-z]+)$/)
    if (!m) return { ok: false, error: `无法识别「${s}」：请输入数字（支持负号与 0b / 0o / 0x 前缀）` }
    sign = m[1]
    digits = m[2]
  }

  const eff = detected || base
  if (!DIGIT_RE[eff].test(digits)) {
    const expect = { 2: '0 / 1', 8: '0–7', 10: '0–9', 16: '0–9 与 a–f' }[eff]
    return { ok: false, error: `「${digits}」不是有效的 ${BASE_NAME[eff]}：${eff} 进制只接受 ${expect}` }
  }

  const n = BigInt(sign + PREFIX[eff] + digits)

  let warning
  if (detected) warning = `识别到前缀，按 ${BASE_NAME[eff]} 处理`
  if (n > SAFE || n < -SAFE) warning = '超出 JavaScript 安全整数范围（±2⁵³−1），已用 BigInt 精确处理'

  return {
    ok: true,
    n,
    base: eff,
    detected: !!detected,
    warning,
    outputs: {
      bin: n.toString(2),
      oct: n.toString(8),
      dec: n.toString(10),
      hex: n.toString(16),
      b36: n.toString(36),
    },
  }
}
