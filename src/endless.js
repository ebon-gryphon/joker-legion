import {WAVES} from './campaignRules.js'

export const ENDLESS = Object.freeze({
  growth:1.07, lateStart:23, healthGrowth:1.145, attackGrowth:1.10,
  trainingSpan:8, veteranAttack:1800,
  normalDuration:40, bossDuration:60,
  bossHealth:0.83, eliteHealth:1.60, eliteHealthStart:1.14, eliteRampWaves:12, eliteAttack:1.03, wingLane:32,
})
const frontier=WAVES.length
export function endlessScale(game,stat='health') {
  if(game.mode!=='endless' || game.wave<=frontier)return 1
  const lateRate=stat==='attack'?ENDLESS.attackGrowth:ENDLESS.healthGrowth
  return ENDLESS.growth**(Math.min(game.wave,ENDLESS.lateStart)-frontier) * lateRate**Math.max(0,game.wave-ENDLESS.lateStart)
}
export function developmentWave(game) {
  if(game.mode!=='endless' || game.wave<=frontier)return game.wave
  return frontier+ENDLESS.trainingSpan*Math.log1p((game.wave-frontier)/ENDLESS.trainingSpan)
}
export const finalWave=game=>game.mode!=='endless' && game.wave===frontier

export function waveInfo(game,wave=game.wave) {
  if(wave<=frontier)return WAVES[wave-1]
  if(game.mode!=='endless')return undefined
  const boss=wave%6===0
  return {id:wave,name:boss?(wave%12===0?'缀命皇后再临':'无冕之王再临'):'无尽围袭',duration:boss?ENDLESS.bossDuration:ENDLESS.normalDuration,boss}
}

export function eliteHealthFactor(wave){
  const progress=Math.min(1,Math.max(0,(wave-frontier-1)/ENDLESS.eliteRampWaves))
  return ENDLESS.eliteHealthStart+(ENDLESS.eliteHealth-ENDLESS.eliteHealthStart)*progress
}
