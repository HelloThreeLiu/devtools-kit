/**
 * DevTools Kit · preload 桥接层
 * 规范（docs/技术设计.md §7）：CommonJS；window.services 统一命名空间；
 * 最小暴露原则——仅暴露「业务动作」，禁止透传 fs/path/child_process 等原始对象。
 */
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const ALGOS = ['md5', 'sha1', 'sha256', 'sha512']

/* ---------- 历史记录文件（插件本地数据目录，不入同步库，官方《数据存储》规范） ---------- */

function historyFile() {
  return path.join(utools.getPluginLocalDataPath(), 'history.json')
}

function readHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(historyFile(), 'utf-8'))
    if (data && typeof data === 'object' && data.version === 1 && data.history) return data
  } catch (e) {
    /* 不存在或损坏 → 返回空结构 */
  }
  return { version: 1, history: {} }
}

function writeHistory(data) {
  const dir = utools.getPluginLocalDataPath()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(historyFile(), JSON.stringify(data), 'utf-8')
}

window.services = {
  /**
   * 哈希计算（PRD 4.3.6）
   * @param {string} text
   * @param {'md5'|'sha1'|'sha256'|'sha512'} algo
   * @returns {string} 小写 hex
   */
  hash(text, algo) {
    if (!ALGOS.includes(algo)) throw new Error('不支持的算法: ' + algo)
    return createHash(algo).update(String(text ?? ''), 'utf-8').digest('hex')
  },

  /** 读取全部历史：{ version, history: { toolId: [{ input, output, ts }] } } */
  historyRead() {
    return readHistory()
  },

  /** 全量覆盖写入（前端负责合并与裁剪） */
  historyWrite(data) {
    if (!data || typeof data !== 'object' || data.version !== 1) return false
    writeHistory(data)
    return true
  },
}
