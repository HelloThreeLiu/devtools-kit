/**
 * 宿主 API 统一入口（技术设计 §2.2）
 * 所有业务代码只允许 import 本模块，禁止直接引用 window.utools / window.services，
 * 以保证浏览器调试（mock 降级）与 uTools 环境行为一致。
 */
import mockUtools from './utools-mock.js'
import mockServices from './services-mock.js'

export const inUtoolsEnv = typeof window !== 'undefined' && !!window.utools

export const utools = inUtoolsEnv ? window.utools : mockUtools
export const services = inUtoolsEnv ? window.services || {} : mockServices

/** 诊断信息：当前装载的 preload 构建标记与可用动作清单（排查渲染/preload 版本偏差用） */
export const servicesInfo = (() => {
  const s = inUtoolsEnv ? window.services || {} : mockServices
  return {
    buildTag: inUtoolsEnv ? String(s.__buildTag || '未标记（v1.2 之前的旧版 preload）') : String(s.__buildTag || 'mock'),
    methods: Object.keys(s)
      .filter((k) => typeof s[k] === 'function')
      .sort()
      .join(', '),
  }
})()
