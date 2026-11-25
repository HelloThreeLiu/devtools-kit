import { describe, expect, test } from 'vitest'
import { makeQr } from '../src/utils/convert/qrcode.js'

describe('二维码生成冒烟（PRD 4.5.4）', () => {
  test('文本生成 PNG Data URL', async () => {
    const r = await makeQr('https://github.com/HelloThreeLiu/devtools-kit')
    expect(r.ok).toBe(true)
    expect(r.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  test('中文内容可生成', async () => {
    const r = await makeQr('你好，DevTools Kit')
    expect(r.ok).toBe(true)
  })

  test('空内容报错', async () => {
    const r = await makeQr('')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('没有可生成的内容')
  })
})
