/**
 * DevTools Kit · preload 桥接层
 * 规范（docs/技术设计.md §7）：CommonJS；window.services 统一命名空间；
 * 最小暴露原则——仅暴露「业务动作」，禁止透传 fs/path/child_process 等原始对象。
 *
 * M2：尚无前端依赖的本地能力，保留命名空间占位。
 * P1 计划增加（届时同步 services-mock.js）：
 *   - hash(text, algo)        哈希计算，node:crypto
 *   - historyRead()           历史记录读取，本地数据目录 history.json
 *   - historyWrite(data)      历史记录写入
 */
window.services = {}
