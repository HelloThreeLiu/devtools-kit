#!/usr/bin/env node
/**
 * plugin.json 合规校验（依据 uTools 官方《plugin.json 配置说明》）
 * 用法：node scripts/validate-plugin.mjs [plugin.json 路径]
 * 校验项：JSON 合法性 / 必填字段 / 声明文件存在性 / features 结构 /
 *         指令数量上限（每功能 ≤ 5）与命名非法字符 / 匹配指令 type / code 唯一性
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public', 'plugin.json')

const errors = []
const ok = (msg) => console.log('  ✓ ' + msg)
const err = (msg) => errors.push(msg)

let cfg
try {
  cfg = JSON.parse(readFileSync(file, 'utf-8'))
  ok(`plugin.json 为合法 JSON（${file}）`)
} catch (e) {
  console.error('✗ plugin.json 不是合法 JSON: ' + e.message)
  process.exit(1)
}

const baseDir = dirname(file)

/* ---------- 基础字段 ---------- */

for (const key of ['main', 'logo']) {
  if (typeof cfg[key] !== 'string' || !cfg[key]) err(`缺少必填字段 "${key}"`)
}
if (cfg.preload !== undefined && (typeof cfg.preload !== 'string' || !cfg.preload)) {
  err('"preload" 必须为相对路径字符串')
}

// 文件存在性。main 特殊：通常是 Vite 入口（位于仓库根，构建后进入 dist/），
// 其次在 dev 模式下可为 URL（development.main）。logo/preload 必须在 plugin.json 同级或子目录。
for (const key of ['main', 'logo', 'preload']) {
  const v = cfg[key]
  if (typeof v !== 'string' || !v) continue
  if (key === 'main' && /^https?:\/\//i.test(v)) {
    ok(`${key} → ${v}（URL，仅限 development 场景）`)
    continue
  }
  const beside = join(baseDir, v)
  if (existsSync(beside)) {
    ok(`${key} → ${v}`)
  } else if (key === 'main' && existsSync(join(root, v))) {
    ok(`${key} → ${v}（Vite 入口，构建后位于 dist/）`)
  } else {
    err(`${key} 声明的文件不存在: ${v}`)
  }
}
if (typeof cfg.main === 'string' && cfg.main && !/^https?:\/\//i.test(cfg.main) && !/\.html$/i.test(cfg.main)) {
  err('"main" 必须是 .html 文件（或 dev 模式的 http URL）')
}
if (cfg.development !== undefined) {
  if (typeof cfg.development !== 'object' || cfg.development === null) {
    err('"development" 必须为对象')
  } else if (typeof cfg.development.main === 'string' && !/^https?:\/\//i.test(cfg.development.main)) {
    err('"development.main" 必须为 http(s) URL')
  }
}

/* ---------- features ---------- */

// 官方禁止的指令命名字符（操作系统保留字符）
const FORBIDDEN = /[/\\:*?"<>|]/
const MATCH_TYPES = ['regex', 'over', 'img', 'files', 'window']

if (!Array.isArray(cfg.features) || cfg.features.length < 1) {
  err('"features" 必须为非空数组（插件至少需要一个功能入口）')
} else {
  const codes = new Set()
  cfg.features.forEach((f, i) => {
    const at = `features[${i}]`
    if (typeof f.code !== 'string' || !f.code) {
      err(`${at}.code 缺失或为空`)
    } else if (codes.has(f.code)) {
      err(`${at}.code 重复: ${f.code}`)
    } else {
      codes.add(f.code)
    }

    if (!Array.isArray(f.cmds) || f.cmds.length < 1) {
      err(`${at}.cmds 必须为非空数组`)
      return
    }

    const keywordCmds = f.cmds.filter((c) => typeof c === 'string')
    if (keywordCmds.length > 5) {
      err(`${at} 功能指令数量 ${keywordCmds.length} 超过官方上限 5（超出部分将被 uTools 忽略）`)
    }
    keywordCmds.forEach((c) => {
      if (c.length < 1 || c.length > 80) err(`${at} 指令长度非法（1–80 字符）: "${c}"`)
      if (FORBIDDEN.test(c)) err(`${at} 指令含系统保留字符（\\ / : * ? " < > |）: "${c}"`)
    })

    f.cmds
      .filter((c) => typeof c === 'object' && c !== null)
      .forEach((c) => {
        if (!MATCH_TYPES.includes(c.type)) err(`${at} 匹配指令 type 非法: ${c.type}（应为 ${MATCH_TYPES.join('/')}）`)
        if (typeof c.label !== 'string' || !c.label) err(`${at} 匹配指令缺少 label`)
        if ((c.type === 'regex' || c.type === 'window') && !c.match) err(`${at} 匹配指令 type=${c.type} 缺少 match`)
      })

    ok(`${at} "${f.code}" cmds=${f.cmds.length}${f.description ? '' : '（建议补充 description）'}`)
  })
}

/* ---------- 结果 ---------- */

console.log('')
if (errors.length) {
  console.error('✗ plugin.json 校验未通过:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
console.log('✓ plugin.json 校验通过')
