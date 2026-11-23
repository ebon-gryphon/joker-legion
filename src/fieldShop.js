import { TRAINING_COST, ORDER_BOOK, MAX_ORDER_LEVEL } from './orders.js'
import { log, owns, shuffle, gainGold, restoreBase } from './gameState.js'
import { JOKERS, JOKER_BY_ID } from './campaignRules.js'

export function trainOrder(game, key) {
  if (game.phase !== 'shop' || !game.rewardChosen || game.trainedHere || game.gold < TRAINING_COST ||
      !Object.hasOwn(ORDER_BOOK, key) || (ORDER_BOOK[key].secret && !game.discoveredHands.includes(key)) || game.handLevels[key] >= MAX_ORDER_LEVEL) return false
  game.gold -= TRAINING_COST
  game.handLevels[key]++
  game.trainedHere = true
  log(game, ORDER_BOOK[key].name + '牌谱升至 Lv.' + game.handLevels[key], 'good')
  return true
}

export function refreshShop(game) {
  const pool = JOKERS.filter(joker => joker.stackable || !owns(game, joker.id))
  game.soldShop = []
  game.shop = shuffle(game, pool.slice()).slice(0, 3).map(joker => joker.id)
}

export function buyJoker(game, id) {
  if (game.phase !== 'shop' || !game.rewardChosen || !game.shop.includes(id) || game.soldShop.includes(id)) return false
  const joker = JOKER_BY_ID[id]
  const owned = game.jokers.find(item => item.id === id)
  if (!joker || (owned && !joker.stackable) || game.gold < joker.price) return false
  game.gold -= joker.price
  if (owned) owned.quantity = (owned.quantity ?? 1) + 1
  else game.jokers.push({ ...joker, quantity:1, triggers:0, flash:0 })
  game.soldShop.push(id)
  log(game, `购入${joker.name} · ${joker.description}`, 'joker')
  return true
}

export function sellJoker(game, id) {
  if (game.phase !== 'shop' || !game.rewardChosen) return false
  const index = game.jokers.findIndex(joker => joker.id === id)
  if (index < 0) return false
  const joker = game.jokers[index]
  if (joker.quantity > 1) joker.quantity--
  else game.jokers.splice(index,1)
  const value = Math.max(1, Math.floor(joker.price / 2))
  gainGold(game, value)
  log(game, `出售${joker.name} · 金币 +${value}`, 'normal')
  return true
}

export function rerollShop(game) {
  if (game.phase !== 'shop' || !game.rewardChosen || game.gold < 2) return false
  game.gold -= 2
  refreshShop(game)
  return true
}

export function rewardAvailability(game, id) {
  if (game.phase !== 'shop' || game.rewardChosen || !game.rewards.some(reward => reward.id === id)) return {available:false,reason:'本波补给已领取或尚未开放。'}
  if (id === 'repair' && game.baseHp >= game.maxBaseHp) return {available:false,reason:'城门耐久已满，无需修复。请选择其他补给。'}
  return {available:true,reason:''}
}

export function chooseReward(game, id) {
  if (!rewardAvailability(game,id).available) return false
  if (id === 'repair') restoreBase(game, 20)
  else if (id === 'power') game.upgrades.power = Math.min(1, game.upgrades.power + 0.08)
  else if (id === 'supply') { gainGold(game, 6); game.bonusDiscard = 1 }
  else if (id !== 'enlist' || ![2,4].includes(game.wave)) return false
  game.rewardChosen = id
  log(game, `战利品 · ${game.rewards.find(reward => reward.id === id).name}`, 'good')
  return true
}
