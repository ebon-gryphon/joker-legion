import {WAVES} from './campaignRules.js'

export const ENDLESS = Object.freeze({
  growth:1.07, lateStart:23, healthGrowth:1.145, attackGrowth:1.10,
  trainingSpan:8, veteranAttack:1800,
  batchSize:6, batchInterval:4, initialBudget:19, maxBudget:36,
  reserveStart:19, reserveSize:3, reserveDelay:7, closingWindow:18, escortWindow:10, raidWindow:4,
  firstClosingWindow:16, bossDuration:90,
})
const frontier=WAVES.length
export function endlessScale(game,stat='health') {
  if(game.mode!=='endless' || game.wave<=frontier)return 1
  if(game.endlessRevision===1)return ENDLESS.growth**(game.wave-frontier)
  const lateRate=stat==='attack'?ENDLESS.attackGrowth:ENDLESS.healthGrowth
  return ENDLESS.growth**(Math.min(game.wave,ENDLESS.lateStart)-frontier) * lateRate**Math.max(0,game.wave-ENDLESS.lateStart)
}
export function developmentWave(game) {
  if(game.mode!=='endless' || game.wave<=frontier || game.endlessRevision===1)return game.wave
  return frontier+ENDLESS.trainingSpan*Math.log1p((game.wave-frontier)/ENDLESS.trainingSpan)
}
export const endlessBudget=wave=>Math.min(ENDLESS.maxBudget,ENDLESS.initialBudget+2*Math.floor((wave-frontier-1)/3))
export const hasRearguard=wave=>wave>=ENDLESS.reserveStart && wave%6!==0
export const lastBatchTime=wave=>Math.floor((endlessBudget(wave)-1)/ENDLESS.batchSize)*ENDLESS.batchInterval+(hasRearguard(wave)?ENDLESS.reserveDelay:0)
export const finalWave=game=>game.mode!=='endless' && game.wave===frontier

export function waveInfo(game,wave=game.wave) {
  if(wave<=frontier)return WAVES[wave-1]
  if(game.mode!=='endless')return undefined
  const boss=wave%6===0
  const window=!hasRearguard(wave)?ENDLESS.firstClosingWindow:[ENDLESS.closingWindow,ENDLESS.escortWindow,ENDLESS.raidWindow][wave%3]
  const duration=boss?ENDLESS.bossDuration:game.endlessRevision===1 && wave===game.wave?72:lastBatchTime(wave)+window
  return {id:wave,name:boss?(wave%12===0?'缀命皇后再临':'无冕之王再临'):'无尽围袭',duration,boss}
}
