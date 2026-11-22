// Orders and commissions can modify the same four attributes as permanent training.
const attributes = ['maxHp', 'atk', 'heal', 'period']

export function lastingStat(unit, key) {
  return (unit[key] || 0) - (unit.waveBonus?.[key] || 0)
}

export function waveChange(unit, change) {
  const before = attributes.map(key => unit[key] || 0)
  change()
  for (const [i,key] of attributes.entries()) {
    const delta = (unit[key] || 0) - before[i]
    if (delta) {
      unit.waveBonus ??= {}
      unit.waveBonus[key] = (unit.waveBonus[key] || 0) + delta
    }
  }
}

export function restedSoldier(unit) {
  const rested = { ...unit }
  for (const key of attributes) rested[key] = lastingStat(unit,key)
  for (const key of ['waveBonus','echoUntil','command','crowned','marching','royalWard','royalStars',
    'legendGuard','lifeline','aim','motion','impactAt','lure']) delete rested[key]
  return Object.assign(rested, { hp:rested.maxHp, shield:0, attacks:0, cooldown:0, hitTimer:0, attackTimer:0, skillCharge:0 })
}
