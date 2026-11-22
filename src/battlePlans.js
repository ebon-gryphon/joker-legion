import { REGIMENTS } from './orders.js'
import { activeWagon, plannedWagon, wagonPosition } from './convoy.js'
import { gainGold, effect, log } from './gameState.js'
import { nextChime, BELL_INTERVAL } from './tactics.js'
import { isBoss } from './bossRules.js'

export const FEINT = { opens: 5, reveal: 7, closes: 18, stake: 2, payout: 5, delay: 2 }

export function scoutRead(game, flag = game.feint?.flag) {
  const scores = Object.fromEntries(Object.keys(REGIMENTS).map(type => [type, 0]))
  for (const unit of game.allies) if (unit.hp > 0) scores[unit.type] += unit.level
  const fielded = Object.keys(scores).filter(type => scores[type] > 0)
  for (const type of fielded) {
    if (type === game.lastDeploy?.target) scores[type] += 3
    if (type === flag) scores[type] += 4
  }
  const target = fielded.sort((a,b) => scores[b] - scores[a])[0] || null
  return { target, scores, fielded }
}

export function setFeintFlag(game, flag) {
  if (game.phase !== 'ready') return false
  if (flag === null) { game.feint = null; return true }
  if (!Object.hasOwn(REGIMENTS, flag) || game.gold < FEINT.stake) return false
  const { fielded } = scoutRead(game, flag)
  if (fielded.length < 2 || !fielded.includes(flag)) return false
  game.feint = { flag, target: null, result: 'planned' }
  return true
}

export function resolvePreparedTactics(game) {
  if (game.feint?.result === 'active' && game.waveTime >= FEINT.reveal) {
    settleFeint(game,game.lastDeploy?.target)
  }
  const wagon = activeWagon(game)
  if (wagon && wagon === plannedWagon(game)) {
    game.convoyTaken = wagon.id
    gainGold(game,wagon.gold)
    const pos = wagonPosition(wagon,game.waveTime)
    effect(game,'burst',pos.x,pos.y,'截获 +' + wagon.gold,'#ffd785')
    log(game,'依战前牌分截下' + wagon.name + ' · +' + wagon.gold + ' 金币','good')
  }
  const caster = game.bellReady && nextChime(game)
  if (caster && caster.bellTimer <= 2) {
    game.bellReady = false
    caster.bellTimer = BELL_INTERVAL
    game.tacticsReport.interrupts++
    log(game,'战前列令生效 · 首次鸣钟被打断','good')
  }
}

export function settleFeint(game, orderTarget) {
  const plan = game.feint
  if (plan?.result !== 'active') return
  const onTime = game.waveTime >= FEINT.opens && game.waveTime < FEINT.closes
  if (!onTime || !orderTarget || orderTarget === plan.target) {
    plan.result = 'missed'
    log(game, '诈阵落空 · 损失诱饵金 ' + FEINT.stake, 'danger')
    return
  }
  plan.result = 'fooled'
  gainGold(game, FEINT.payout)
  for (const enemy of game.enemies) if (enemy.hp > 0 && !isBoss(enemy.type)) enemy.cooldown += FEINT.delay
  effect(game, 'burst', 500, 215, '敌军中计', '#ffd78e')
  log(game, `敌将误判 · 收回 ${FEINT.payout} 金币，在场普通敌军下次普攻推迟 ${FEINT.delay} 秒`, 'epic')
}
