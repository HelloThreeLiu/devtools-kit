/**
 * 工具注册表 —— 新增工具的唯一扩展点（技术设计 §5.1）
 * 步骤：1) 本文件注册  2) src/tools/<id>/index.vue 实现页面
 *       3) utils/convert/<id>.js 纯函数（可选）  4) public/plugin.json 增加 feature
 */
import TimestampTool from './timestamp/index.vue'
import Base64Tool from './base64/index.vue'
import UrlCodecTool from './url-codec/index.vue'
import JsonTool from './json/index.vue'
import RadixTool from './radix/index.vue'
import UuidTool from './uuid/index.vue'
import DateCalcTool from './date-calc/index.vue'

/** 主入口 feature.code（指向主界面） */
export const MAIN_CODE = 'devtools-kit'

/** 工具分类（主界面页签） */
export const CATEGORIES = [
  { id: 'codec', name: '编解码' },
  { id: 'datetime', name: '时间日期' },
  { id: 'text', name: '文本生成' },
  { id: 'design', name: '设计辅助' },
]

/**
 * @typedef {Object} ToolDef
 * @property {string} id          内部唯一 id（路由/数据库/历史使用）
 * @property {string} code        plugin.json feature.code（搜索直达入口）
 * @property {string} name        工具名称
 * @property {string} description 一句话描述（列表与详情展示）
 * @property {string} icon        图标名（src/icons.js）
 * @property {string} category    CATEGORIES 中的 id
 * @property {string} priority    'P0' | 'P1' | 'P2'
 * @property {string[]} cmds      plugin.json cmds（搜索直达关键词，≤ 5）
 * @property {string} keywords    主界面过滤的补充关键词（空格分隔）
 * @property {Object|null} component Vue 组件；null = 尚未实现
 */
export const tools = [
  {
    id: 'timestamp',
    code: 'timestamp',
    name: '时间戳转换',
    description: '秒 / 毫秒时间戳与日期时间双向转换',
    icon: 'clock',
    category: 'codec',
    priority: 'P0',
    cmds: ['时间戳', '时间戳转换', 'timestamp'],
    keywords: 'unix epoch 毫秒 日期转时间戳 now',
    component: TimestampTool,
  },
  {
    id: 'base64',
    code: 'base64',
    name: 'Base64 编解码',
    description: '文本与 Base64 双向转换，自动识别方向',
    icon: 'base64',
    category: 'codec',
    priority: 'P0',
    cmds: ['base64', 'Base64转码', 'base64编码'],
    keywords: 'encode decode 编码 解码 b64',
    component: Base64Tool,
  },
  {
    id: 'url-codec',
    code: 'url-codec',
    name: 'URL 编解码',
    description: 'URL 编解码与查询参数结构化解析',
    icon: 'link',
    category: 'codec',
    priority: 'P0',
    cmds: ['url编码', 'url解码', 'URL编解码'],
    keywords: 'uri encode decode 参数 转义',
    component: UrlCodecTool,
  },
  {
    id: 'json',
    code: 'json',
    name: 'JSON 格式化',
    description: '格式化、压缩、校验并定位语法错误',
    icon: 'json',
    category: 'codec',
    priority: 'P0',
    cmds: ['json', 'JSON格式化', 'json校验'],
    keywords: 'format 格式化 校验 压缩',
    component: JsonTool,
  },
  {
    id: 'radix',
    code: 'radix',
    name: '进制转换',
    description: '2 / 8 / 10 / 16 进制互转，大数安全',
    icon: 'radix',
    category: 'codec',
    priority: 'P0',
    cmds: ['进制转换', '进制', 'hex转十进制'],
    keywords: 'hex bin oct 二进制 八进制 十六进制 0x bigint',
    component: RadixTool,
  },
  {
    id: 'hash',
    code: 'hash',
    name: '哈希计算',
    description: 'MD5 / SHA-1 / SHA-256 / SHA-512',
    icon: 'hash',
    category: 'codec',
    priority: 'P1',
    cmds: ['哈希', 'hash', 'md5', 'sha'],
    keywords: 'md5 sha 摘要 digest',
    component: null, // P1
  },
  {
    id: 'unicode',
    code: 'unicode',
    name: 'Unicode 转中文',
    description: '\\uXXXX 转义与中文互转',
    icon: 'globe',
    category: 'codec',
    priority: 'P1',
    cmds: ['unicode', 'unicode转中文'],
    keywords: '转义 实体 u4f60',
    component: null, // P1
  },
  {
    id: 'date-calc',
    code: 'date-calc',
    name: '日期换算',
    description: '农历、星期、年内序数与日期差',
    icon: 'calendar',
    category: 'datetime',
    priority: 'P0',
    cmds: ['日期换算', '农历', '日期计算', 'datecalc'],
    keywords: '时间日期 农历 星期 天数差 lunar iso 周',
    component: DateCalcTool,
  },
  {
    id: 'uuid',
    code: 'uuid',
    name: 'UUID 生成',
    description: 'UUID v4 批量生成，多种格式',
    icon: 'uuid',
    category: 'text',
    priority: 'P0',
    cmds: ['uuid', 'UUID生成', 'guid'],
    keywords: 'guid 标识 生成 v4',
    component: UuidTool,
  },
  {
    id: 'case-convert',
    code: 'case-convert',
    name: '命名风格转换',
    description: 'camel / snake / kebab 等五种命名互转',
    icon: 'case',
    category: 'text',
    priority: 'P1',
    cmds: ['命名转换', '驼峰转换'],
    keywords: 'camel snake kebab 大小写 constant',
    component: null, // P1
  },
  {
    id: 'text-stat',
    code: 'text-stat',
    name: '文本统计',
    description: '字数、行数、UTF-8 字节数统计',
    icon: 'text-stat',
    category: 'text',
    priority: 'P1',
    cmds: ['文本统计', '字数统计'],
    keywords: 'count 字数 行数 utf8',
    component: null, // P1
  },
  {
    id: 'qrcode',
    code: 'qrcode',
    name: '二维码生成',
    description: '文本转二维码，本地生成可复制',
    icon: 'qrcode',
    category: 'text',
    priority: 'P1',
    cmds: ['二维码', 'qrcode'],
    keywords: '扫码 扫码识别',
    component: null, // P1
  },
  {
    id: 'color',
    code: 'color',
    name: '颜色格式转换',
    description: 'HEX / RGB / HSL 互转与预览',
    icon: 'color',
    category: 'design',
    priority: 'P1',
    cmds: ['颜色转换', 'color', '取色'],
    keywords: 'hex rgb hsl 取色 设计',
    component: null, // P1
  },
]

export const toolById = Object.fromEntries(tools.map((t) => [t.id, t]))
export const toolByCode = Object.fromEntries(tools.map((t) => [t.code, t]))
