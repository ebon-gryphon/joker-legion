import { performerOf } from './performers.js'
import { faceOf, canSelectHand, effect, uid, clamp, log } from './gameState.js'
import { previewHand } from './handPlan.js'
import { REGIMENTS } from './orders.js'
import { issueOrder } from './recruitOrder.js'
import { shiftedRank } from './deck.js'
import { FIELD_LIMIT } from './campaignRules.js'
import { registerArmy } from './combatStats.js'

export function useTrick(game, targetId, step) {
  if (game.trickUsed) return false
  const hero = performerOf(game.doctrine)
  let text
  if (hero.id === 'sleeve') {
    if (game.phase !== 'shop') return false
    const card = game.hand.find(item => item.id === targetId)
    if (!card) return false
    game.keptCardId = card.id
    text = faceOf(card) + ' 收入袖底，下波起手取回'
  } else if (hero.id === 'voice') {
    const hand = previewHand(game)
    if (!hand.canDeploy || !Object.hasOwn(REGIMENTS,targetId) || hand.target === targetId ||
        ![...game.allies,...hand.recruits].some(unit => unit.type === targetId)) return false
    if (!issueOrder(game,targetId)) return false
    text = game.lastDeploy.name + ' · ' + game.lastDeploy.squad
  } else if (hero.id === 'ghost') {
    if (!canSelectHand(game)) return false
    const card = game.hand.find(item => item.id === targetId)
    const rank = card && shiftedRank(card.rank, step)
    if (!rank) return false
    game.palmedCard = { id:card.id, step }
    text = card.suit + card.rank + ' 换成 ' + card.suit + rank
  } else {
    if (game.phase !== 'battle') return false
    if (hero.id === 'escape') {
      const unit = game.allies.find(ally => ally.id === targetId && ally.hp > 0)
      if (!unit) return false
      unit.lifeline = true
      effect(game,'summon',unit.x,unit.y,'系绳','#c9dea0')
      text = '逃生绳已系在' + unit.name + '身上'
    } else if (hero.id === 'mirror') {
      const unit = game.allies.find(ally => ally.id === targetId && ally.hp > 0)
      if (!unit || game.allies.length >= FIELD_LIMIT || unit.echoUntil != null) return false
      const echo = { ...unit, id:uid(game,'echo'), x:clamp(unit.x-14,60,960), y:clamp(unit.y+12,192,326),
        echoUntil:game.time+6, motion:null, aim:null, impactAt:null, attackTimer:0, hitTimer:0 }
      delete echo.command
      game.allies.push(echo)
      registerArmy(game)
      effect(game,'summon',echo.x,echo.y,'镜像','#cfb0ff')
      text = unit.name + '的分身登场 · 6 秒'
    } else {
      const enemy = game.enemies.find(item => item.id === targetId && item.hp > 0)
      const front = game.allies.filter(ally => ally.hp > 0).reduce((lead, ally) => !lead || ally.x > lead.x ? ally : lead, null)
      if (!enemy || !front) return false
      enemy.lure = { at:game.time, fromX:enemy.x, fromY:enemy.y,
        toX:Math.min(enemy.x, front.x+25), toY:front.y }
      text = enemy.name + '被假牌引向前排'
    }
  }
  game.trickUsed = true
  log(game,hero.name + ' · ' + text,'epic')
  return true
}
