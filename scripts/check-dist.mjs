#!/usr/bin/env node
/**
 * dist 插件结构校验：确保构建产物满足 uTools「插件应用目录」要求
 * （官方：交付给 uTools 的插件目录需包含 plugin.json 声明的全部文件）
 * 用法：node scripts/check-dist.mjs [dist 路径] [源 plugin.json 路径]
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, resolve, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist')
const srcCfg = process.argv[3] ? resolve(process.argv[3]) : join(root, 'public', 'plugin.json')

const errors = []
const ok = (msg) => console.log('  ✓ ' + msg)

if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  console.error('✗ dist 目录不存在，请先执行 npm run build')
  process.exit(1)
}

/* ---------- plugin.json 及其声明文件 ---------- */

let cfg = null
try {
  cfg = JSON.parse(readFileSync(join(dist, 'plugin.json'), 'utf-8'))
  ok('dist/plugin.json 存在且为合法 JSON')
} catch {
  errors.push('dist/plugin.json 缺失或非法（public/ 资源未被构建拷贝？）')
}

if (cfg) {
  const declared = ['main', 'logo', ...(cfg.preload ? ['preload'] : [])]
  for (const key of declared) {
    const p = join(dist, cfg[key])
    if (existsSync(p)) ok(`${key} → dist/${cfg[key]}`)
    else errors.push(`dist/${cfg[key]} 缺失（"${key}" 声明所必需）`)
  }
}

/* ---------- 前端构建资源 ---------- */

const assets = join(dist, 'assets')
if (existsSync(assets) && statSync(assets).isDirectory()) {
  const files = readdirSync(assets)
  const js = files.filter((f) => extname(f) === '.js')
  if (js.length > 0) ok(`assets/ 构建产物 ${files.length} 个文件（js ${js.length} 个）`)
  else errors.push('assets/ 中没有 js 构建产物')
} else {
  errors.push('dist/assets/ 缺失（Vite 构建未执行或 publicDir 配置错误）')
}

const htmlPath = join(dist, 'index.html')
if (existsSync(htmlPath)) {
  const content = readFileSync(htmlPath, 'utf-8')
  if (/assets\//.test(content)) ok('index.html 引用了 assets/ 构建资源（base 相对路径正确）')
  else errors.push('index.html 未引用 assets/（vite base 配置必须为 "./"）')
} else if (cfg && cfg.main) {
  errors.push(`dist/${cfg.main}（入口 HTML）缺失`)
}

/* ---------- 与源配置一致性（防止 public/ 资源过期） ---------- */

try {
  const src = JSON.parse(readFileSync(srcCfg, 'utf-8'))
  if (JSON.stringify(src) !== JSON.stringify(cfg)) {
    errors.push('dist/plugin.json 与 public/plugin.json 不一致，请重新构建')
  } else {
    ok('dist/plugin.json 与源配置一致')
  }
} catch {
  /* 源文件合法性由 validate-plugin.mjs 负责 */
}

/* ---------- 结果 ---------- */

console.log('')
if (errors.length) {
  console.error('✗ dist 插件结构校验未通过:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
console.log('✓ dist 插件结构校验通过')
