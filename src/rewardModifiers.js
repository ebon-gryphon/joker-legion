import {lastingStat} from './standingArmy.js'
import {grantExperience} from './training.js'
import {withBuildStatMutation} from './buildPassives.js'

// Earned deltas live in the soldier's permanent stats. This ledger is never
// reapplied on restore, regroup, promotion or fusion.
export const formalArmy=game=>[...(game.allies || []),...(game.reserves || []),...(game.casualties || [])].filter(u=>u.echoUntil==null)
const clean=value=>Math.round(value*1e8)/1e8
export function armyRewardAvailable(game,effect) {
  return formalArmy(game).some(unit=>effect.experience ? (unit.trainingXp || 0)<(effect.xpCap ?? 999) :
    effect.attackPercent ? (unit.rewardModifiers?.attackPercent || 0)<(effect.attackCap ?? Infinity) :
    effect.healthPercent ? (unit.rewardModifiers?.healthPercent || 0)<(effect.healthCap ?? Infinity) : false)
}
export function applyArmyReward(game,effect) {
  if(!armyRewardAvailable(game,effect))return false
  for(const unit of formalArmy(game)) {
    if(effect.experience){grantExperience(game,unit,Math.min(effect.experience,Math.max(0,(effect.xpCap ?? 999)-(unit.trainingXp || 0))));continue}
    withBuildStatMutation(game,unit,()=>{
    const ledger=unit.rewardModifiers ??= {attackPercent:0,healthPercent:0}
    if(effect.attackPercent) {
      const percent=Math.min(effect.attackPercent,Math.max(0,(effect.attackCap ?? Infinity)-ledger.attackPercent))
      for(const key of ['atk','heal'])unit[key]=(unit[key] || 0)+Math.round(lastingStat(unit,key)*percent)
      ledger.attackPercent=clean(ledger.attackPercent+percent)
    }
    if(effect.healthPercent) {
      const percent=Math.min(effect.healthPercent,Math.max(0,(effect.healthCap ?? Infinity)-ledger.healthPercent))
      const ratio=unit.hp/unit.maxHp,gain=Math.round(lastingStat(unit,'maxHp')*percent)
      unit.maxHp+=gain;unit.hp=Math.min(unit.maxHp,unit.maxHp*ratio);ledger.healthPercent=clean(ledger.healthPercent+percent)
    }
    })
  }
  return true
}
export function combinedRewardModifiers(leader,donor) {
  if(!leader.rewardModifiers && !donor.rewardModifiers)return {}
  return {rewardModifiers:Object.fromEntries(['attackPercent','healthPercent'].map(key=>[key,Math.max(leader.rewardModifiers?.[key] || 0,donor.rewardModifiers?.[key] || 0)]))}
}
export const emptyWaveBonuses=()=>({hands:0,discards:0,prints:0,firstScorePercent:0,enlistPatterns:[]})
export function advanceRewardBonuses(game) {
  game.waveBonuses={active:{...emptyWaveBonuses(),...game.waveBonuses?.next},next:emptyWaveBonuses()}
}
