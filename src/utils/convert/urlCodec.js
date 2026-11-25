/**
 * URL 编解码（PRD 4.3.3 / 技术设计 §11.4）
 * · 编码双模式：encodeURIComponent（默认）/ encodeURI
 * · 解码：URIError 捕获，报「非法 % 转义序列」
 * · URL 结构化解析：new URL + URLSearchParams；解析失败按纯文本处理
 */

/**
 * @param {string} str
 * @param {'component'|'uri'} mode
 */
export function encodeUrl(str, mode = 'component') {
  const s = String(str ?? '')
  try {
    return { ok: true, data: mode === 'uri' ? encodeURI(s) : encodeURIComponent(s) }
  } catch (e) {
    return { ok: false, error: '编码失败：输入包含无效的 UTF-16 码元（如孤立的代理字符）' }
  }
}

export function decodeUrl(str) {
  try {
    return { ok: true, data: decodeURIComponent(String(str ?? '')) }
  } catch (e) {
    return {
      ok: false,
      error: '解码失败：包含非法的 % 转义序列（% 后需跟两位十六进制，且字节组合必须是合法 UTF-8）',
    }
  }
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
