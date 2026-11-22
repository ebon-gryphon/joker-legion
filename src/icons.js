// Original code-native illustrations, shared by the army legend and card UI.
const wrap = (body, color = '#c8a97e') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true"><g stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`

export function unitIcon(type) {
  if (type === 'knight' || type === 'tank') return wrap('<path d="M24 5l13 5v14c0 8-6 13-13 18-7-5-13-10-13-18V10l13-5z" fill="#24434b"/><path d="M24 9v27M15 14l9-4 9 4M18 20l6-5 6 5-6 11-6-11z"/><path d="M7 8v23m-3-9h6M40 17V5l-2 3v9m-3 1h7"/></g><g fill="#e0cc9d"><path d="M24 17l4 4-4 7-4-7z"/>')
  if (type === 'ranger' || type === 'archer') return wrap('<path d="M14 5c24 5 24 33 0 38M14 5l9 19-9 19M7 24h32M34 20l5 4-5 4"/><path d="M10 21l-4-3v6l4 3M14 27l-4-3"/>', '#a5c9ad')
  if (type === 'healer') return wrap('<path d="M24 43V21M18 37h12M14 15c-5-10 7-15 10-7 3-8 15-3 10 7L24 25 14 15z" fill="#2f554c"/><path d="M24 11v9m-4-5h8M10 30l-4-4m32 4l4-4M24 2v2"/>', '#a1d4b9')
  if (type === 'mage' || type === 'arcanist' || type === 'warlock') return wrap('<circle cx="24" cy="23" r="10" fill="#3a365c"/><ellipse cx="24" cy="23" rx="20" ry="6" transform="rotate(-25 24 23)"/><path d="M24 4v6m0 26v8M5 9l4 4m30 22l4 4M10 36l-4 5m31-29l5-4"/><path d="M24 14l2 7 6 2-6 2-2 7-2-7-6-2 6-2 2-7z" fill="#c6b2ed"/>', '#b8a4df')
  return wrap('<path d="M13 37l22-22M10 34l4 4M30 10l8 8-3-11-5 3zM10 10l28 28M8 8l11 3-8 8L8 8z"/><path d="M8 40l7-2-5-5-2 7z"/>', '#d9a0ab')
}

export function jokerIcon(id = '') {
  const key = String(id).toLowerCase()
  if (/shield|aegis|wall|bastion|iron|fort/.test(key)) return unitIcon('knight')
  if (/heal|heart|mercy|red|echo|blood/.test(key)) return unitIcon('healer')
  if (/arrow|ranger|bow|hunt/.test(key)) return unitIcon('ranger')
  if (/mage|arcane|spark|spell/.test(key)) return unitIcon('mage')
  if (/gold|coin|merchant|diamond|bank/.test(key)) return wrap('<circle cx="24" cy="24" r="17" fill="#4a3b2d"/><circle cx="24" cy="24" r="12"/><path d="M24 13v22m6-17c-10-7-17 6-6 6s4 13-6 6"/>', '#d7b27c')
  if (/death|bone|grave|soul/.test(key)) return wrap('<path d="M12 24C5 4 43 4 36 24l-5 4v10H17V28l-5-4z" fill="#403347"/><path d="M19 31v7m5-7v7m5-7v7"/><circle cx="17" cy="21" r="3"/><circle cx="31" cy="21" r="3"/><path d="M24 25l-2 4h4l-2-4z"/>', '#c8a8bc')
  if (/crown|royal|king|throne/.test(key)) return wrap('<path d="M7 13l9 8 8-13 8 13 9-8-5 23H12L7 13z" fill="#443c3e"/><path d="M13 32h22M18 25l6-9 6 9-6 5-6-5z"/><circle cx="7" cy="11" r="2"/><circle cx="24" cy="6" r="2"/><circle cx="41" cy="11" r="2"/>')
  if (/pair|twin|double|mirror/.test(key)) return wrap('<rect x="6" y="9" width="22" height="30" rx="3" fill="#283c43"/><rect x="20" y="6" width="22" height="30" rx="3" fill="#463744"/><path d="M31 13l5 8-5 8-5-8 5-8zM14 20l4 6-4 6-4-6 4-6z"/>')
  if (/straight|march|train|chain/.test(key)) return wrap('<path d="M6 34l10-10 8 8L41 14M31 14h10v10"/><circle cx="9" cy="35" r="3"/><circle cx="24" cy="33" r="3"/>')
  if (/flush|suit|four|season/.test(key)) return wrap('<path d="M24 5l6 7-6 7-6-7 6-7zM24 30l6 7-6 7-6-7 6-7zM5 24l7-6 7 6-7 6-7-6zM30 24l7-6 7 6-7 6-7-6z" fill="#4a3845"/><circle cx="24" cy="24" r="3"/>')
  return wrap('<path d="M9 25L5 9l12 6 7-10 8 10 11-6-4 16M10 25c0 20 28 20 28 0M15 27l5 2m9 0l5-2M17 34c5 5 10 5 15-1"/><circle cx="5" cy="8" r="2"/><circle cx="24" cy="5" r="2"/><circle cx="43" cy="8" r="2"/>')
}
