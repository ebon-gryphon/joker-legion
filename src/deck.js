import { slotOf, deckFaces, uid, shuffle, faceOf, log, inCamp, canSelectHand, copies, spendCharge } from './gameState.js'
import { PRINTS_PER_WAVE, RANKS } from './campaignRules.js'

export function replenish(game, count = 8) {
  while (game.hand.length < count) {
    if (!game.deck.length) {
      const held = new Set(game.hand.map(slotOf))
      const stock = deckFaces.map(slot => {
        const face = game.cardEdits[slot] || slot
        const card = { id: uid(game, 'card'), rank: face.slice(1), suit: face[0] }
        if (face !== slot) card.baseFace = slot
        return card
      })
      game.deck = shuffle(game, stock.filter(card => !held.has(slotOf(card))))
    }
    game.hand.push(game.deck.pop())
  }
}

export function printingCost(game, count = 1) {
  const nextPrice = 2 + (game.printsBudget ?? PRINTS_PER_WAVE) - game.printsLeft
  return count * nextPrice + count * (count - 1) / 2
}

export function printCards(game, sourceId, targetIds) {
  if (game.phase !== 'ready' || !Array.isArray(targetIds) || !targetIds.length ||
      targetIds.length > game.printsLeft || targetIds.includes(sourceId)) return false
  const source = game.hand.find(card => card.id === sourceId)
  const targets = selectedCards(game, targetIds)
  const price = printingCost(game, targetIds.length)
  if (!source || !targets || price > game.gold || targets.some(card => faceOf(card) === faceOf(source))) return false
  const face = faceOf(source)
  for (const card of targets) {
    const slot = slotOf(card)
    if (card.id === game.palmedCard?.id) game.palmedCard = null
    card.rank = source.rank
    card.suit = source.suit
    if (slot === face) {
      delete card.baseFace
      delete game.cardEdits[slot]
    } else {
      card.baseFace = slot
      game.cardEdits[slot] = face
    }
  }
  game.gold -= price
  game.printsLeft -= targets.length
  log(game, '改印 ' + targets.length + ' 张为 ' + face + ' · 金币 −' + price, 'good')
  return true
}

export function selectedCards(game, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5 || new Set(ids).size !== ids.length) return null
  const cards = ids.map(id => game.hand.find(card => card.id === id))
  return cards.every(Boolean) ? cards : null
}

export function shiftedRank(rank, step) {
  if (step !== 1 && step !== -1) return null
  return RANKS[RANKS.indexOf(rank) + step] || null
}

export function playedFace(game, card) {
  const turn = game.palmedCard
  return turn?.id === card.id ? { ...card, rank: shiftedRank(card.rank, turn.step) } : card
}

export function extraHandPrice(game) {
  return 4 * (game.handsBought + 1) - (copies(game,'silver-pass') ? 2 : 0)
}

export function buyExtraHand(game, quotedPrice = extraHandPrice(game)) {
  const price = extraHandPrice(game)
  if (!inCamp(game) || quotedPrice !== price || game.gold < price) return false
  game.gold -= price
  spendCharge(game,'silver-pass')
  game.handsBought++
  game.handsLeft++
  game.paidHandsLeft++
  log(game, '加购一手 · −' + price + ' 金币 · 下一手免军令', 'good')
  return true
}

export function redrawPrice(game) {
  return game.discards > 0 || copies(game,'redraw-voucher') ? 0 : 2
}

export function selectCard(game, id) {
  if (!canSelectHand(game) || !game.hand.some(card => card.id === id)) return false
  const index = game.selected.indexOf(id)
  if (index >= 0) game.selected.splice(index, 1)
  else if (game.selected.length < 5) game.selected.push(id)
  else return false
  return true
}

export function discard(game) {
  if (!canSelectHand(game) || game.discardCooldown > 0) return false
  const price = redrawPrice(game)
  if (game.gold < price) return false
  const cards = selectedCards(game, game.selected)
  if (!cards) return false
  const ids = new Set(game.selected)
  if (ids.has(game.palmedCard?.id)) game.palmedCard = null
  game.hand = game.hand.filter(card => !ids.has(card.id))
  game.selected = []
  if (price) game.gold -= price
  else if (game.discards > 0) game.discards--
  else spendCharge(game,'redraw-voucher')
  game.stats.discards++
  game.discardCooldown = 0
  replenish(game)
  log(game, `更换 ${cards.length} 张手牌 · ${price ? `金币 −${price}` : `剩余 ${game.discards} 次免费换牌`}`, 'normal')
  return true
}
