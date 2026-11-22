import { rect, W, H, C, disk, hash, cross, line, diamond, glyph } from './pixelDrawing.js'

export const SPADE = ['   x   ', '  xxx  ', ' xxxxx ', 'xxxxxxx', 'xxxxxxx', ' xx xx ', '   x   ', '  xxx  ']

export const CROWN = ['x  x  x', 'xx x xx', 'xxxxxxx', ' xxxxx ', ' xxxxx ', '       ', ' xxxxx ']

export function backdrop(c) {
  rect(c, 0, 0, W, H, C.ink)
  rect(c, 0, 0, W, 70, '#12101f'); rect(c, 0, 70, W, 54, '#191629'); rect(c, 0, 124, W, 46, '#201d32')
  disk(c, 380, 42, 24, '#c2b89d'); disk(c, 390, 32, 24, '#12101f')
  for (let i = 0; i < 46; i++) {
    const x = 92 + hash(`star-x-${i}`) * 824, y = 8 + hash(`star-y-${i}`) * 108
    rect(c, x, y, 2, 2, i % 4 ? '#5e566d' : '#ae9f91'); if (i % 11 === 0) cross(c, x, y, 3, '#b5a693')
  }
  // Pixel clouds and stepped ridges behind the broken imperial wall.
  for (const [x, y, w] of [[144, 46, 102], [548, 26, 136], [704, 81, 122]]) {
    rect(c, x, y + 8, w, 10, '#242033'); rect(c, x + 20, y, w - 52, 10, '#242033')
    rect(c, x + 36, y - 6, w - 82, 8, '#242033'); rect(c, x + 15, y + 18, w - 36, 4, '#1e1a2c')
  }
  for (let x = 0; x < W; x += 4) rect(c, x, 112 + Math.sin(x * .014) * 14 + Math.sin(x * .042 + .7) * 8, 4, 70, '#19182a')
  rect(c, 104, 116, 792, 54, '#201d2d')
  for (let x = 104; x < 896; x += 18) rect(c, x, 108, 11, 12, '#242030')
  for (let x = 119; x < 890; x += 36) {
    rect(c, x, 132, 16, 30, '#111321'); rect(c, x + 4, 126, 8, 8, '#111321'); rect(c, x, 160, 17, 2, '#383041')
  }
  for (const [x, top, w] of [[206, 65, 30], [334, 90, 22], [680, 56, 34], [792, 85, 24]]) {
    rect(c, x, top + 16, w, 82, '#242032'); rect(c, x + 4, top + 4, w - 8, 17, '#242032'); rect(c, x + w / 2 - 2, top - 9, 4, 18, '#6e5d62')
    for (let i = 0; i < 3; i++) { rect(c, x + w / 2 - 3, top + 25 + i * 21, 6, 11, '#71604d'); rect(c, x + w / 2 - 1, top + 27 + i * 21, 2, 6, '#b09364') }
    rect(c, x - 4, top + 17, w + 8, 4, '#403443')
  }
  rect(c, 0, 162, W, H - 162, '#2b2638')
  for (const [y, h, color] of [[162, 18, '#393044'], [180, 18, '#342d42'], [198, 26, '#302a3d'], [224, 32, '#2c273a'], [256, 38, '#282436'], [294, 66, '#242132']]) rect(c, 0, y, W, h, color)
  for (let row = 0; row < 9; row++) {
    const y = 166 + row * 12 + row * row * 1.4, tile = 44 + row * 9
    rect(c, 0, y, W, 2, '#1f1c2d'); rect(c, 0, y + 2, W, 2, '#45394b')
    for (let x = -tile; x < W + tile; x += tile) {
      const xx = x + (row % 2 ? tile / 2 : 0)
      line(c, xx, y + 4, xx + (xx - 500) * .035, y + 16 + row * 3, '#1b1a2a')
      if (hash(`${row}-chip-${x}`) > .75) { rect(c, xx + 8, y + 7, 10, 2, '#51414e'); rect(c, xx + 12, y + 9, 4, 2, '#1c1a29') }
    }
  }
  diamond(c, 500, 264, 115, 36, '#64505a'); diamond(c, 500, 264, 103, 32, '#403747'); diamond(c, 500, 264, 70, 23, '#4a3d4e'); glyph(c, 492, 252, SPADE, '#756058')
  for (const y of [211, 255, 300]) for (const x of [196, 804]) cross(c, x, y, 4, '#6b5660')
  for (let i = 0; i < 50; i++) {
    const x = hash(`rubble-x-${i}`) * W, y = 338 + hash(`rubble-y-${i}`) * 20
    rect(c, x, y, 6 + hash(`rubble-w-${i}`) * 9, 3, '#4d3f48')
    if (i % 3 === 0) { line(c, x, y, x - 2, y - 8, '#67514b'); line(c, x, y, x + 4, y - 6, '#4f464c') }
  }
  rect(c, 0, 354, W, 6, '#151420')
}

export function banner(c, x, y, ally, time) {
  const cloth = ally ? '#394567' : '#71333f', sway = Math.floor(time * 2 + x) % 3 - 1
  rect(c, x, y - 10, 4, 90, '#735c50'); rect(c, x - 2, y - 14, 8, 6, C.gold); rect(c, x + 2, y, 38, 4, '#b28d64')
  rect(c, x + 6, y + 4, 30, 30, cloth); rect(c, x + 6 + sway * 2, y + 34, 30, 18, cloth)
  rect(c, x + 6 + sway * 2, y + 52, 12, 6, cloth); rect(c, x + 30 + sway * 2, y + 52, 6, 6, cloth)
  rect(c, x + 8, y + 4, 2, 43, '#c7a978'); rect(c, x + 32, y + 4, 2, 43, '#a28765')
  glyph(c, x + 14, y + 17, ally ? SPADE : CROWN, C.ivory)
}

export function gate(c, ally, time, hp = 100, maxHp = 100) {
  const x = ally ? 65 : 935, tint = ally ? '#6d9ed1' : '#d87387'
  for (const dx of [-50, 33]) {
    rect(c, x + dx, 112, 18, 134, '#403344'); rect(c, x + dx + 4, 112, 8, 130, '#55434d'); rect(c, x + dx - 4, 102, 26, 14, '#735a59')
    for (const d of [-4, 6, 16]) rect(c, x + dx + d, 98, 6, 8, '#a6896b')
    rect(c, x + dx - 7, 244, 31, 10, '#2c2639'); rect(c, x + dx - 7, 244, 31, 2, '#8a6d62')
    for (let yy = 127; yy < 240; yy += 18) rect(c, x + dx, yy, 18, 2, '#292536')
  }
  rect(c, x - 34, 128, 68, 116, '#aa8a68'); rect(c, x - 28, 126, 56, 120, '#171526'); rect(c, x - 24, 138, 48, 102, ally ? '#242d4c' : '#412334')
  rect(c, x - 18, 128, 36, 14, ally ? '#364464' : '#693443'); rect(c, x - 12, 122, 24, 10, '#a3886b'); rect(c, x - 6, 116, 12, 10, '#d2b27b')
  for (let dx = -18; dx <= 18; dx += 9) rect(c, x + dx, 144, 2, 96, ally ? '#455776' : '#79404b')
  for (let i = 0; i < 6; i++) rect(c, x - 23, 152 + i * 16, 46, 2, ally ? '#48617c' : '#794653')
  rect(c, x - 29, 238, 58, 4, '#c3a278'); rect(c, x - 38, 250, 76, 4, '#75616a')
  const pulse = Math.floor(time * 3) % 3
  for (const dx of [-44, 44]) {
    rect(c, x + dx - 2, 204, 4, 30, '#a18465'); rect(c, x + dx - 7, 201, 14, 5, '#71534d')
    rect(c, x + dx - 5, 191, 10, 10, tint); rect(c, x + dx - 3, 184 + pulse * 2, 6, 13 - pulse * 2, C.ivory); rect(c, x + dx + 3, 188 - pulse * 2, 4, 10, tint)
  }
  if (ally && hp / Math.max(1, maxHp) < .4) { line(c, x - 34, 158, x - 27, 176, '#cb6f7e'); line(c, x - 27, 176, x - 32, 193, '#cb6f7e'); line(c, x + 38, 200, x + 32, 218, '#cb6f7e') }
}
