import { TRAINING_COST, ORDER_BOOK, MAX_ORDER_LEVEL } from './orders.js'
import { log, owns, shuffle } from './gameState.js'
import { JOKERS, JOKER_BY_ID } from './campaignRules.js'
import { ECONOMY_CONFIG, gainCrystals } from './economy.js'

export {chooseReward,rewardAvailability} from './waveRewards.js'
export const rerollCost=ECONOMY_CONFIG.shopReroll
export const priceOf=itemOrId=>JOKER_BY_ID[typeof itemOrId==='string'?itemOrId:itemOrId?.id]?.price ?? null
export function sellValue(itemOrId) {
  const price=priceOf(itemOrId)
  return price===null?null:Math.max(1,Math.floor(price/2))
}

export function shopActionAvailability(game,action,id) {
  const price=action==='reroll'?(game.inheritance?.levels.contract && !game.inheritance.refreshUsed?0:rerollCost):action==='sell'?sellValue(id):priceOf(id)
  const result=(available,reason='')=>({available,reason,price,currency:'crystals'})
  if(game.phase!=='shop')return result(false,'商店仅在战后开放。')
  if(!game.rewardChosen)return result(false,'先领取本波补给，再使用商店。')
  if(!['buy','sell','reroll'].includes(action) || price===null)return result(false,'没有可交易的物品。')
  if(action==='sell') {
    if(!game.jokers.some(item=>item.id===id))return result(false,'尚未持有这件物品。')
    const balance=game.crystals ?? 0,earned=game.stats?.crystalsEarned ?? 0
    if(!Number.isSafeInteger(balance) || balance<0 || !Number.isSafeInteger(earned) || earned<0 ||
        !Number.isSafeInteger(balance+price) || !Number.isSafeInteger(earned+price))return result(false,'当前蓝水晶记录无效。')
    return result(true)
  }
  if(action==='buy') {
    if(!game.shop.includes(id))return result(false,'这件物品不在当前货架。')
    if(game.soldShop.includes(id))return result(false,'本轮该商品已售出。')
    if(!JOKER_BY_ID[id].stackable && owns(game,id))return result(false,'已持有这件独有物品。')
    const owned=game.jokers.find(item=>item.id===id)
    if(owned && !Number.isSafeInteger((owned.quantity ?? 1)+1))return result(false,'这件物品的叠层记录已达可保存上限。')
  }
  if(!Number.isSafeInteger(game.crystals) || game.crystals<price)return result(false,`蓝水晶不足，需要 ${price} 蓝水晶。`)
  return result(true)
}

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
  if(!shopActionAvailability(game,'buy',id).available)return false
  const joker = JOKER_BY_ID[id]
  const owned = game.jokers.find(item => item.id === id)
  game.crystals -= joker.price
  if (owned) owned.quantity = (owned.quantity ?? 1) + 1
  else game.jokers.push({ ...joker, quantity:1, triggers:0, flash:0 })
  game.soldShop.push(id)
  log(game, `购入${joker.name} · 蓝水晶 −${joker.price} · ${joker.description}`, 'joker')
  return true
}

export function sellJoker(game, id) {
  if(!shopActionAvailability(game,'sell',id).available)return false
  const index = game.jokers.findIndex(joker => joker.id === id)
  if (index < 0) return false
  const joker = game.jokers[index]
  if (joker.quantity > 1) joker.quantity--
  else game.jokers.splice(index,1)
  const value = sellValue(id)
  gainCrystals(game, value)
  log(game, `出售${joker.name} · 蓝水晶 +${value}`, 'normal')
  return true
}

export function rerollShop(game) {
  const quote=shopActionAvailability(game,'reroll')
  if(!quote.available)return false
  game.crystals-=quote.price
  if(quote.price===0)game.inheritance.refreshUsed=true
  refreshShop(game)
  return true
}
