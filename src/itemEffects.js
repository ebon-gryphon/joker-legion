import { copies, owns, spendCharge, trigger, effect } from './gameState.js'
import { waveChange } from './standingArmy.js'

export function scoreItemChips(game, scoring, key) {
  const red = scoring.filter(c => ['♥','♦'].includes(c.suit)).length
  const black = scoring.length - red
  const court = scoring.filter(c => ['J','Q','K'].includes(c.rank)).length
  return copies(game,'score-chalk') * 2 + copies(game,'red-thread') * red +
    copies(game,'black-wax') * black + copies(game,'court-seal') * court * 2 +
    (['straight','straightFlush'].includes(key) ? copies(game,'straight-compass') * 4 : 0) +
    (copies(game,'score-ticket') ? 10 : 0)
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
