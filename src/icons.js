/* ============================================================
   SVG 图标集：24 网格单线，2 单位描边，currentColor
   移植自原型 docs/prototype/assets/proto.js（设计令牌 §7.3）
   ============================================================ */

const ICONS = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2.1"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M3.5 10.5h17M8 3.5v4M16 3.5v4"/><circle cx="12" cy="15.2" r="1.4" fill="currentColor" stroke="none"/>',
  base64: '<path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H16M9.5 8.5h5M9.5 12h5M9.5 15.5h5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.7"/><path d="M3.5 16.2l4.2-4.2a1.7 1.7 0 0 1 2.4 0l2.5 2.5 2.5-2.5a1.7 1.7 0 0 1 2.4 0l5 5"/>',
  languages: '<path d="M3.5 5.5h9M8 3v2.5M5.5 5.5c.9 2.9 3.2 5.4 6.3 6.7M10.5 5.5c-1 3.1-3.6 5.7-7 6.9M11.6 21l4.4-9.6L20.4 21M13.3 17.5h5.4"/>',
  json: '<path d="M9.5 4.5c-2.2 0-2.8 1.1-2.8 2.7v2c0 1.5-.8 2.5-2.2 2.8 1.4.3 2.2 1.3 2.2 2.8v2c0 1.6.6 2.7 2.8 2.7M14.5 4.5c2.2 0 2.8 1.1 2.8 2.7v2c0 1.5.8 2.5 2.2 2.8-1.4.3-2.2 1.3-2.2 2.8v2c0 1.6-.6 2.7-2.8 2.7"/>',
  link: '<g transform="rotate(-45 12 12)"><path d="M9.2 7.2H7.8a4.8 4.8 0 0 0 0 9.6h1.4M14.8 7.2h1.4a4.8 4.8 0 0 1 0 9.6h-1.4M9.5 12h5"/></g>',
  radix: '<ellipse cx="7.6" cy="12" rx="3.6" ry="5.6"/><path d="M13.6 7.6l6.4 8.8M20 7.6l-6.4 8.8"/>',
  uuid: '<path d="M8.2 11.5a3.8 3.8 0 0 1 7.6 0c0 3.2-.5 6.2-1.5 8.8M4.8 11.2a7.2 7.2 0 0 1 14.4.4c0 2.6-.2 5-.8 7.4M12 15.2c0 1.9-.3 3.6-.9 5.3M4.9 15.2c.2 1.8 0 3.4-.6 4.8"/>',
  hash: '<path d="M5 9.2h14.5M4.5 14.8H19M10 4.5L7.8 19.5M16.2 4.5L14 19.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.3 3.9 5.1 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.1-3.9-8.5S9.4 5.8 12 3.5z"/>',
  qrcode: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path fill="currentColor" stroke="none" d="M6.1 6.1h1.8v1.8H6.1zM16.1 6.1h1.8v1.8h-1.8zM6.1 16.1h1.8v1.8H6.1zM13.5 13.5h3.2v3.2h-3.2zM17.9 13.5h2.6v2.6h-2.6zM13.5 17.9h2.6v2.6h-2.6zM17.7 17.7h2.8v2.8h-2.8z"/>',
  case: '<path d="M2.5 19L8 4.5 13.5 19M4.4 14.3h7.2M21.5 19v-5.7a2.9 2.9 0 1 0-2.9 2.9h2.9"/>',
  'text-stat': '<path d="M3.5 6h17M3.5 11h8.5M3.5 16h6M15.5 19.5v-5.5M20 19.5V9.5"/>',
  color: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.3a1.9 1.9 0 0 0 1.4-3.2l-.2-.3a1.9 1.9 0 0 1 1.4-3.2h2a3.6 3.6 0 0 0 3.6-3.6C21.5 5.8 17.2 3.5 12 3.5z"/><path fill="currentColor" stroke="none" d="M8.7 10.2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM13.2 7.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM17.6 10.2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/>',
  pipette: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L20.5 20.5"/>',
  'arrow-left': '<path d="M19 12H5.5M11.5 18.5L5 12l6.5-6.5"/>',
  'arrow-right': '<path d="M4.5 12H18M12 6l6 6-6 6"/>',
  'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
  star: '<path d="M12 3.4l2.291 6.044 6.458.311-5.039 4.05 1.696 6.238-5.406-3.543-5.406 3.543 1.696-6.238-5.039-4.05 6.458-.311z"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.2"/>',
  swap: '<path d="M7 4v13.5M3.5 14L7 17.5 10.5 14M17 20V6.5M13.5 10L17 6.5 20.5 10"/>',
  download: '<path d="M19.5 15.5v3.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-3.5M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  moon: '<path d="M20.46 12.78A8.5 8.5 0 1 1 11.22 3.54 6.6 6.6 0 1 0 20.46 12.78z"/>',
  monitor: '<rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M9 20.5h6M12 17v3.5"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 7.8-7.5 9.5-4.3-1.7-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2 3.8-4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.2 10.5V7.2a3.8 3.8 0 0 1 7.6 0v3.3M12 14.2v2.4"/>',
  key: '<circle cx="7.8" cy="15.8" r="3.8"/><path d="M10.6 13L19.5 4.1M16 6.5l3.2 3.2M13.2 9.3l2.4 2.4"/>',
}

let spriteInjected = false

/** 将 symbol 表注入 body（应用挂载前调用一次） */
export function ensureSprite() {
  if (spriteInjected || typeof document === 'undefined') return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.innerHTML = Object.keys(ICONS)
    .map((k) => `<symbol id="i-${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`)
    .join('')
  document.body.prepend(svg)
  spriteInjected = true
}

export const iconNames = Object.keys(ICONS)
