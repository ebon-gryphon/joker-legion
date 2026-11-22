// A playing hand delivers an order to the chosen regiment. The scoring cards also supply its recruits.
export const REGIMENTS = {
  knight: { suit: '♠', name: '铁卫', role: '近战前排' },
  healer: { suit: '♥', name: '牧师', role: '持续治疗' },
  ranger: { suit: '♣', name: '游侠', role: '远程射击' },
  mage: { suit: '♦', name: '术士', role: '范围伤害' },
}
export const ORDER_BOOK = {
  high: { name: '高牌', pattern: '点数最高的一张', example: '♠A', chips: 5, mult: 1, chipGain: 10, multGain: 1, order: '整备', cost: 2, force: 3 },
  pair: { name: '对子', pattern: '两张同点数', example: '♥8 ♣8', chips: 10, mult: 2, chipGain: 15, multGain: 1, order: '列盾', cost: 3, shield: 24 },
  twoPair: { name: '两对', pattern: '两组不同点数的对子', example: '♠J ♦J ♥4 ♣4', chips: 20, mult: 2, chipGain: 20, multGain: 1, order: '攻守协同', cost: 4, shield: 20, force: 6 },
  three: { name: '三条', pattern: '三张同点数', example: '♠9 ♥9 ♦9', chips: 30, mult: 3, chipGain: 20, multGain: 2, order: '集火', cost: 4, force: 14 },
  straight: { name: '顺子', pattern: '五个连续点数', example: '♣A ♥2 ♠3 ♦4 ♣5', chips: 30, mult: 4, chipGain: 30, multGain: 3, order: '疾行', cost: 5, haste: 24 },
  flush: { name: '同花', pattern: '五张同花色', example: '♦2 ♦4 ♦7 ♦J ♦A', chips: 35, mult: 4, chipGain: 15, multGain: 2, order: '回春', cost: 5, vitality: 20, shield: 25 },
  fullHouse: { name: '葫芦', pattern: '一组三条加另一组对子', example: '♠7 ♥7 ♦7 ♣K ♥K', chips: 40, mult: 4, chipGain: 25, multGain: 2, order: '固阵', cost: 6, vitality: 46, force: 12 },
  four: { name: '四条', pattern: '四张同点数', example: '♠Q ♥Q ♣Q ♦Q', chips: 60, mult: 7, chipGain: 30, multGain: 3, order: '破阵', cost: 6, force: 23, shield: 28 },
  straightFlush: { name: '同花顺', pattern: '同花色且五个点数连续', example: '♥5 ♥6 ♥7 ♥8 ♥9', chips: 100, mult: 8, chipGain: 40, multGain: 4, order: '总攻', cost: 7, vitality: 45, force: 18, haste: 24 },
  five: { name: '五条', secret: true, pattern: '五张同点数', example: '♠Q ♥Q ♣Q ♦Q ♠Q', chips: 120, mult: 12, chipGain: 35, multGain: 3, order: '齐射', cost: 8, force: 35, haste: 18 },
  flushHouse: { name: '同花葫芦', secret: true, pattern: '同花色的三条加另一组对子', example: '♣7 ♣7 ♣7 ♣K ♣K', chips: 140, mult: 14, chipGain: 40, multGain: 4, order: '筑城', cost: 8, vitality: 58, shield: 48 },
  flushFive: { name: '同花五条', secret: true, pattern: '五张花色与点数完全相同', example: '♦A ♦A ♦A ♦A ♦A', chips: 160, mult: 16, chipGain: 50, multGain: 3, order: '王师进军', cost: 9, force: 26, shield: 38, haste: 20 },
}
export const TRAINING_COST = 5
export const MAX_ORDER_LEVEL = 3
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
export function rankOf(card) { return ranks.indexOf(card.rank) + 2 }

export function scoringHand(cards) {
  const counts = new Map()
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) || 0) + 1)
  const groups = [...counts.values()].sort((a, b) => b - a)
  const sorted = [...cards].sort((a, b) => rankOf(b) - rankOf(a))
  const straight = cards.length === 5 && counts.size === 5 &&
    (rankOf(sorted[0]) - rankOf(sorted[4]) === 4 || sorted.map(c => c.rank).join('') === 'A5432')
  const flush = cards.length === 5 && cards.every(c => c.suit === cards[0].suit)
  let key
  const fullHouse = groups[0] === 3 && groups[1] === 2
  if (groups[0] === 5) key = flush ? 'flushFive' : 'five'
  else if (flush && fullHouse) key = 'flushHouse'
  else if (straight && flush) key = 'straightFlush'
  else if (groups[0] === 4) key = 'four'
  else if (fullHouse) key = 'fullHouse'
  else if (flush) key = 'flush'
  else if (straight) key = 'straight'
  else if (groups[0] === 3) key = 'three'
  else if (groups[0] === 2 && groups[1] === 2) key = 'twoPair'
  else key = groups[0] === 2 ? 'pair' : 'high'
  const scoring = key === 'high' ? [sorted[0]] :
    ['pair','twoPair','three','four'].includes(key) ? cards.filter(card => counts.get(card.rank) > 1) : cards
  const points = scoring.reduce((total, card) => total + (card.rank === 'A' ? 11 : Math.min(10, rankOf(card))), 0)
  return { key, scoring, points, containsPair: groups[0] >= 2, containsFlush: flush, royal: key === 'straightFlush' && sorted[4].rank === '10' }
}
export function handScore(key, level, points = 0) {
  const rule = ORDER_BOOK[key]
  const chips = rule.chips + (level - 1) * rule.chipGain + points
  const mult = rule.mult + (level - 1) * rule.multGain
  return { chips, mult, total: chips * mult }
}

export function orderBonus(key, level, points, crown = false) {
  const rule = ORDER_BOOK[key]
  const magnitude = (1 + Math.sqrt(handScore(key, level, points).total) / 48) * (crown ? 1.25 : 1)
  const result = {}
  for (const stat of ['force', 'shield', 'vitality', 'haste']) {
    if (rule[stat]) result[stat] = Math.round(rule[stat] * magnitude)
  }
  return result
}
export function describeBonus(bonus) {
  return [bonus.force && ('攻疗 +' + bonus.force), bonus.shield && ('护盾 +' + bonus.shield),
    bonus.vitality && ('生命及上限 +' + bonus.vitality), bonus.haste && ('行动间隔 −' + bonus.haste + '%')].filter(Boolean).join(' · ')
}
