import { waveChange } from './standingArmy.js'
import { planHand } from './handPlan.js'
import { selectedCards, playedFace, replenish } from './deck.js'
import { ORDER_BOOK, REGIMENTS, describeBonus } from './orders.js'
import { log, effect, uid, owns, spendCharge, trigger, restoreBase, gainGold } from './gameState.js'
import { addUnit, arrangeCamp } from './campArmy.js'
import { grantExperience } from './training.js'
import { QUALITIES } from './quality.js'
import { settleDeaths, healUnit } from './combatHealth.js'
import { ROYAL_MARCHES } from './jobs.js'
import { applyRecruitItems } from './itemEffects.js'
import { recordOrder } from './combatStats.js'

export function deploy(game) {
  return issueOrder(game, null)
}

export function echoOrderBonus(bonus) {
  return Object.fromEntries(Object.entries(bonus).map(([key,value]) => [key,Math.floor(value / 2)]))
}

export function issueOrder(game, secondary) {
  const preview = planHand(game,game.selected,true)
  if (!preview.canDeploy) return false
  const cards = selectedCards(game, game.selected).map(card => playedFace(game, card))
  spendCharge(game,'score-ticket')
  game.handsLeft--
  if (preview.prepaid) game.paidHandsLeft--
  game.energy = Math.max(0, game.energy - preview.cost)
  game.preparedScore = Math.max(game.preparedScore,preview.score.total)
  if (preview.key !== 'high') game.bellReady = true
  game.deployCooldown = 0
  game.chain = 1
  game.chainTimer = 3
  game.stats.deploys++
  if (ORDER_BOOK[preview.key].secret && !game.discoveredHands.includes(preview.key)) {
    game.discoveredHands.push(preview.key)
    log(game, '发现' + preview.name + ' · 已解锁手册研习', 'epic')
  }
  const shapes = Object.values(ORDER_BOOK).flatMap(hand => hand === ORDER_BOOK.straightFlush ? [hand.name, '皇家同花顺'] : [hand.name])
  const order = shapes.indexOf(preview.name), best = shapes.indexOf(game.stats.bestHand)
  if (order > best || (order === best && preview.power > game.stats.bestPower)) {
    game.stats.bestPower = preview.power
    game.stats.bestHand = preview.name
  }
  const joined = preview.recruits.map(recruit => addUnit(game, recruit.type, 'ally', recruit.level, { identity: recruit }))
  if (preview.waiting) {
    const recruit = preview.reserve[0]
    addUnit(game,recruit.type,'ally',recruit.level,{identity:recruit,reserve:true})
  }
  const trainer = game.allies.find(u => u.id === preview.trainerId) || joined[preview.trainerRecruit]
  if (preview.trainingXp && trainer) {
    grantExperience(game,trainer,preview.trainingXp)
    effect(game,'burst',trainer.x,trainer.y, '+' + preview.trainingXp + '经验','#efce81')
  }
  if (preview.march) applyRoyalMarch(game, preview.marchSuit)
  const echo = secondary && echoOrderBonus(preview.bonus)
  applyRegimentOrder(game, preview, joined, secondary, echo)
  applyRecruitRelics(game, preview, cards, joined[0] || trainer)
  applyRecruitItems(game,joined[0] || (preview.waiting ? game.reserves.at(-1) : trainer))
  const ids = new Set(game.selected)
  if (ids.has(game.palmedCard?.id)) game.palmedCard = null
  game.hand = game.hand.filter(card => !ids.has(card.id))
  game.selected = []
  replenish(game)
  arrangeCamp(game)
  for (const unit of joined) effect(game, 'summon', unit.x, unit.y, unit.level > 1 ? '★' + unit.level : '', unit.color)
  let squad = REGIMENTS[preview.target].name + ' ×' + preview.targetCount + ' · ' + preview.description
  if (preview.trainingXp) squad += ' · ' + preview.trainerName + ' +' + preview.trainingXp + '经验'
  if (secondary) squad += ' / ' + REGIMENTS[secondary].name + '复令 · ' + describeBonus(echo)
  game.lastDeploy = { variantName:preview.look.name, variantRank:preview.variantRank, statBonus:preview.statBonus, grade:preview.grade, captainGrade:preview.captainGrade, profession:preview.profession, trainingXp:preview.trainingXp, trainerName:preview.trainerName,
    waiting:preview.waiting, contracted:preview.count, squad, target: preview.target, id: uid(game, 'deploy'), name: preview.name, key: preview.key, count: joined.length,
    leadFace: (preview.recruits[0] || preview.reserve[0])?.appearanceId ?? null,
    score: preview.score.total, power: preview.power, chain: game.chain, time: game.time }
  recordOrder(game,preview,secondary)
  game.stats.maxChain = Math.max(game.stats.maxChain, game.chain)
  if (preview.captainGrade>preview.grade || preview.captainGrade===4) {
    const stars = QUALITIES[preview.captainGrade].name + preview.profession
    log(game,stars+'应召'+(joined.length ? '' : (preview.waiting ? ' · 已在候补席等候上阵或融合' : ' · 化为集训经验')),'epic')
    const bearer = joined[0] || trainer
    if (bearer) effect(game,'burst',bearer.x,bearer.y-20,stars,QUALITIES[preview.captainGrade].color)
  }
  log(game, preview.name + ' · 征兵 ' + joined.length + ' 名 · ' + preview.order + ' → ' + squad, 'good')
  effect(game, 'burst', 220, 180, preview.order, '#e5c995')
  settleDeaths(game)
  return true
}

function applyRoyalMarch(game, suit) {
  const captain = game.allies.find(u => u.id === game.champion.unitId)
  if (captain) {
    game.royalMarch = true
    captain.marching = true
    waveChange(captain, () => {
      captain.atk += Math.ceil(captain.atk * .5)
      captain.heal += Math.ceil(captain.heal * .5)
    })
    for (const ally of game.allies) {
      ally.shield += Math.ceil(captain.maxHp * (suit === '♠' ? .36 : .18))
      if (suit === '♥') ally.royalWard = true
      if (suit === '♣') {
        waveChange(ally, () => {
          const previous = ally.period
          ally.period = Math.max(.35,previous*.8)
          ally.cooldown *= ally.period/previous
        })
      }
    }
    if (suit === '♦') captain.royalStars = 3
    effect(game,'burst',captain.x,captain.y-32,'御驾亲征','#ffe18e')
    log(game,captain.name + '御驾亲征 · ' + ROYAL_MARCHES[suit].name,'epic')
  }
}

function applyRegimentOrder(game, preview, joined, secondary, echo) {
  const crownId = preview.crownId || joined[preview.crownRecruit]?.id
  game.orderTarget = preview.target
  for (const unit of game.allies) {
    const bonus = unit.type === preview.target ? preview.bonus : unit.type === secondary && echo
    if (!bonus || unit.hp <= 0) continue
    waveChange(unit, () => {
      unit.shield = (unit.shield || 0) + (bonus.shield || 0)
      unit.atk += bonus.force || 0
      if (unit.type === 'healer') unit.heal += bonus.force || 0
      unit.maxHp += bonus.vitality || 0
      unit.hp += bonus.vitality || 0
      if (bonus.haste) {
        const previous = unit.period
        unit.period = Math.max(.35, unit.period * (1 - bonus.haste / 100))
        unit.cooldown *= unit.period / previous
      }
      if (unit.id === crownId) {
        unit.crowned = true
        const extra = Math.round(unit.maxHp * .5)
        unit.maxHp += extra; unit.hp += extra
        unit.atk = Math.round(unit.atk * 1.5); unit.heal = Math.round(unit.heal * 1.5)
        log(game, unit.name + '加冕为王牌统帅', 'epic')
      }
    })
  }
}

function applyRecruitRelics(game, preview, cards, leader) {
  const scoring = cards.filter(c => preview.scoringIds.includes(c.id))
  if (owns(game, 'iron-banner') && preview.containsPair) {
    trigger(game, 'iron-banner', '领队护盾 · 前排恢复')
    if (leader) leader.shield += 24
    for (const unit of game.allies.filter(unit => unit.type === 'knight')) healUnit(game, unit, 18, 0, {system:'iron-banner',label:'铁壁旗手'})
  }
  if (owns(game, 'third-act') && game.stats.deploys % 3 === 0) {
    trigger(game,'third-act','本手领队升星')
  }
  if (owns(game, 'red-echo')) {
    const hearts = scoring.filter(card => card.suit === '♥').length
    if (hearts) {
      trigger(game, 'red-echo', `${hearts} 次即时治疗`)
      for (let i = 0; i < hearts; i++) {
        const weakest = game.allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
        if (weakest) healUnit(game, weakest, 16, 0, {system:'red-echo',label:'红心回响'})
      }
      if (hearts >= 2) restoreBase(game, 3)
    }
  }
  if (owns(game, 'diamond-bank')) {
    const diamonds = Math.min(3, scoring.filter(card => card.suit === '♦').length)
    if (diamonds) { trigger(game, 'diamond-bank', `金币 +${diamonds}`); gainGold(game, diamonds) }
  }
  if (owns(game, 'royal-command') && cards.filter(card => ['J', 'Q', 'K'].includes(card.rank)).length >= 3) {
    trigger(game,'royal-command','三星领队应召')
  }
  if (owns(game, 'flush-crown') && preview.containsFlush) {
    trigger(game, 'flush-crown', '战令强化 · 城堡恢复')
    restoreBase(game, 8)
  }
}
