import {WAVES} from './campaignRules.js'

export const ENDLESS = Object.freeze({growth:1.07, batchSize:6, batchInterval:4, initialBudget:19, maxBudget:36})
export const endlessScale = (game) => game.mode === 'endless' && game.wave > WAVES.length
  ? ENDLESS.growth ** (game.wave-WAVES.length) : 1
export const finalWave = game => game.mode !== 'endless' && game.wave === WAVES.length
export function waveInfo(game, wave=game.wave) {
  if (wave<=WAVES.length) return WAVES[wave-1]
  if (game.mode!=='endless') return undefined
  const boss=wave%6===0
  return {id:wave,name:boss?(wave%12===0?'缀命皇后再临':'无冕之王再临'):'无尽围袭',duration:boss?90:72,boss}
}
