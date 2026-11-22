// At most one wagon pays per wave. Times use the simulation clock.
export const PAY_WAGONS = [
  { id: 'scout', name: '轻车', opens: 2, closes: 7, score: 40, gold: 3 },
  { id: 'payroll', name: '军饷重车', opens: 7, closes: 15, score: 100, gold: 7 },
]

export function hasConvoy(game) {
  return game.wave <= 2
}

export function activeWagon(game) {
  if (game.phase !== 'battle' || game.convoyTaken || !hasConvoy(game)) return null
  return PAY_WAGONS.find(wagon => wagon.id !== game.convoyTaken && game.waveTime >= wagon.opens && game.waveTime < wagon.closes) || null
}

export function wagonPosition(wagon, seconds) {
  const progress = Math.min(1, Math.max(0, (seconds - wagon.opens) / (wagon.closes - wagon.opens)))
  return { x: 855 - 535 * progress, y: 190 }
}

export function plannedWagon(game) {
  return hasConvoy(game) ? PAY_WAGONS.findLast(wagon => game.preparedScore >= wagon.score) : null
}
