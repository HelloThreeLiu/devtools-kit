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
