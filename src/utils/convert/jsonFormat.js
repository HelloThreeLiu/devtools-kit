/**
 * JSON 格式化（PRD 4.3.4 / 技术设计 §11.5 v0.2）
 * · 校验定位：自写轻量状态机校验器 lint，稳定产出 行/列/原因，不依赖 V8 报错文案
 *   （当前 Chromium 对部分语法错误不再附带 position；lint 通过后再 JSON.parse 取值）
 * · 高亮：单正则逐 token 着色，不引入 highlight.js（包体积约束）
 * · 折叠：按行记录起止区间
 */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const byteLen = (str) => new TextEncoder().encode(String(str)).length

/**
 * 自写 JSON 校验器
 * @returns {{ ok: true } | { ok: false, pos: number, line: number, col: number, reason: string }}
 */
export function lint(src) {
  const s = String(src ?? '')
  const n = s.length
  let i = 0
  let line = 1
  let col = 1
  const stack = [] // 未闭合的 '{' 或 '['
  const states = [] // key-or-end | colon | value-or-end | comma-or-end
  const fail = (reason) => ({ ok: false, pos: i, line, col, reason })
  const adv = () => {
    if (s[i] === '\n') {
      line++
      col = 1
    } else col++
    i++
  }
  const ws = () => {
    while (i < n && /\s/.test(s[i])) adv()
  }
  const show = (c) => (c === undefined ? '（内容结束）' : `「${c}」`)
  const unclosed = () => {
    const need = stack
      .slice()
      .reverse()
      .map((c) => (c === '{' ? '}' : ']'))
      .join(' ')
    return `内容不完整：还有 ${stack.length} 个括号没有闭合，需要补上 ${need}`
  }

  function scanString() {
    adv() // 开头的双引号
    while (i < n) {
      const c = s[i]
      if (c === '"') {
        adv()
        return true
      }
      if (c === '\\') {
        const e = s[i + 1]
        if (e === undefined) {
          adv()
          return fail('字符串没有闭合，并且转义不完整')
        }
        if (!/["\\\/bfnrtu]/.test(e)) return fail(`无效的转义 \\${e}`)
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) return fail('\\u 后面需要 4 位十六进制数')
          adv()
          adv()
          adv()
          adv()
        }
        adv()
        adv()
        continue
      }
      if (c < ' ') return fail('字符串里有未转义的控制字符（如换行、制表符）')
      adv()
    }
    return fail('字符串没有闭合，缺少结尾的双引号')
  }

  function parseValue() {
    const c = s[i]
    if (c === undefined) return fail(stack.length ? unclosed() : '这里缺少一个值')
    if (c === '"') return scanString()
    if (c === '{' || c === '[') {
      stack.push(c)
      states.push(c === '{' ? 'key-or-end' : 'value-or-end')
      adv()
      return true
    }
    if (c === 't' || c === 'f' || c === 'n') {
      const lit = c === 't' ? 'true' : c === 'f' ? 'false' : 'null'
      const start = { i, line, col } // 报错指到字面量开头
      for (let k = 0; k < lit.length; k++) {
        if (s[i] !== lit[k]) return failAt(`这里应为 ${lit}`, start)
        adv()
      }
      return true
    }
    if (c === '-' || (c >= '0' && c <= '9')) {
      const m = s.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      if (!m) return fail('负号后面缺少数字')
      for (let k = 0; k < m[0].length; k++) adv()
      if (s[i] === '.') return fail('小数点后面缺少数字')
      if (s[i] >= '0' && s[i] <= '9') return fail('数字有前导零：整数部分不能以 0 开头（0 本身除外）')
      return true
    }
    if (c === ',' && states[states.length - 1] === 'value-or-end') return fail('数组的第一项前面不能有逗号')
    return fail(`意外的字符${show(c)}，这里应是一个值（字符串、数字、true / false / null、{} 或 []）`)
  }

  function failAt(reason, at) {
    return { ok: false, pos: at.i, line: at.line, col: at.col, reason }
  }

  ws()
  if (i >= n) return fail('内容为空')
  let r = parseValue()
  if (r !== true) return r

  while (stack.length) {
    const top = stack.length - 1
    const close = stack[top] === '{' ? '}' : ']'
    const st = states[top]
    ws()
    const c = s[i]

    if (st === 'key-or-end') {
      if (c === close) {
        adv()
        stack.pop()
        states.pop()
        continue
      }
      if (c === undefined) return fail(unclosed())
      if (c === '"') {
        r = scanString()
        if (r !== true) return r
        states[top] = 'colon'
        continue
      }
      return fail(`意外的字符${show(c)}，这里应为属性名（双引号字符串）或 ${close}`)
    }
    if (st === 'colon') {
      if (c === ':') {
        adv()
        states[top] = 'value'
        ws()
        r = parseValue()
        if (r !== true) return r
        states[top] = 'comma-or-end'
        continue
      }
      return fail(`属性名后面缺少冒号 :（收到${show(c)}）`)
    }
    if (st === 'value-or-end') {
      if (c === ']') {
        adv()
        stack.pop()
        states.pop()
        continue
      }
      if (c === undefined) return fail(unclosed())
      r = parseValue()
      if (r !== true) return r
      states[top] = 'comma-or-end'
      continue
    }
    // comma-or-end：一个值之后应为 , 或闭合
    if (c === close) {
      adv()
      stack.pop()
      states.pop()
      continue
    }
    if (c === ',') {
      adv()
      ws()
      if (s[i] === undefined) return fail(unclosed())
      if (s[i] === close) return fail(`多了一个逗号：${close} 的前面不能再有逗号`)
      states[top] = stack[top] === '{' ? 'key-or-end' : 'value-or-end'
      continue
    }
    if (c === undefined) return fail(unclosed())
    return fail(`意外的字符${show(c)}，这里应为逗号 , 或 ${close}`)
  }

  ws()
  if (i < n) return fail('JSON 已经结束，后面还有多余的内容')
  return { ok: true }
}

/**
 * 校验 + 格式化
 * @param {string} src
 * @param {'2'|'4'|'tab'|'min'} format
 * @returns {{ ok:true, data:string, parsed:any } | { ok:false, pos, line, col, reason }}
 */
export function formatJson(src, format = '2') {
  const v = lint(src)
  if (!v.ok) return v
  const parsed = JSON.parse(src) // lint 通过后不会失败
  const space = format === 'tab' ? '\t' : format === 'min' ? undefined : Number(format)
  return { ok: true, data: format === 'min' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, space), parsed }
}

/* ---------- 语法高亮 ---------- */

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],])/g

/** 输出带 tk-* span 的 HTML（已转义） */
export function highlightJson(text) {
  let out = ''
  let last = 0
  let m
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(text))) {
    out += esc(text.slice(last, m.index))
    if (m[1] !== undefined) {
      out +=
        m[2] !== undefined
          ? `<span class="tk-key">${esc(m[1])}</span><span class="tk-pun">${esc(m[2])}</span>`
          : `<span class="tk-str">${esc(m[1])}</span>`
    } else if (m[3] !== undefined) out += `<span class="tk-num">${esc(m[3])}</span>`
    else if (m[4] !== undefined) out += `<span class="tk-bool">${esc(m[4])}</span>`
    else out += `<span class="tk-pun">${esc(m[5])}</span>`
    last = m.index + m[0].length
  }
  return out + esc(text.slice(last))
}

/* ---------- 折叠 ---------- */

/**
 * 行数组 → Map(起始行序号 → 结束行序号)
 * @param {string[]} lines
 */
export function computeFolds(lines) {
  const map = new Map()
  const open = []
  lines.forEach((text, idx) => {
    const t = text.trim()
    if (/^[}\]]/.test(t) && open.length) map.set(open.pop(), idx)
    if (/[{[]$/.test(t)) open.push(idx)
  })
  return map
}

/** 根节点描述（对象键数 / 数组项数 / 类型名） */
export function rootSummary(parsed) {
  if (Array.isArray(parsed)) return `${parsed.length} 项的数组`
  if (parsed && typeof parsed === 'object') return `${Object.keys(parsed).length} 个键的对象`
  return parsed === null ? 'null' : typeof parsed
}

/* ---------- JSON 转义 / 去转义（R1.6） ---------- */

/**
 * 转义：任意文本 → JSON 字符串字面量
 * 采用 JSON.stringify 的字面量语义（控制字符 / 代理对 / 中文处理与 JSON 标准一致），
 * quotes = false 时去掉外层双引号，只留转义体。
 * @param {string} str
 * @param {{ quotes?: boolean }} [opts]
 * @returns {{ ok:true, data:string }}
 */
export function escapeJsonText(str, opts = {}) {
  const lit = JSON.stringify(String(str ?? ''))
  return { ok: true, data: opts.quotes === false ? lit.slice(1, -1) : lit }
}

/**
 * 去转义：转义串 → 原文
 * 容错接受带 / 不带外层引号（带引号时引号外空白视为排版噪音；无引号时保留首尾空格保证往返一致，W2 审查 M-4）；
 * 非严格 JSON 转义按 \n \t \r \" \\ \/ \b \f \uXXXX 规则手工还原，
 * 非法转义序列报错并给出「原始输入」中的字符下标（从 0 起，W2 审查 M-5）。
 * @param {string} str
 * @returns {{ ok:true, data:string, hadQuotes:boolean } | { ok:false, error:string }}
 */
export function unescapeJsonText(str) {
  const raw = String(str ?? '')
  if (!raw.trim()) return { ok: false, error: '没有可去转义的内容' }

  // 容错：接受带/不带外层引号（仅当 trim 后首尾均为 " 时剥离）
  const t = raw.trim()
  let s = raw
  let hadQuotes = false
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    s = t.slice(1, -1)
    hadQuotes = true
  }
  // 错误位置换算偏移：无引号路径 s 即原始输入（偏移 0）；带引号路径 s 从首个引号后开始
  const offset = hadQuotes ? raw.indexOf('"') + 1 : 0

  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c !== '\\') {
      out += c
      i += 1
      continue
    }
    const e = s[i + 1]
    if (e === undefined) {
      return { ok: false, error: `位置 ${offset + i}：转义符 \\ 后没有内容（转义不完整）` }
    }
    switch (e) {
      case '"': out += '"'; i += 2; break
      case '\\': out += '\\'; i += 2; break
      case '/': out += '/'; i += 2; break
      case 'b': out += '\b'; i += 2; break
      case 'f': out += '\f'; i += 2; break
      case 'n': out += '\n'; i += 2; break
      case 'r': out += '\r'; i += 2; break
      case 't': out += '\t'; i += 2; break
      case 'u': {
        const hex = s.slice(i + 2, i + 6)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          return {
            ok: false,
            error: `位置 ${offset + i}：\\u 后需要 4 位十六进制数，收到「${hex || '（内容结束）'}」`,
          }
        }
        out += String.fromCharCode(parseInt(hex, 16))
        i += 6
        break
      }
      default:
        return {
          ok: false,
          error: `位置 ${offset + i}：无效的转义序列 \\${e}（仅支持 \\n \\t \\r \\" \\\\ \\/ \\b \\f \\uXXXX）`,
        }
    }
  }
  return { ok: true, data: out, hadQuotes }
}
