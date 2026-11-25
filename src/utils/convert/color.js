/**
 * 颜色格式转换（PRD 4.6.1）
 * 输入 HEX(#rgb/#rrggbb/#rrggbbaa) / rgb() / rgba() / hsl() / hsla() 任一格式，
 * 输出其余全部格式与透明度信息。内部统一为 { r, g, b, a } 模型。
 */

const round2 = (x) => Math.round(x * 100) / 100
const clamp = (x, min, max) => Math.min(max, Math.max(min, x))

/** HSL → RGB（h 0–360，s/l 0–1） */
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

/** RGB → HSL（返回 h 0–360 取整，s/l 百分数取整） */
export function rgbToHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === rn) h = 60 * (((gn - bn) / d) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / d + 2)
    else h = 60 * ((rn - gn) / d + 4)
    if (h < 0) h += 360
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

const okColor = (r, g, b, a) => ({
  ok: true,
  color: {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
    a: clamp(round2(a), 0, 1),
  },
})

/**
 * 解析颜色文本
 * @returns {{ ok:true, color:{r,g,b,a} } | { ok:false, error:string } | { ok:false, empty:true }}
 */
export function parseColor(input) {
  const s = String(input ?? '').trim().toLowerCase()
  if (!s) return { ok: false, empty: true }

  // HEX
  let m = s.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    const h = m[1]
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split('').map((c) => parseInt(c + c, 16))
      return okColor(r, g, b, h.length === 4 ? round2(a / 255) : 1)
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      const a = h.length === 8 ? round2(parseInt(h.slice(6, 8), 16) / 255) : 1
      return okColor(r, g, b, a)
    }
    return { ok: false, error: 'HEX 颜色应为 3 / 4 / 6 / 8 位十六进制，如 #1e8、#1e80ff、#1e80ff80' }
  }

  // rgb() / rgba()：逗号或空格分隔
  m = s.match(/^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/)
  if (m) {
    const ch = (v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v))
    const al = (v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v))
    return okColor(ch(m[1]), ch(m[2]), ch(m[3]), m[4] ? clamp(round2(al(m[4])), 0, 1) : 1)
  }

  // hsl() / hsla()
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+%)\s*[, ]\s*([\d.]+%)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/)
  if (m) {
    const a = m[4] ? clamp(round2(m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])), 0, 1) : 1
    const { r, g, b } = hslToRgb(parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100)
    return okColor(r, g, b, a)
  }

  return { ok: false, error: '无法识别颜色：支持 #HEX、rgb() / rgba()、hsl() / hsla()' }
}

/** 输出格式集合 */
export function formatColor({ r, g, b, a }) {
  const hex =
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('') +
    (a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : '')
  const { h, s, l } = rgbToHsl(r, g, b)
  return {
    hex,
    rgb: a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`,
    hsl: a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`,
    cssVar: `--brand: ${hex};`,
    hslParts: { h, s, l },
  }
}
