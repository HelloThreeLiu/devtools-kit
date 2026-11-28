/**
 * URL 编解码（PRD 4.3.3 / 技术设计 §11.4；R1.1 快赢修复包增强）
 * · 编码三模式：智能（http(s):// 开头走 encodeURI 保留结构，其余 encodeURIComponent 全编码）/ Component / URI
 * · 解码宽容模式：遇非法 % 序列不再整体失败——合法片段正常解码、非法片段按字面保留，返回值带 partial 标注
 * · URL 结构化解析：new URL + URLSearchParams；解析失败按纯文本处理
 */

/**
 * 编码模式归一：智能模式按输入形态选择策略
 * @param {string} s
 * @param {'smart'|'component'|'uri'} mode
 */
function resolveMode(s, mode) {
  if (mode !== 'smart') return mode
  return /^https?:\/\//i.test(s) ? 'uri' : 'component'
}

/**
 * URL 编码
 * @param {string} str
 * @param {'smart'|'component'|'uri'} mode smart = 按输入形态自动选择（R1.1 URL 智能模式）
 * @returns {{ ok:boolean, data?:string, resolvedMode?:'uri'|'component', error?:string }}
 */
export function encodeUrl(str, mode = 'component') {
  const s0 = String(str ?? '')
  // 智能模式按「粘贴语义」处理：URL 首尾不应有空白，判定与编码前统一 trim，
  // 避免尾随换行被编码成 %0A、前导空白导致判向错误（审查 M-1）
  const s = mode === 'smart' ? s0.trim() : s0
  try {
    const resolved = resolveMode(s, mode)
    return {
      ok: true,
      data: resolved === 'uri' ? encodeURI(s) : encodeURIComponent(s),
      resolvedMode: resolved,
    }
  } catch (e) {
    return { ok: false, error: '编码失败：输入包含无效的 UTF-16 码元（如孤立的代理字符）' }
  }
}

/** 连续 %XX 序列（宽容解码的合法片段） */
const PCT_RUN = /(?:%[0-9A-Fa-f]{2})+/g

/**
 * UTF-8 严格解码器（decode() 非流式调用每次重置内部状态，异常后可安全复用；
 * 复用避免对超长恶意输入逐序列构造解码器的开销，审查 B-1）
 */
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true })

/**
 * 单个片段的宽容解码：按 UTF-8 首字节判定序列长度，逐序列解码；
 * 非法首字节 / 不完整序列 / 非法组合均按字面保留，其余正常还原。
 * 调用方已对整段 decodeURIComponent 失败，此处不再整体重试（审查 M-5）。
 * @param {string} run 形如 %XX%XX… 的片段
 * @returns {{ text: string }} 无法解码的部分以原文形式保留在 text 中
 */
function decodeRun(run) {
  const seqs = run.match(/%[0-9A-Fa-f]{2}/g) || []
  let text = ''
  let i = 0
  while (i < seqs.length) {
    const b0 = parseInt(seqs[i].slice(1), 16)
    // 首字节决定序列长度：0xxx→1 / 110xxx→2 / 1110xx→3 / 11110x→4；10xxxx 为非法首字节
    const need = b0 < 0x80 ? 1 : b0 >= 0xf0 ? 4 : b0 >= 0xe0 ? 3 : b0 >= 0xc0 ? 2 : 0
    if (need > 0 && i + need <= seqs.length) {
      const bytes = []
      for (let k = 0; k < need; k++) bytes.push(parseInt(seqs[i + k].slice(1), 16))
      try {
        text += UTF8_STRICT.decode(Uint8Array.from(bytes))
        i += need
        continue
      } catch (e) {
        /* 组合非法（过长编码 / 代理区 / 超 F4 首字节等）→ 按字面保留 */
      }
    }
    text += seqs[i]
    i += 1
  }
  return { text }
}

/**
 * URL 解码（宽容模式，R1.1）
 * 严格解码优先；失败时合法 %XX 片段尽力解码、非法片段（裸 % / 非法 UTF-8 字节）按字面保留，
 * 返回值带 partial: true，由 UI 提示「部分内容无法解码」。不再整体失败。
 * @returns {{ ok:true, data:string, partial?:boolean }}
 */
export function decodeUrl(str) {
  const s = String(str ?? '')
  try {
    return { ok: true, data: decodeURIComponent(s) }
  } catch (e) {
    /* 进入宽容模式 */
  }
  let partial = false
  const data = s.replace(PCT_RUN, (run) => {
    try {
      return decodeURIComponent(run)
    } catch (e) {
      partial = true
      return decodeRun(run).text
    }
  })
  // 裸 %（后非两位十六进制）无法转义 → 字面保留并标注
  if (/%(?![0-9A-Fa-f]{2})/.test(s)) partial = true
  return { ok: true, data, partial }
}

/**
 * 解析完整 URL；失败返回 null（调用方按纯文本编解码处理）
 * @returns {{ protocol, hostname, port, pathname, hash, params: Array<[string,string]> } | null}
 */
export function parseUrl(str) {
  try {
    const u = new URL(String(str ?? '').trim())
    const params = []
    u.searchParams.forEach((v, k) => params.push([k, v]))
    const defaultPort = u.protocol === 'https:' ? '443' : u.protocol === 'http:' ? '80' : ''
    return {
      protocol: u.protocol.replace(/:$/, ''),
      hostname: u.hostname,
      port: u.port || (defaultPort ? `${defaultPort}（默认）` : ''),
      pathname: u.pathname,
      hash: u.hash || '',
      params,
    }
  } catch (e) {
    return null
  }
}
