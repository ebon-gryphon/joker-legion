import { copies, owns, spendCharge, trigger, effect, restoreBase } from './gameState.js'
import { waveChange } from './standingArmy.js'
import { scoreContributionRows } from './itemTrace.js'
import { lifeItemPreview, LIFE_RULES } from './playerLife.js'
export { lifeItemPreview } from './playerLife.js'

export function applyLifeRecruitItems(game,hand) {
  game.lifeItemState ??= {redEchoUsed:false,flushCrownUsed:false}
  const result={}
  for(const key of ['redEchoLife','flushCrownLife']) {
    const preview=lifeItemPreview(game,hand)[key]
    if(!preview.available){result[key]={...preview,consumed:false};continue}
    game.lifeItemState[preview.stateKey]=true
    const restored=restoreBase(game,LIFE_RULES.itemHeal,{source:preview.id,sourceId:preview.id})
    result[key]={...preview,restored,consumed:true,
      reason:restored>0?'首次满足条件，实际恢复 '+restored+' 点生命。':'首次满足条件，但生命已满；本波恢复机会已消耗，实际恢复 0。'}
  }
  return result
}

export function scoreItemChips(game, scoring, key, containsPair) {
  return scoreContributionRows(game,scoring,key,containsPair).reduce((sum,row)=>sum+row.delta,0)
}

export function applyRecruitItems(game, recipient) {
  if (!recipient || !copies(game,'blade-oil')) return
  recipient.atk += 3
  recipient.heal += 3
  spendCharge(game,'blade-oil')
  effect(game,'burst',recipient.x ?? 220,recipient.y ?? 240,'磨刃 · 攻疗 +3','#edb37f')
}

export function applyOpeningItems(game) {
  const drums = copies(game,'war-drum'), potion = copies(game,'ward-flask') > 0
  for (const unit of game.allies) {
    if (drums) waveChange(unit,()=> {
      const before = unit.period
      unit.period = Math.max(.35,before * Math.max(.1,1 - drums * .015))
      unit.cooldown *= unit.period / before
    })
    if (potion) unit.shield += 18
    if (owns(game,'oath-standard') && (unit.fusion || unit.fusionJobs?.length > 1)) {
      unit.shield += Math.ceil(unit.maxHp * .08)
    }
  }
  if (drums) trigger(game,'war-drum','全军疾行')
  if (potion) spendCharge(game,'ward-flask')
  if (owns(game,'oath-standard') && game.allies.some(u=>u.fusion || u.fusionJobs?.length > 1)) trigger(game,'oath-standard','融合成员赋盾')
  if (owns(game,'midnight-lantern')) {
    for (const unit of game.enemies) unit.cooldown += .8
    trigger(game,'midnight-lantern','来敌首击延后')
  }
}

export function applyFallenItems(game) {
  if (!owns(game,'revenge-flag')) return
  for (const ally of game.allies) if (ally.hp > 0) waveChange(ally,()=>{ ally.atk += 2; ally.heal += 2 })
  trigger(game,'revenge-flag','队友攻疗 +2')
}
