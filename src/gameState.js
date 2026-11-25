import { SUITS, RANKS, ALLIED } from './campaignRules.js'
import { recordGateRepair } from './combatStats.js'
import { healPlayerLife } from './playerLife.js'

export function seedNumber(seed) {
  if (/^\d+$/.test(String(seed)) && Number.isSafeInteger(Number(seed))) return Number(seed) >>> 0
  const text = String(seed || 'LEGION')
  let value = 2166136261
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return value >>> 0
}

export function random(game) {
  game.rng = (game.rng + 0x6D2B79F5) >>> 0
  let value = game.rng
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export function shuffle(game, array) {
  for (let i = array.length - 1; i > 0; i--) {
    const swap = Math.floor(random(game) * (i + 1))
    ;[array[i], array[swap]] = [array[swap], array[i]]
  }
  return array
}

export function uid(game, prefix) { return `${prefix}-${++game.sequence}` }

export function owns(game, id) { return game.jokers.some(joker => joker.id === id) }

export function copies(game, id) {
  const item = game.jokers.find(joker => joker.id === id)
  return item ? item.quantity ?? 1 : 0
}

export function spendCharge(game,id) {
  const item = game.jokers.find(joker => joker.id === id)
  if (!item?.consumable) return
  trigger(game,id,'使用一件')
  if (copies(game,id) > 1) item.quantity--
  else game.jokers.splice(game.jokers.indexOf(item),1)
}

export function clamp(value, low, high) { return Math.min(high, Math.max(low, value)) }

export function inCamp(game) { return game.phase === 'ready' }

export function canSelectHand(game) { return inCamp(game) && game.handsLeft > 0 }

export function distance(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * 1.35) }

export function log(game, text, tone = 'normal') {
  game.logs.unshift({ id: uid(game, 'log'), text, tone, time: game.time })
  if (game.logs.length > 36) game.logs.length = 36
}

export function effect(game, type, x, y, text = '', color = '', extra = {}) {
  if (game.effects.length >= 110) game.effects.shift()
  const life = type === 'projectile' ? 0.3 : type === 'summon' ? 0.8 : type === 'burst' ? 0.95 : 0.9
  game.effects.push({ id: uid(game, 'effect'), type, x, y, text, color, life, maxLife: life, ...extra })
}

export function trigger(game, id, text) {
  const joker = game.jokers.find(item => item.id === id)
  if (!joker) return
  joker.triggers++
  joker.flash = 1.1
  game.stats.jokerTriggers++
  game.chain++
  game.stats.maxChain = Math.max(game.stats.maxChain, game.chain)
  game.lastTrigger = { id, name: joker.name, text, time: game.time }
  if (text) log(game, `${joker.name} · ${text}`, 'joker')
}

export const faceOf = card => card.suit + card.rank

export const slotOf = card => card.baseFace ?? faceOf(card)

export const deckFaces = Object.keys(SUITS).flatMap(suit => RANKS.map(rank => suit + rank))

export function gainGold(game, amount) { game.gold += amount; game.stats.goldEarned += amount }

export function restoreBase(game, amount, source={}) {
  const healed=healPlayerLife(game,amount,source)
  if (healed > 0) {recordGateRepair(game,healed);effect(game,'heal',62,190,`生命 +${healed}`,'#80d9b0')}
  return healed
}

export function emptyTacticsReport() {
  return { prevented: 0, extraDamage: 0, tolls: 0, gateDamage: 0, interrupts: 0, bounty: 0 }
}

export function emptyWaveReport() {
  return Object.fromEntries(Object.keys(ALLIED).map(type => [type, { damage: 0, healed: 0 }]))
}
