/**
 * 二维码生成（PRD 4.5.4）
 * qrcode 库纯本地生成；输出 Data URL 供预览与 utools.copyImage 复制
 */
import QRCode from 'qrcode'

/**
 * @param {string} text
 * @param {{ width?: number, dark?: string, light?: string }} opts
 * @returns {Promise<{ ok:true, dataUrl:string }> | { ok:false, error:string }}
 */
export async function makeQr(text, opts = {}) {
  const s = String(text ?? '')
  if (!s) return { ok: false, error: '没有可生成的内容' }
  try {
    const dataUrl = await QRCode.toDataURL(s, {
      width: opts.width || 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: opts.dark || '#1f2328ff', light: '#ffffff00' },
    })
    return { ok: true, dataUrl }
  } catch (e) {
    return { ok: false, error: `生成失败：${e.message}（内容过长或包含无法编码的字符）` }
  }
}
