export const W = 1000, H = 360

export const C = { ink: '#100e1b', steel: '#8fa8d3', red: '#d77e8c', amber: '#d2ab68', violet: '#b6a0e1', gold: '#d3b27a', ivory: '#f0dfba' }

export function hash(value) { let n = 2166136261; for (const ch of String(value)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return (n >>> 0) / 4294967295 }

export const snap = value => Math.round(value / 2) * 2

export function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(snap(x), snap(y), Math.max(2, snap(w)), Math.max(2, snap(h))) }

export function line(c, x0, y0, x1, y1, color, size = 2) {
  const dx = x1 - x0, dy = y1 - y0, count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2))
  for (let i = 0; i <= count; i++) rect(c, x0 + dx * i / count, y0 + dy * i / count, size, size, color)
}

export function outline(c, x, y, w, h, color) { rect(c, x, y, w, 2, color); rect(c, x, y + h - 2, w, 2, color); rect(c, x, y, 2, h, color); rect(c, x + w - 2, y, 2, h, color) }

export function cross(c, x, y, r, color) { rect(c, x - r, y, r * 2 + 2, 2, color); rect(c, x, y - r, 2, r * 2 + 2, color) }

export function disk(c, x, y, r, color) { for (let dy = -r; dy <= r; dy += 2) { const span = Math.sqrt(Math.max(0, r * r - dy * dy)); rect(c, x - span, y + dy, span * 2, 2, color) } }

export function diamond(c, x, y, rx, ry, color) { line(c, x, y - ry, x + rx, y, color); line(c, x + rx, y, x, y + ry, color); line(c, x, y + ry, x - rx, y, color); line(c, x - rx, y, x, y - ry, color) }

export function glyph(c, x, y, pixels, color, scale = 2) {
  c.fillStyle = color
  for (let row = 0; row < pixels.length; row++) for (let col = 0; col < pixels[row].length; col++) if (pixels[row][col] !== ' ') c.fillRect(snap(x + col * scale), snap(y + row * scale), scale, scale)
}
