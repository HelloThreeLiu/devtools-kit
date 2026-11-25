# DevTools Kit · uTools 开发工具箱

[![CI](https://github.com/HelloThreeLiu/devtools-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/HelloThreeLiu/devtools-kit/actions/workflows/ci.yml)

> 面向开发者的 uTools 一站式开发工具箱：时间戳转换、日期换算（农历/日期差）、Base64、JSON 格式化等高频小工具。**全部本地计算，数据不出本机。**

## 特性（规划，见 docs/PRD.md）

- 🧰 高频开发工具聚合，P0 七件套：时间戳转换 / 日期换算 / Base64 / URL 编解码 / JSON 格式化 / 进制转换 / UUID 生成
- ⚡ 输入即转换 + 一键复制，键盘优先；支持 uTools 搜索直达与智能匹配（粘贴时间戳/颜色/URL/JSON 自动进入对应工具）
- 🖥️ 支持 **Windows / macOS / Linux**（跟随 uTools Runtime，CI 在三平台矩阵构建）
- 🌗 暗色模式（跟随系统 / 手动），历史记录与收藏仅存本机

## 开发

环境要求：Node.js ≥ 18；[uTools 开发者工具](https://www.u-tools.cn/docs/getting-started/overview.html)（uTools 插件市场搜索安装）。

```bash
npm install
npm run dev     # Vite 开发服务器，浏览器直接调试 UI（无需 uTools）
npm run build   # 生产构建 → dist/（即 uTools 插件应用目录）
npm run check   # plugin.json 合规校验 + 构建 + dist 插件结构校验
```

联调：uTools 开发者工具「新建项目」指向仓库根目录（`plugin.json` 的 `development.main` 已指向 `http://localhost:5173`），详见 [docs/技术设计.md](docs/技术设计.md) §4。

## 文档

| 文档 | 说明 |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | 产品需求文档（含验收标准与迭代规划） |
| [docs/技术设计.md](docs/技术设计.md) | 技术方案（架构 / 路由 / 数据层 / 实现要点） |
| [docs/设计令牌.md](docs/设计令牌.md) | UI 设计令牌规范（**所有 UI 改动必须遵循**） |
| [docs/prototype/index.html](docs/prototype/index.html) | 高保真可交互原型（浏览器直接打开审阅） |

## CI

每次 push / PR 在 **Windows / Linux / macOS** 三平台矩阵执行：依赖安装 → `plugin.json` 合规校验（对照 uTools 官方规范）→ Vite 构建 → dist 插件结构校验（确保产物可直接被 uTools 开发者工具打包）。
