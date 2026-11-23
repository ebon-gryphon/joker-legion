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
import { recordOrder, recruitmentOutcome } from './combatStats.js'
import { resolveScoreTrace } from './scoreBreakdown.js'
import { displayName } from './soldierIdentity.js'

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
  const actualItems=new Map((preview.scoreTrace?.items || []).map(item=>[item.id,{id:item.id,triggered:false,effective:false,reason:item.reason,effects:{}}]))
  const itemCursor=game.combatLedger?.itemEvents?.length || 0
  const baseStar=Math.max(1,preview.returning?game.champion?.level || 1:1,preview.royalOrder?3:1)
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
  let reserveUnit = null
  if (preview.waiting) {
    const recruit = preview.reserve[0]
    reserveUnit = addUnit(game,recruit.type,'ally',recruit.level,{identity:recruit,reserve:true})
  }
  const trainer = game.allies.find(u => u.id === preview.trainerId) || joined[preview.trainerRecruit]
  const trainingBefore = trainer?.trainingXp || 0
  if (preview.trainingXp && trainer) {
    grantExperience(game,trainer,preview.trainingXp)
    const gained=trainer.trainingXp-trainingBefore
    effect(game,'burst',trainer.x,trainer.y, gained?'+'+gained+'经验':'经验已满','#efce81')
  }
  if (preview.march) applyRoyalMarch(game, preview.marchSuit)
  const echo = secondary && echoOrderBonus(preview.bonus)
  applyRegimentOrder(game, preview, joined, secondary, echo)
  applyRecruitRelics(game, preview, cards, joined[0] || trainer,actualItems)
  applyRecruitItems(game,joined[0] || (preview.waiting ? game.reserves.at(-1) : trainer))
  const ids = new Set(game.selected)
  if (ids.has(game.palmedCard?.id)) game.palmedCard = null
  game.hand = game.hand.filter(card => !ids.has(card.id))
  game.selected = []
  replenish(game)
  arrangeCamp(game)
  for (const unit of joined) effect(game, 'summon', unit.x, unit.y, unit.level > 1 ? '★' + unit.level : '', unit.color)
  let squad = REGIMENTS[preview.target].name + ' ×' + preview.targetCount + ' · ' + preview.description
  if (preview.trainingXp) squad += ' · ' + preview.trainerName + ' 实得 ' + ((trainer?.trainingXp || 0)-trainingBefore) + '经验'
  if (secondary) squad += ' / ' + REGIMENTS[secondary].name + '复令 · ' + describeBonus(echo)
  game.lastDeploy = { variantName:preview.look.name, variantRank:preview.variantRank, statBonus:preview.statBonus, grade:preview.grade, captainGrade:preview.captainGrade, profession:preview.profession, trainingXp:preview.trainingXp, trainerName:preview.trainerName,
    waiting:preview.waiting, contracted:preview.count, squad, target: preview.target, id: uid(game, 'deploy'), name: preview.name, key: preview.key, count: joined.length,
    leadFace: (preview.recruits[0] || preview.reserve[0])?.appearanceId ?? null,
    score: preview.score.total, power: preview.power, chain: game.chain, time: game.time }
  const recruitResult=recruitmentOutcome(preview,{joined,reserve:reserveUnit,trainer,xpGain:(trainer?.trainingXp || 0)-trainingBefore})
  const source=preview.recruits[0] || preview.reserve[0]
  const third=actualItems.get('third-act')
  if(third?.triggered) {
    const extraStar=Math.max(0,(source?.level || 1)-baseStar)
    const potentialXp=extraStar>0?2**source.level-2**baseStar:0
    const xpWithout=Math.max(0,preview.trainingXp-potentialXp)
    const actualXp=trainer?Math.max(0,recruitResult.xpGain-Math.min(999-trainingBefore,xpWithout)):0
    const starGain=joined.length || reserveUnit?extraStar:0
    Object.assign(third,{effective:starGain>0 || actualXp>0,effects:{starGain,xpGain:actualXp},
      reason:starGain>0?'第三手生效，领队实际提高 '+starGain+' 星。':actualXp>0?'第三手升星转为满编集训，本次额外获得 '+actualXp+' 经验。':extraStar>0?'已满编且接收者经验达到上限，本次没有新增培养收益。':'已有返场星级或皇家密令，未额外提高星级。'})
  }
  for(const item of preview.scoreTrace?.items || []) if(item.phase==='chips') actualItems.set(item.id,{id:item.id,
    triggered:item.quantity>0 && item.applied,effective:item.quantity>0 && item.potential.chips>0,
    reason:item.reason,effects:{chips:item.potential.chips || 0}})
  const heart=actualItems.get('heart-engine')
  if(heart && (preview.scoreTrace.items.find(item=>item.id==='heart-engine')?.quantity || 0)>0) {
    const events=(game.combatLedger?.itemEvents || []).slice(itemCursor).filter(event=>event.id==='heart-engine')
    const damage=events.reduce((sum,event)=>sum+(event.effects.damage || 0),0)
    const shieldDamage=events.reduce((sum,event)=>sum+(event.effects.shieldDamage || 0),0)
    Object.assign(heart,{triggered:events.length>0,effective:damage>0 || shieldDamage>0,
      reason:events.length?damage>0?'本手治疗触发 '+events.length+' 次圣杯，伤害按实际生命损失记录。':events[0].reason:'本手未累计满70有效治疗，当前蓄能 '+Number(game.healedCharge.toFixed(1))+'/70。',
      effects:{damage,shieldDamage,targets:new Set(events.flatMap(event=>event.targetIds)).size}})
  }
  game.lastDeploy.scoreTrace=resolveScoreTrace(preview.scoreTrace,{recruit:{actualCount:joined.length,reserve:!!reserveUnit,overflow:joined.length===0,
    xp:recruitResult.xpGain,plannedXp:preview.trainingXp,receiver:trainer?{id:trainer.id,name:displayName(trainer)}:null,
    summary:joined.length?preview.profession+' ×'+joined.length+' 实际入阵，征召属性 +'+preview.statBonus+'%。':reserveUnit?'上阵已满，传说领队已进入候补，保留身份、品质与星级。':'上阵已满，本手实际提供 '+recruitResult.xpGain+' 经验给'+(trainer?displayName(trainer):'接收者')+'。'},items:[...actualItems.values()]})
  recordOrder(game,preview,secondary,{recruit:recruitResult,scoreTrace:game.lastDeploy.scoreTrace,items:[...actualItems.values()]})
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

function applyRecruitRelics(game, preview, cards, leader,actualItems) {
  const scoring = cards.filter(c => preview.scoringIds.includes(c.id))
  if (owns(game, 'iron-banner') && preview.containsPair) {
    trigger(game, 'iron-banner', '领队护盾 · 前排恢复')
    let shield=0,healed=0;const targets=new Set()
    if (leader) {leader.shield += 24;shield=24;targets.add(leader.id)}
    for (const unit of game.allies.filter(unit => unit.type === 'knight')) {
      const gain=healUnit(game, unit, 18, 0, {system:'iron-banner',label:'铁壁旗手'})
      healed+=gain;if(gain>0) targets.add(unit.id)
    }
    actualItems.set('iron-banner',{id:'iron-banner',triggered:true,effective:shield>0 || healed>0,
      reason:shield>0 || healed>0?'对子条件生效，记录实际赋盾与有效治疗。':'对子条件生效，但无在阵领队或集训接收者且前排无需治疗。',effects:{shield,healed,targets:targets.size}})
  }
  if (owns(game, 'third-act') && game.stats.deploys % 3 === 0) {
    trigger(game,'third-act','本手领队升星')
    actualItems.set('third-act',{id:'third-act',triggered:true,effective:false,reason:'第三手星级结算待记录。',effects:{}})
  }
  if (owns(game, 'red-echo')) {
    const hearts = scoring.filter(card => card.suit === '♥').length
    if (hearts) {
      let healed=0;const targets=new Set(),beforeGate=game.baseHp
      trigger(game, 'red-echo', `${hearts} 次即时治疗`)
      for (let i = 0; i < hearts; i++) {
        const weakest = game.allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
        if (weakest) {
          const gain=healUnit(game, weakest, 16, 0, {system:'red-echo',label:'红心回响'})
          healed+=gain;if(gain>0) targets.add(weakest.id)
        }
      }
      if (hearts >= 2) restoreBase(game, 3)
      const gateRepaired=game.baseHp-beforeGate
      actualItems.set('red-echo',{id:'red-echo',triggered:true,effective:healed>0 || gateRepaired>0,
        reason:healed>0 || gateRepaired>0?'计分红心生效，按友军实际缺血和城门缺损结算。':hearts>=2?'计分红心满足条件，但友军与城门均已满。':'计分红心满足治疗条件，但友军满血；不足两张红心，不修复城门。',
        effects:{healed,gateRepaired,targets:targets.size}})
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
