import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { ORDER_BOOK, handScore, scoringHand } from './orders.js'
import { createGame, selectCard, discard, recommendHand, previewHand, deploy, beginBattle, tick,
  trainOrder, nextWave, chooseReward, snapshotGame, restoreGame, printingCost, printCards, JOKERS } from './engine.js'

const faceOf = card => card.suit + card.rank
const ids = cards => cards.map(card => card.id)
const faces = text => text.split(' ').map((face, i) => ({ id: String(i), suit: face[0], rank: face.slice(1) }))

test('all twelve handbook examples match the real evaluator and level-one chips and mult', () => {
  const base = [[5,1],[10,2],[20,2],[30,3],[30,4],[35,4],[40,4],[60,7],[100,8],[120,12],[140,14],[160,16]]
  assert.equal(Object.keys(ORDER_BOOK).length, base.length)
  Object.entries(ORDER_BOOK).forEach(([key, rule], i) => {
    const cards = faces(rule.example), [chips, mult] = base[i]
    const hand = scoringHand(cards)
    assert.equal(hand.key, key)
    assert.equal(hand.scoring.length, cards.length)
    assert.deepEqual(handScore(key,1,hand.points), { chips: chips + hand.points, mult, total: (chips + hand.points) * mult })
  })
  assert.deepEqual(handScore('flushFive',2,55), { chips:265, mult:19, total:5035 })
})

test('ace endpoints, kickers, identical faces and overlapping pair/flush triggers', () => {
  for (const [cards, key, scoring, pair, flush, royal] of [
    ['♥K ♣5 ♦Q', 'high', '♥K', false, false, false],
    ['♥2 ♠2 ♣A ♦K ♣3', 'pair', '♥2 ♠2', true, false, false],
    ['♦2 ♦2 ♦9 ♦9 ♦A', 'flush', '♦2 ♦2 ♦9 ♦9 ♦A', true, true, false],
    ['♦2 ♦2 ♦2 ♦2 ♦K', 'four', '♦2 ♦2 ♦2 ♦2', true, true, false],
    ['♦A ♣2 ♥3 ♠4 ♦5', 'straight', '♦A ♣2 ♥3 ♠4 ♦5', false, false, false],
    ['♦Q ♣K ♥A ♠2 ♦3', 'high', '♥A', false, false, false],
    ['♥A ♥K ♥Q ♥J ♥10', 'straightFlush', '♥A ♥K ♥Q ♥J ♥10', false, true, true],
    ['♥A ♥2 ♥3 ♥4 ♥5', 'straightFlush', '♥A ♥2 ♥3 ♥4 ♥5', false, true, false],
  ]) {
    const hand = scoringHand(faces(cards))
    assert.deepEqual([hand.key,hand.scoring.map(faceOf).join(' '),hand.containsPair,hand.containsFlush,hand.royal],
      [key,scoring,pair,flush,royal])
  }
})

function winWave(game) {
  while (game.energy >= 2) {
    const ids = recommendHand(game)
    if (!ids) break
    game.selected = ids
    assert.ok(deploy(game))
  }
  assert.ok(beginBattle(game))
  for (let i = 0; i < 1200 && game.phase === 'battle'; i++) tick(game,.25)
  assert.equal(game.phase,'shop')
  assert.ok(chooseReward(game,'supply'))
}

for (const key of ['five','flushHouse','flushFive']) {
  test(key + ' can be built from a normal campaign, trained, saved and deployed', () => {
    let game = createGame({seed:'Arcana'})
    winWave(game)
    const purse = game.gold
    assert.equal(trainOrder(game,key),false)
    assert.equal(game.gold,purse)
    assert.ok(nextWave(game))
    let pair
    if (key === 'five') {
      while (!(pair = game.hand.find(card => game.hand.some(other => other.rank===card.rank && other.suit!==card.suit)))) {
        game.selected = ids(game.hand.slice(0,5))
        assert.ok(discard(game))
      }
    }
    const first = pair || game.hand.find(card => game.hand.some(other => other.suit===card.suit && other.rank!==card.rank))
    const bases = key === 'five' ? [first, game.hand.find(c=>c!==first && c.rank===first.rank)] :
      key === 'flushHouse' ? [first,game.hand.find(c=>c!==first && c.suit===first.suit)] : [first]
    const targets = game.hand.filter(card => !bases.includes(card)).slice(0,5-bases.length)
    const beforeGold = game.gold, cost = printingCost(game,targets.length)
    if (key === 'flushHouse') {
      assert.ok(printCards(game,bases[0].id,ids(targets.slice(0,2))))
      assert.ok(printCards(game,bases[1].id,ids(targets.slice(2))))
    } else assert.ok(printCards(game,bases[0].id,ids(targets)))
    assert.equal(game.gold,beforeGold-cost)
    const scout = game.hand.find(c=>!bases.includes(c) && !targets.includes(c))
    game.selected = [scout.id]
    assert.ok(deploy(game))
    const triggered = game.jokers[0].triggers
    for (const card of [...bases,...targets]) assert.ok(selectCard(game,card.id))
    game = restoreGame(snapshotGame(game))
    const preview = previewHand(game), leader = game.allies[0], old = {...leader}
    assert.equal(preview.key,key); assert.equal(preview.level,1)
    assert.equal(preview.scoringIds.length,5); assert.ok(preview.canDeploy)
    assert.equal(preview.score.total,handScore(key,1,preview.points).total)
    assert.equal(preview.containsFlush,key!=='five'); assert.ok(preview.containsPair)
    // A stronger natural variant from an earlier wave must not outrank a secret hand.
    game.stats.bestHand = '皇家同花顺'
    assert.ok(deploy(game))
    assert.equal(game.lastDeploy.score,preview.score.total)
    assert.equal(game.stats.bestHand,ORDER_BOOK[key].name)
    assert.equal(leader.maxHp,old.maxHp + (preview.bonus.vitality || 0))
    assert.equal(leader.atk,old.atk + (preview.bonus.force || 0))
    assert.equal(leader.shield,(old.shield || 0) + (preview.bonus.shield || 0))
    assert.equal(game.jokers[0].triggers,triggered+1)
    game = restoreGame(snapshotGame(game))
    assert.deepEqual(game.discoveredHands,[key])
    winWave(game)
    assert.ok(trainOrder(game,key)); assert.equal(game.handLevels[key],2)
    assert.ok(nextWave(game)); assert.ok(restoreGame(snapshotGame(game)))
  })
}

test('failed, repeated, stale and unaffordable print operations leave the deck and wallet intact', () => {
  const game = createGame()
  const [source,a,b,c,d] = ids(game.hand)
  assert.deepEqual([1,2,3,4].map(n=>printingCost(game,n)),[2,5,9,14])
  for (const materials of [[],[source],[a,a],[a,'gone'],[a,b,c],[a,b,c,d]]) {
    const before = snapshotGame(game)
    assert.equal(printCards(game,source,materials),false); assert.deepEqual(snapshotGame(game),before)
  }
  assert.ok(printCards(game,source,[a,b]))
  for (const [template,material] of [[source,[a]],['gone',[c]],[source,[d]]]) {
    const before = snapshotGame(game)
    assert.equal(printCards(game,template,material),false); assert.deepEqual(snapshotGame(game),before)
  }
  assert.ok(fixtureCompany(game,'knight')); assert.ok(beginBattle(game))
  assert.equal(printCards(game,source,[c]),false)
})

test('discard exhaustion, next-wave shuffles and save migration preserve physical cards independently of faces', () => {
  const game = createGame({seed:'Mirror'})
  const [source,...rest] = game.hand, targets = rest.slice(0,2)
  assert.ok(printCards(game,source.id,ids(targets)))
  const edits = {...game.cardEdits}
  // Hold three identical cards across repeated draw-pile refills.
  game.gold = 200
  for (let i = 0; i < 24; i++) {
    game.selected = ids(game.hand.filter(c=>c.id !== source.id && !targets.some(target=>target.id===c.id)))
    assert.ok(discard(game))
    assert.equal(game.hand.filter(c=>faceOf(c)===faceOf(source)).length,3)
    assert.ok(restoreGame(snapshotGame(game)))
  }
  winWave(game); assert.ok(nextWave(game))
  const stock = [...game.hand,...game.deck]
  assert.equal(stock.length,52)
  assert.equal(new Set(stock.map(c=>c.baseFace??faceOf(c))).size,52)
  assert.equal(stock.filter(c=>faceOf(c)===faceOf(source)).length,3)
  assert.deepEqual(game.cardEdits,edits); assert.equal(game.printsLeft,4)
  const valid = snapshotGame(game)
  for (const mutate of [
    bad=>{bad.discoveredHands=['high']}, bad=>{bad.handLevels.flushFive=2}, bad=>{bad.cardEdits={}}, bad=>{bad.printsLeft=5}, bad=>{bad.cardEdits['♣2']='not-a-face'},
    bad=>{const clone=[...bad.hand,...bad.deck].find(c=>c.baseFace); delete clone.baseFace},
  ]) {
    const bad=structuredClone(valid);mutate(bad);assert.equal(restoreGame(bad),null)
  }
  const older = snapshotGame(createGame())
  older.orderRules=1; older.orderTarget='knight'; delete older.discoveredHands; delete older.cardEdits; delete older.printsLeft
  for (const [key,rule] of Object.entries(ORDER_BOOK)) if (rule.secret) delete older.handLevels[key]
  older.handLevels.pair=3
  const migrated=restoreGame(older)
  assert.equal(migrated.handLevels.pair,3);assert.equal(migrated.handLevels.flushFive,1)
  assert.deepEqual(migrated.hand,older.hand);assert.deepEqual(migrated.deck,older.deck)
  assert.ok(restoreGame(snapshotGame(migrated)))
})

test('a modified same-suit four of a kind triggers both the crown and the banner, even with an unscored kicker', () => {
  const game=createGame()
  game.jokers.push({...JOKERS.find(joker=>joker.id==='flush-crown'),triggers:0,flash:0})
  const kicker=game.hand.find(card => game.hand.some(other => other.suit===card.suit && other.id!==card.id))
  const source=game.hand.find(card=>card.suit===kicker.suit && card.id!==kicker.id)
  const targets=game.hand.filter(card=>card!==source && card!==kicker).slice(0,3)
  game.gold=9
  assert.ok(printCards(game,source.id,ids(targets))); assert.ok(fixtureCompany(game,'knight'))
  game.selected=ids([kicker,source,...targets])
  const preview=previewHand(game)
  assert.equal(preview.key,'four');assert.equal(preview.scoringIds.length,4)
  assert.equal(preview.recruits[0].pattern,'four');assert.equal(preview.recruits[0].cardSlot,source.suit+source.rank)
  assert.equal(preview.count,1)
  assert.ok(deploy(game));assert.deepEqual(game.jokers.map(j=>j.triggers),[1,1])
})
