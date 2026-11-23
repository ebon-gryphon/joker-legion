import { canSelectHand, slotOf, seedNumber, owns, inCamp } from './gameState.js'
import { REGIMENTS, scoringHand, ORDER_BOOK, handScore, rankOf, orderBonusFromScore, describeBonus } from './orders.js'
import { selectedCards, playedFace } from './deck.js'
import { FIELD_LIMIT } from './campaignRules.js'
import { recalls, recruitIdentity, muster } from './campArmy.js'
import { gradeForScore, GRADES } from './quality.js'
import { DETACHMENTS, repeatedRank, recruitLook, recruitName, musterBonus, revealGrade } from './recruitment.js'
import { championProgress, veteranLevel } from './training.js'
import { ROYAL_MARCHES } from './jobs.js'
import { scoreItemChips } from './itemEffects.js'
import { buildScoreTrace } from './scoreBreakdown.js'

export function setOrderTarget(game, type) {
  if (!canSelectHand(game) || !Object.hasOwn(REGIMENTS, type)) return false
  if (!game.allies.some(u => u.type === type && u.hp > 0) && !previewHand(game).recruits.some(u => u.type === type)) return false
  game.orderTarget = type
  return true
}

export function previewHand(game, cardIds = game.selected, options) {
  return planHand(game,cardIds,false,options)
}

export function planHand(game, cardIds, reveal, {trace=true}={}) {
  const cards = selectedCards(game, cardIds)?.map(card => playedFace(game, card))
  if (!cards) return { name: '选择你的手牌', key: null, cost: 0, power: 0, recruits: [], scoringIds: [], combo: [], canDeploy: false, reason: '请选择 1–5 张手牌' }
  const { key, scoring, points, royal, containsPair, containsFlush } = scoringHand(cards)
  const hand = ORDER_BOOK[key], level = game.handLevels[key]
  const extraChips = scoreItemChips(game,scoring,key,containsPair)
  const score = handScore(key, level, points + extraChips)
  const lead = scoring.reduce((best,card)=>rankOf(card)>rankOf(best)?card:best)
  const sourceSlot = card => slotOf(game.hand.find(c => c.id === card.id))
  const legacyCard = game.champion && !game.champion.pattern && scoring.find(c=>sourceSlot(c)===game.champion.slot)
  const signature = sourceSlot(legacyCard || lead)
  const returning = game.allies.length < FIELD_LIMIT && recalls(game.champion, { source:'card', pattern:key, cardSlot:signature })
  const grade = Math.max(gradeForScore(score.total),returning ? game.champion.grade : 0)
  const squad = DETACHMENTS[key]
  const variantRank = repeatedRank(key,scoring)
  const look = recruitLook(key,variantRank,grade)
  const statBonus = musterBonus(scoring)
  const house = key === 'fullHouse' || key === 'flushHouse'
  const supportingPair = house ? scoring.find(card => card.rank !== variantRank) : null
  const strengthDetail = supportingPair ? '三张 ' + variantRank + ' 贡献 ' + (3 * rankOf({rank:variantRank})) + '%，一对 ' + supportingPair.rank + ' 贡献 ' + (2 * rankOf(supportingPair)) + '%' : ''
  // The draw belongs to the accepted order's ordinal. Inspecting, reselecting, or reloading never rerolls it.
  let captainGrade = grade
  if (reveal) {
    let hash = seedNumber(game.seed + '/muster/' + game.stats.deploys)
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    captainGrade = revealGrade(grade,((hash ^ (hash >>> 16)) >>> 0) / 4294967296 * 100)
  }
  look.name = recruitName(key,captainGrade)
  const echo = owns(game,'third-act') && (game.stats.deploys+1)%3 === 0
  const royalOrder = owns(game,'royal-command') && cards.filter(c=>['J','Q','K'].includes(c.rank)).length>=3
  const firstStar = Math.max(returning ? game.champion.level : 1, royalOrder ? 3 : 1 + Number(echo))
  const recruit = {...recruitIdentity(look.design,firstStar), name:look.name, variantRank, statBonus,
    cardId:lead.id, cardSlot:signature, pattern:key, grade:captainGrade}
  const present = game.allies.filter(u=>u.hp>0)
  const combo = []
  if (hand.secret && !game.discoveredHands.includes(key)) combo.push('首次打出将解锁' + hand.name + '研习')
  if (owns(game,'iron-banner') && containsPair) combo.push('铁壁旗手 · 领队得盾，铁卫恢复')
  if (echo) combo.push('第三幕 · 领队升星')
  if (royalOrder) combo.push('皇家密令 · 三星领队')
  const {recruits,reserve,trainer,xp,waiting} = muster(game,recruit)
  const projected = [...present,...recruits]
  const type = projected.some(u=>u.type===game.orderTarget) ? game.orderTarget :
    projected.find(u=>u.type===recruit.type)?.type || projected[0]?.type || recruit.type
  const boosted = owns(game, 'flush-crown') && containsFlush
  const bonus = orderBonusFromScore(key,score.total,boosted)
  const overflow = reserve.length
  const recipients = [...present, ...recruits].filter(u => u.type === type)
  const crown = royal ? recipients.filter(u => !u.crowned).sort((a,b) => rankOf(b) - rankOf(a))[0] : null
  if (boosted) combo.push('同花王冠 · 战令效果 +25%，城门恢复 8')
  if (crown) combo.push('皇家加冕 · ' + crown.name + ' 生命、攻击与治疗 +50%')
  if (owns(game, 'red-echo') && scoring.some(card => card.suit === '♥')) combo.push('红心回响 · 即时治疗')
  if (returning) combo.push('主将归队 · ' + championProgress(game.champion))
  const prepaid = game.paidHandsLeft > 0
  const cost = prepaid ? 0 : hand.cost
  let reason = ''
  if (!inCamp(game)) reason = '当前不能出牌'
  else if (game.handsLeft <= 0) reason = '本波出牌次数已用完'
  else if (game.energy < cost) reason = '军令不足'

  const championPresent = present.some(u => u.id === game.champion?.unitId) || (!game.champion?.unitId && recruits.some(u=>recalls(game.champion,u)))
  const king = scoring.find(c => c.rank === 'K')
  const march = !!king && !game.royalMarch && championPresent &&
    veteranLevel((game.champion?.xp || 0) + (trainer?.id === game.champion?.unitId || (trainer && recalls(game.champion,trainer)) ? xp : 0)) >= 3
  const marchSuit = march ? king.suit : null
  if (march) combo.push(king.suit + 'K 御驾亲征 · ' + ROYAL_MARCHES[king.suit].name + ' · ' + ROYAL_MARCHES[king.suit].text)
  const power = Object.values(bonus).reduce((total, v) => total + v, 0)
  const plan = { key, name: royal ? '皇家同花顺' : hand.name, level, order: hand.order, points, score, extraChips, waiting:!!waiting, returning, royalOrder, bonus, containsPair, containsFlush,
    scoringIds: scoring.map(card => card.id), target: type, targetCount: recipients.length, crownId: crown?.id, crownRecruit: recruits.indexOf(crown),
    cost, prepaid, power, grade, captainGrade, variantRank, look, statBonus, strengthDetail, profession:squad.name, count:squad.count, recruits, reserve, trainingXp:xp, trainerName:trainer?.name, trainerId:trainer?.id, trainerRecruit:recruits.indexOf(trainer), march, marchSuit, actualUnits: recruits.length, overflow,
    description: describeBonus(bonus), combo, canDeploy: !reason, reason }
  if(trace) plan.scoreTrace=buildScoreTrace(game,plan,{cards,scoring,mode:reveal?'resolved':'preview'})
  return plan
}

export function recommendHand(game) {
  if (!canSelectHand(game) || (!game.paidHandsLeft && game.energy < 2)) return null
  let best = null, bestScore = -Infinity
  const targets = game.allies.filter(u => u.type === game.orderTarget && u.hp > 0)
  const numbers = Object.fromEntries(Object.keys(REGIMENTS).map(type => [type, game.allies.filter(u => u.type === type).length]))
  const first = targets[0], underFire = targets.some(u => u.hp < u.maxHp)
  const consider = (index, ids) => {
    if (ids.length) {
      const hand = planHand(game,ids,false,{trace:false})
      if (hand.canDeploy) {
        const b = hand.bonus
        const strength = (b.force || 0) * (hand.target === 'healer' ? 2 : 1.6) +
          (b.shield || 0) * (hand.target === 'knight' || underFire ? .8 : .34) +
          (b.vitality || 0) * .72 + (b.haste || 0) * ((first?.atk || 20) + (first?.heal || 0)) / 22
        const stars = hand.recruits.reduce((sum, unit) => sum + unit.level, 0)
        const counts = { ...numbers }
        let balance = 0
        for (const member of hand.recruits) {
          const n = counts[member.type]++
          const needed = member.type === 'healer' ? 2 : member.type === 'knight' ? 3 : 4
          balance += n < needed ? 16 : -8
        }
        const score = (strength * (1 + Math.min(5, hand.targetCount) * .12) + stars * 16 * (1 + GRADES[Math.min(hand.grade,4)].boost / 100) * (1 + hand.statBonus / 100) + balance + hand.trainingXp * 8 + (hand.march ? 70 : 0) + (game.champion && !game.champion.unitId && hand.recruits.some(u=>recalls(game.champion,u)) ? 500 : 0) +
          (hand.crownId || hand.crownRecruit >= 0 ? 35 : 0)) / (1 + hand.cost * .13)
        if (score > bestScore || (score === bestScore && ids.length < best.length)) { bestScore = score; best = ids.slice() }
      }
    }
    if (ids.length < 5) for (let i = index; i < game.hand.length; i++) consider(i + 1, [...ids, game.hand[i].id])
  }
  consider(0, [])
  return best
}
