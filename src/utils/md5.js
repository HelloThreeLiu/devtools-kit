/**
 * 纯 JS MD5（RFC 1321）
 * 仅用于浏览器调试环境的 services mock；uTools 正式环境走 preload 的 node:crypto。
 * 正确性由 tests/hash.spec.js 标准向量保证。
 */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const K = new Array(64)
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32)

const rotl = (x, c) => (x << c) | (x >>> (32 - c))

export function md5Hex(str) {
  const msg = Array.from(new TextEncoder().encode(String(str ?? '')))
  const bitLen = msg.length * 8

  // padding：0x80 + 0…直到 ≡ 56 (mod 64)，再补 64 位小端长度
  msg.push(0x80)
  while (msg.length % 64 !== 56) msg.push(0)
  const lo = bitLen >>> 0
  const hi = Math.floor(bitLen / 2 ** 32)
  msg.push(lo & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff)
  msg.push(hi & 0xff, (hi >>> 8) & 0xff, (hi >>> 16) & 0xff, (hi >>> 24) & 0xff)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let chunk = 0; chunk < msg.length; chunk += 64) {
    const M = new Array(16)
    for (let j = 0; j < 16; j++) {
      M[j] =
        msg[chunk + j * 4] |
        (msg[chunk + j * 4 + 1] << 8) |
        (msg[chunk + j * 4 + 2] << 16) |
        (msg[chunk + j * 4 + 3] << 24)
    }
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F
      let g
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + rotl(F, S[i])) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  return [a0, b0, c0, d0]
    .flatMap((w) => [w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, (w >>> 24) & 0xff])
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
