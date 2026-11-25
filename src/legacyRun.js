import {LEGACY_NODES, SUPPLY_ITEMS, emptyLevels, validLevels, validId} from './legacyRules.js'
import {JOKER_BY_ID} from './campaignRules.js'
import {seedNumber,random} from './gameState.js'

export function newRunId(){
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')
}
export function supplyFor(seed){
  const stream={rng:seedNumber('legion/start-supply/v1/'+seed)}
  return SUPPLY_ITEMS[Math.floor(random(stream)*SUPPLY_ITEMS.length)]
}
export const initialBonus=(levels,id)=>levels[id]*LEGACY_NODES.find(node=>node.id===id).amount
export function openingLines(inheritance){
  if(!inheritance)return []
  return LEGACY_NODES.filter(n=>inheritance.levels[n.id]>0).map(n=>
    n.name+' · '+(n.id==='supplies'?JOKER_BY_ID[inheritance.itemId].name:n.effect(inheritance.levels[n.id]*n.amount)))
}
export const energyLimit=game=>game.maxEnergy+(game.wave===1 && game.inheritance?initialBonus(game.inheritance.levels,'orders'):0)

export function applyInheritance(game,runId,levels=emptyLevels()){
  if(game.runId || game.phase!=='ready' || game.wave!==1 || !validId(runId) || !validLevels(levels))throw Error('开局传承参数无效')
  game.runId=runId
  const itemId=levels.supplies?supplyFor(game.seed):null
  game.inheritance={levels:{...levels},itemId,refreshUsed:false,bossWaves:[]}
  game.gold+=initialBonus(levels,'treasury')
  game.crystals+=initialBonus(levels,'crystals')
  game.stats.crystalsEarned+=initialBonus(levels,'crystals')
  game.discards+=initialBonus(levels,'rehearsal')
  game.energy=energyLimit(game)
  if(itemId)game.jokers.push({...JOKER_BY_ID[itemId],quantity:1,triggers:0,flash:0})
}

// Give a pre-profile expedition a stable identity only when it resumes. Completed old runs never enroll.
export function enrollOldRun(game){
  if(game.runId || !['ready','battle','shop'].includes(game.phase))return
  game.runId='legacy/'+game.mode+'/'+game.combatLedger.runId
  const bossWaves=[]
  for(let wave=6;wave<=game.stats.wavesCleared;wave+=6)bossWaves.push(wave)
  if(game.phase==='battle' && game.wave%6===0 && game.schedule.some(s=>['boss','finalBoss'].includes(s.type)) && !game.enemies.some(u=>['boss','finalBoss'].includes(u.type)) &&
    !bossWaves.includes(game.wave))bossWaves.push(game.wave)
  game.inheritance={levels:emptyLevels(),itemId:null,refreshUsed:false,bossWaves}
}
export function validRunInheritance(g){
  if(g.runId===undefined && g.inheritance===undefined)return true
  const s=g.inheritance
  return validId(g.runId) && s && validLevels(s.levels) && s.itemId===(s.levels.supplies?supplyFor(g.seed):null) &&
    typeof s.refreshUsed==='boolean' && (!s.refreshUsed || s.levels.contract>0) && Array.isArray(s.bossWaves) &&
    s.bossWaves.every((wave,i)=>Number.isSafeInteger(wave) && wave>=6 && wave%6===0 && wave<=g.wave && (!i || wave>s.bossWaves[i-1]))
}

