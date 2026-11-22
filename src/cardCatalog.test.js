import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { CARD_RANKS, CARD_SUITS, CARD_CATALOG, getCardDesign } from './cardCatalog.js'
import { createGame, previewHand, deploy, JOKERS, snapshotGame, restoreGame, tick, beginBattle } from './engine.js'

function fixture(game, faces) {
  const allFaces = CARD_SUITS.flatMap(faction => CARD_RANKS.map(rank => ({ suit: faction.suit, rank })))
  const used = new Set(faces.map(card => `${card.suit}${card.rank}`))
  game.hand = [...faces, ...allFaces.filter(card => !used.has(`${card.suit}${card.rank}`))].slice(0, 8)
    .map((card, index) => ({ ...card, id: `identity-hand-${index}` }))
  const held = new Set(game.hand.map(card => `${card.suit}${card.rank}`))
  game.deck = allFaces.filter(card => !held.has(`${card.suit}${card.rank}`))
    .map((card, index) => ({ ...card, id: `identity-deck-${index}` }))
  game.selected = game.hand.slice(0, faces.length).map(card => card.id)
}

function own(game, id) {
  game.jokers.push({ ...JOKERS.find(joker => joker.id === id), triggers: 0, flash: 0 })
}

test('all 52 designs have a unique name and a valid faction atlas cell', () => {
  assert.equal(CARD_CATALOG.length, 52)
  assert.equal(new Set(CARD_CATALOG.map(card => card.id)).size, 52)
  assert.equal(new Set(CARD_CATALOG.map(card => card.name)).size, 52)
  for (const faction of CARD_SUITS) {
    const members = CARD_CATALOG.filter(card => card.suit === faction.suit)
    assert.deepEqual(members.map(card => card.rank), CARD_RANKS)
    assert.deepEqual(members.map(card => card.frame), Array.from({ length: 13 }, (_, index) => index))
    assert.ok(members.every(card => card.atlas === faction.asset && card.type === faction.type && card.role === faction.role && card.description.length > 10))
  }
  assert.equal(getCardDesign('♠', 'A').id, 'spades-A')
  assert.equal(getCardDesign('hearts-Q').name, '赤誓圣女')
  assert.equal(getCardDesign({ suit: '♦', rank: 'K' }).id, 'diamonds-K')
  assert.equal(getCardDesign({ appearanceId: 'clubs-10', type: 'ranger' }).id, 'clubs-10')
  assert.equal(getCardDesign({ type: 'healer' }).id, 'hearts-2')
  for (const value of [null, undefined, {}, 'missing', '♠15', { suit: 'bad', rank: 'A' }]) assert.equal(getCardDesign(value), null)
})

test('every physical face can summon the same high-card profession from an empty camp', () => {
  for (const design of CARD_CATALOG) {
    const game = createGame()
    fixture(game, [{suit:design.suit,rank:design.rank}])
    const hand = previewHand(game)
    assert.deepEqual(hand.recruits.map(u=>u.appearanceId), ['spades-3'])
    assert.equal(hand.recruits[0].cardSlot,design.suit+design.rank)
    assert.ok(deploy(game))
    assert.equal(game.allies[0].jobId,'blade')
    assert.deepEqual(game.allies.map(u=>u.appearanceId), ['spades-3'])
  }
})

test('three recruiting jokers strengthen the contracted leader while preserving the pair count', () => {
  const game = createGame({doctrine: 'arcane'})
  fixtureCompany(game, 'healer')
  own(game, 'iron-banner'); own(game, 'royal-command')
  game.stats.deploys = 2
  fixture(game, [{suit:'♥',rank:'Q'},{suit:'♦',rank:'Q'},{suit:'♣',rank:'K'}])
  const before = game.allies.length, preview = previewHand(game)
  const troop = [...preview.recruits,...preview.reserve]
  assert.deepEqual(troop.map(u=>u.appearanceId), ['hearts-Q'])
  assert.deepEqual(troop.map(u=>u.level),[3])
  assert.equal(preview.combo.filter(text=>/铁壁旗手|第三幕|皇家密令/.test(text)).length,3)
  assert.ok(deploy(game))
  assert.deepEqual(game.allies.slice(before).map(u=>u.appearanceId), preview.recruits.map(r=>r.appearanceId))
})

test('identity saves restore canonically, migrate legacy class-only armies and reject mismatches', () => {
  const game = createGame({ seed: 'identity-save', doctrine: 'arcane' })
  fixtureCompany(game, 'knight')
  fixture(game, [{ suit: '♠', rank: 'A' }, { suit: '♥', rank: 'K' }, { suit: '♣', rank: 'J' }, { suit: '♦', rank: 'Q' }])
  deploy(game)
  beginBattle(game)
  const snapshot = snapshotGame(game)
  const restored = restoreGame(snapshot)
  assert.ok(restored)
  assert.deepEqual(restored.allies, game.allies)
  for (let index = 0; index < 15; index++) { tick(game, .1); tick(restored, .1) }
  assert.deepEqual(snapshotGame(restored), snapshotGame(game))

  const forgedName = structuredClone(snapshot)
  forgedName.allies[0].name = 'forged name'
  forgedName.allies[0].className = 'forged role'
  const canonical = restoreGame(forgedName).allies[0]
  assert.equal(canonical.name, getCardDesign(canonical).name)
  assert.equal(canonical.className, getCardDesign(canonical).role)

  const legacy = structuredClone(snapshot)
  for (const unit of legacy.allies) {
    delete unit.pattern; delete unit.statBonus; delete unit.variantRank; delete unit.jobId; delete unit.cardSlot; delete unit.trainingXp; delete unit.suit; delete unit.rank; delete unit.appearanceId; delete unit.className
  }
  const migrated = restoreGame(legacy)
  assert.ok(migrated)
  assert.ok(migrated.allies.every(unit => unit.rank === '2' && getCardDesign(unit).type === unit.type))

  for (const mutate of [
    unit => { unit.appearanceId = 'spades-15' },
    unit => { unit.rank = unit.rank === 'K' ? '2' : 'K' },
    unit => { unit.suit = '♥' },
    unit => { unit.type = 'mage' },
    unit => { delete unit.appearanceId },
    unit => { unit.rank = 2 },
  ]) {
    const invalid = structuredClone(snapshot)
    mutate(invalid.allies[0])
    assert.equal(restoreGame(invalid), null)
  }
})
