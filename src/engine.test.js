import { workshopPairs } from './forge.js'
import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOCTRINES, FIELD_LIMIT, HANDS_PER_WAVE, JOKERS, WAVES, setOrderTarget, setFormation, trainOrder, SUITS, createGame, previewHand, selectCard,
  discard, deploy, tick, buyJoker, sellJoker, rerollShop, nextWave,
  chooseReward, snapshotGame, restoreGame, beginBattle, promote, promotionPreview, commission, recommendHand, vanguard, forgeUnit,
} from './engine.js'

function select(game, indices) { game.selected = indices.map(index => game.hand[index].id) }
function advance(game, seconds) { for (let time = 0; time < seconds; time += 0.1) tick(game, Math.min(0.1, seconds - time)) }
function joker(id) { return { ...JOKERS.find(item => item.id === id), triggers: 0, flash: 0 } }

function fixtureCards(game, cards) {
  game.hand = cards.map(([rank, suit], index) => ({ id: `fixture-${index}`, rank, suit }))
  const used = new Set(game.hand.map(card => card.suit + card.rank))
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  for (const suit of Object.keys(SUITS)) for (const rank of ranks) {
    if (game.hand.length === 8) break
    if (!used.has(suit + rank)) { game.hand.push({ id: `fixture-${game.hand.length}`, rank, suit }); used.add(suit + rank) }
  }
  game.deck = game.deck.filter(card => !used.has(card.suit + card.rank))
}

function playRun(seed, doctrine = 'iron') {
  const game = createGame({ seed, doctrine })
  for (let index = 0; index < 4000 && !['won', 'lost'].includes(game.phase); index++) {
    if (game.phase === 'shop') {
      chooseReward(game, game.baseHp < 65 ? 'repair' : 'power')
      trainOrder(game, game.lastDeploy?.key || 'pair')
      for (const id of game.shop.slice()) if (game.gold > 18) buyJoker(game, id)
      assert.equal(nextWave(game), true)
    } else {
      if (game.phase === 'ready') {
        for (let hand = 0; hand < 3; hand++) {
          const ids = recommendHand(game)
          if (!ids) break
          game.selected = ids
          assert.ok(deploy(game))
          if (game.allies.length >= 3 && game.gold >= 5) {
            const pair = workshopPairs(game).profession.sort((a,b) =>
              (b.leader.atk+b.leader.heal) - (a.leader.atk+a.leader.heal))[0]
            if (pair) assert.ok(forgeUnit(game,pair.leader.id,pair.donor.id,'profession'))
          }
          const pair = workshopPairs(game).promote[0]
          if (pair) assert.ok(promote(game,pair.leader.id,pair.donor.id))
        }
        assert.ok(beginBattle(game))
        assert.equal(game.enemies.length,game.schedule.length)
        assert.equal(game.spawnIndex,game.schedule.length)
      }
      tick(game, 0.25)
      assert.ok(game.allies.length <= FIELD_LIMIT && game.enemies.length <= game.schedule.length)
      assert.ok(game.effects.length <= 110)
      assert.ok(Number.isFinite(game.energy) && game.energy >= 0 && game.energy <= game.maxEnergy)
      assert.equal(new Set(game.hand.map(card => card.id)).size, 8)
    }
  }
  return game
}

test('opening choices create deterministic legal hands and distinct starter rules', () => {
  assert.equal(DOCTRINES.length, 6)
  assert.equal(WAVES.length, 12)
  const one = createGame({ seed: 'same', doctrine: 'iron' })
  const two = createGame({ seed: 'same', doctrine: 'iron' })
  assert.deepEqual(one, two)
  assert.deepEqual(createGame({ seed: 1234 }), createGame({ seed: '1234' }))
  assert.equal(beginBattle(one), false)
  assert.notDeepEqual(one.hand, createGame({ seed: 'another' }).hand)
  assert.equal(one.hand.length, 8)
  assert.equal(one.deck.length, 44)
  assert.equal(new Set([...one.hand, ...one.deck].map(card => card.suit + card.rank)).size, 52)
  assert.equal(one.phase, 'ready')
  assert.deepEqual(DOCTRINES.map(item => createGame({ doctrine: item.id }).jokers[0].id), DOCTRINES.map(item => item.joker))
  assert.equal(createGame({ doctrine: 'unknown' }).doctrine, 'iron')
})

test('selection limits, stale IDs and preview reads never consume state', () => {
  const game = createGame()
  const before = snapshotGame(game)
  assert.equal(previewHand(game, ['missing']).canDeploy, false)
  assert.equal(previewHand(game, [game.hand[0].id, game.hand[0].id]).canDeploy, false)
  assert.equal(previewHand(game, game.hand.slice(0, 6).map(card => card.id)).canDeploy, false)
  previewHand(game, game.hand.slice(0, 2).map(card => card.id))
  assert.deepEqual(snapshotGame(game), before)
  assert.equal(selectCard(game, 'missing'), false)
  for (const card of game.hand.slice(0, 5)) assert.equal(selectCard(game, card.id), true)
  assert.equal(selectCard(game, game.hand[5].id), false)
  assert.equal(game.selected.length, 5)
  assert.equal(selectCard(game, game.hand[0].id), true)
  assert.equal(game.selected.length, 4)
})

test('all nine poker hands including ace-low straight produce coherent costs and levels', () => {
  const examples = [
    ['high', [['2', '♠']]],
    ['pair', [['8', '♠'], ['8', '♥']]],
    ['twoPair', [['8', '♠'], ['8', '♥'], ['Q', '♠'], ['Q', '♣']]],
    ['three', [['8', '♠'], ['8', '♥'], ['8', '♣']]],
    ['straight', [['A', '♠'], ['2', '♥'], ['3', '♠'], ['4', '♣'], ['5', '♦']]],
    ['flush', [['2', '♠'], ['4', '♠'], ['8', '♠'], ['Q', '♠'], ['A', '♠']]],
    ['fullHouse', [['8', '♠'], ['8', '♥'], ['8', '♣'], ['Q', '♣'], ['Q', '♦']]],
    ['four', [['8', '♠'], ['8', '♥'], ['8', '♣'], ['8', '♦']]],
    ['straightFlush', [['10', '♥'], ['J', '♥'], ['Q', '♥'], ['K', '♥'], ['A', '♥']]],
  ]
  for (const [key, cards] of examples) {
    const game = createGame()
    fixtureCompany(game, 'knight')
    fixtureCards(game, cards)
    const preview = previewHand(game, game.hand.slice(0, cards.length).map(card => card.id))
    assert.equal(preview.key, key)
    assert.ok(preview.canDeploy)
    assert.ok(preview.cost >= 2 && preview.cost <= game.maxEnergy)
    assert.ok(preview.targetCount > 0 && preview.level === 1 && preview.scoringIds.length > 0)
    assert.equal(preview.actualUnits, preview.recruits.length)
  }
})

test('deploy is atomic, consumes exactly displayed energy, applies the preview to the chosen regiment and refills eight cards', () => {
  const game = createGame()
  fixtureCompany(game, 'knight')
  const before = game.allies.length
  select(game, [0, 1])
  const preview = previewHand(game)
  const spentCards = new Set(game.selected)
  const energy = game.energy
  assert.equal(deploy(game), true)
  assert.equal(game.phase, 'ready')
  assert.equal(game.energy, energy - preview.cost)
  assert.equal(game.allies.length, before + preview.actualUnits)
  assert.equal(game.hand.length, 8)
  assert.ok(!game.hand.some(card => spentCards.has(card.id)))
  assert.equal(game.selected.length, 0)
  advance(game, 2)
  assert.equal(game.energy, energy - preview.cost)
  assert.equal(game.waveTime, 0)
  assert.equal(beginBattle(game), true)
  assert.equal(selectCard(game,game.hand[0].id),false)
  assert.equal(recommendHand(game),null)
  assert.equal(game.handsLeft,2)
  game.selected = [game.hand[0].id] // A stale UI event cannot bypass the phase guard.
  const blocked = snapshotGame(game)
  assert.equal(deploy(game), false)
  assert.deepEqual(snapshotGame(game), blocked)

})

test('rank matters within the same hand shape', () => {
  const game = createGame()
  fixtureCards(game, [['2', '♠'], ['2', '♥'], ['K', '♠'], ['K', '♥']])
  const low = previewHand(game, game.hand.slice(0, 2).map(card => card.id))
  const high = previewHand(game, game.hand.slice(2, 4).map(card => card.id))
  assert.equal(low.key, high.key)
  assert.ok(high.power > low.power)
})

test('the last open slot admits the sole recruit without training XP, and a full camp trains instead', () => {
  const game = createGame({doctrine:'arcane'})
  fixtureCompany(game,'knight'); game.jokers.push(joker('royal-command'));game.stats.deploys = 2
  fixtureCards(game,[['J','♠'],['J','♣'],['J','♦'],['K','♥'],['K','♦']]);select(game,[0,1,2,3,4])
  const hand=previewHand(game)
  assert.equal(hand.actualUnits,1);assert.equal(hand.overflow,0);assert.equal(hand.trainingXp,0)
  assert.ok(deploy(game));assert.equal(game.allies.length,FIELD_LIMIT)
  assert.equal(game.allies.at(-1).trainingXp,hand.trainingXp)
  select(game,[0]);const next=previewHand(game), trainer=game.allies.find(u=>u.id===next.trainerId), before=trainer.trainingXp
  assert.equal(next.actualUnits,0);assert.ok(next.trainingXp>0);assert.ok(deploy(game))
  assert.equal(game.allies.length,FIELD_LIMIT);assert.ok(game.lastDeploy.trainingXp>=next.trainingXp);assert.equal(trainer.trainingXp,before+game.lastDeploy.trainingXp)
})

test('redraw pays gold only after free uses and cannot charge twice for one selection', () => {
  const game = createGame()
  for (let i = 0; i < 3; i++) {
    select(game, [0, 1])
    const energy = game.energy
    const removed = game.selected.slice()
    assert.equal(discard(game), true)
    assert.equal(game.energy, energy)
    assert.equal(game.hand.length, 8)
    assert.ok(!game.hand.some(card => removed.includes(card.id)))
    assert.equal(discard(game), false)
    advance(game, 0.5)
  }
  assert.equal(game.discards, 0)
  select(game, [0])
  const gold = game.gold
  assert.equal(discard(game), true)
  assert.equal(game.gold, gold - 2)
  select(game, [0])
  game.gold = 1
  const before = snapshotGame(game)
  assert.equal(discard(game), false)
  assert.deepEqual(snapshotGame(game), before)
})

test('waves have finite enemy schedules and idle play can lose by actual base leaks', () => {
  const game = createGame({ seed: 42, doctrine: 'scarlet' })
  game.baseHp = 28
  fixtureCards(game,[['2','♥']]); select(game,[0])
  assert.equal(deploy(game), true)
  assert.equal(beginBattle(game), true)
  for (let i = 0; i < 1200 && game.phase === 'battle'; i++) tick(game, 0.1)
  assert.equal(game.phase, 'lost')
  assert.equal(game.baseHp, 0)
  assert.ok(game.stats.kills < game.waveSpawned)
  const frozen = snapshotGame(game)
  assert.equal(tick(game, 1), false)
  assert.equal(deploy(game), false)
  assert.equal(discard(game), false)
  assert.deepEqual(snapshotGame(game), frozen)
})

function healerStandoff(wave = 1, enemyType = 'raider') {
  const game = createGame({ seed: 'healer-standoff' })
  game.wave = wave
  fixtureCompany(game, 'healer')
  game.allies = [game.allies.find(unit => unit.jobId === 'medic')]
  game.schedule = [{ at: 0, type: enemyType }]; beginBattle(game)
  tick(game, 1 / 30)
  const healer = game.allies[0], enemy = game.enemies[0]
  Object.assign(healer, { x: 400, y: 240, cooldown: .5, heal: 30, period: 1 })
  Object.assign(enemy, { x: 406, y: 240, cooldown: 0, atk: 10, period: 1 })
  return game
}

test('a lone self-healing priest holds until the deadline, then only the surviving raider breaches', () => {
  const game = healerStandoff()
  const deadline = WAVES[0].duration
  advance(game, deadline - .1)
  assert.equal(game.phase, 'battle')
  assert.ok(game.waveReport.healer.healed > 100)
  assert.equal(game.enemies[0].hp, game.enemies[0].maxHp)
  const restored = restoreGame(snapshotGame(game))
  for (const g of [game, restored]) {
    const gate = g.baseHp
    tick(g, 1)
    assert.equal(g.phase, 'shop')
    assert.equal(g.waveTime, deadline)
    assert.equal(g.baseHp, gate - 6)
    assert.deepEqual(g.waveTimeout, { count: 1, damage: 6, boss: false })
    assert.equal(g.stats.kills, 0)
    assert.equal(g.gold, 18)
    assert.equal(tick(g, 2), false)
    assert.equal(g.baseHp, gate - 6)
    assert.deepEqual(restoreGame(snapshotGame(g)).waveTimeout, g.waveTimeout)
    chooseReward(g, 'power')
    nextWave(g)
    assert.equal(g.waveTimeout, null)
    assert.equal(g.waveTime, 0)
  }
})

test('the last combat step can clear the field, while a surviving boss breaks the gate', () => {
  for (const killBoss of [true, false]) {
    const game = healerStandoff(12, 'finalBoss')
    game.waveTime = WAVES[11].duration - 1 / 30
    game.enemies[0].hp = 1
    game.allies[0].cooldown = killBoss ? 0 : 1
    const gate = game.baseHp
    tick(game, 1 / 30)
    assert.equal(game.phase, killBoss ? 'won' : 'lost')
    assert.equal(game.stats.kills, killBoss ? 1 : 0)
    assert.equal(game.baseHp, killBoss ? gate : 0)
    assert.deepEqual(game.waveTimeout, killBoss ? null : { count: 1, damage: gate, boss: true, bossName:'缀命皇后' })
  }
})

test('an overdue legacy battle resolves queued reinforcements immediately without another attack', () => {
  const snapshot = snapshotGame(healerStandoff())
  delete snapshot.waveTimeout
  snapshot.waveTime = WAVES[0].duration + 90
  snapshot.schedule.push({ at: 8, type: 'brute' })
  snapshot.baseHp = 15
  snapshot.allies[0].cooldown = 0
  snapshot.enemies[0].hp = 1
  const game = restoreGame(snapshot)
  tick(game, 1 / 30)
  assert.equal(game.phase, 'lost')
  assert.equal(game.waveTime, WAVES[0].duration)
  assert.equal(game.time, snapshot.time)
  assert.equal(game.stats.kills, 0)
  assert.deepEqual(game.waveTimeout, { count: 2, damage: 15, boss: false })
})

test('wave rewards, purchases, sell and reroll respect phases, funds and once-only reward choice', () => {
  const game = createGame({ seed: 7 })
  fixtureCompany(game, 'knight')
  assert.equal(buyJoker(game, 'crossfire'), false)
  assert.equal(rerollShop(game), false)
  assert.equal(chooseReward(game, 'power'), false)
  select(game, [0, 1, 2, 3])
  deploy(game)
  game.schedule = [{ at: 0, type: 'raider' }]; beginBattle(game)
  for (let i = 0; i < 900 && game.phase === 'battle'; i++) tick(game, 0.1)
  assert.equal(game.phase, 'shop')
  assert.ok(Object.values(game.waveReport).some(row => row.damage > 0))
  assert.equal(game.stats.wavesCleared, 1)
  assert.equal(game.gold, 18)
  assert.equal(nextWave(game), false)
  assert.equal(chooseReward(game, 'supply'), true)
  assert.equal(game.gold, 24)
  assert.equal(chooseReward(game, 'supply'), false)
  assert.equal(game.gold, 24)
  const id = game.shop[0], definition = JOKERS.find(item => item.id === id)
  const previous = game.gold
  assert.equal(buyJoker(game, id), true)
  assert.equal(game.gold, previous - definition.price)
  assert.equal(buyJoker(game, id), false)
  assert.ok(game.shop.includes(id)); assert.ok(game.soldShop.includes(id))
  assert.equal(sellJoker(game, id), true)
  assert.equal(game.gold, previous - definition.price + Math.floor(definition.price / 2))
  const beforeReroll = game.gold
  assert.equal(rerollShop(game), true)
  assert.equal(game.gold, beforeReroll - 2)
  assert.equal(new Set(game.shop).size, game.shop.length)
  assert.ok(!game.shop.some(id => game.jokers.some(item => item.id === id)))
  game.gold = 1
  const shelf = game.shop.slice()
  assert.equal(rerollShop(game), false)
  assert.deepEqual(game.shop, shelf)
  assert.equal(nextWave(game), true)
  assert.equal(game.wave, 2)
  assert.equal(game.phase, 'ready')
  assert.ok(Object.values(game.waveReport).every(row => row.damage === 0 && row.healed === 0))
  assert.equal(game.discards, 4)
  assert.equal(game.energy, game.maxEnergy)
  assert.equal(game.hand.length, 8)
})

test('sixth purchase stays on the shelf and cannot be purchased again after a sale', () => {
  const game = createGame()
  game.phase = 'shop'; game.rewardChosen = 'supply'; game.gold = 999
  game.jokers = JOKERS.slice(0, 5).map(item => joker(item.id))
  game.shop = JOKERS.slice(5, 8).map(item => item.id)
  assert.equal(buyJoker(game, game.shop[0]), true)
  assert.equal(game.jokers.length, 6)
  assert.equal(sellJoker(game, game.shop[0]), true)
  assert.equal(buyJoker(game, game.shop[0]), false)
  assert.equal(game.jokers.length, 5)
})

test('boss telegraphs before applying area damage and a boss breach is never victory', () => {
  const game = createGame()
  fixtureCompany(game, 'knight')
  select(game, [0, 1, 2, 3]); deploy(game)
  game.wave = 6
  game.schedule = [{ at: 0, type: 'boss' }]; beginBattle(game)
  advance(game, 0.1)
  game.bossTimer = 0.01
  advance(game, 0.1)
  assert.ok(game.bossTelegraph)
  assert.ok(game.bossTelegraph.remaining > 2.8)
  assert.equal(game.bossTelegraph.name, '猩红轰击')
  const hp = game.allies.reduce((sum, unit) => sum + unit.hp, 0)
  advance(game, 2)
  assert.ok(game.bossTelegraph)
  assert.equal(game.allies.reduce((sum, unit) => sum + unit.hp, 0), hp)
  advance(game, 1.2)
  assert.equal(game.bossTelegraph, null)
  assert.ok(game.allies.reduce((sum, unit) => sum + unit.hp, 0) < hp)
  const boss = game.enemies.find(unit => unit.type === 'boss')
  boss.hp = boss.maxHp / 2
  game.bossTimer = 0
  const backX = Math.min(...game.allies.map(unit => unit.x))
  tick(game, 1 / 30)
  assert.equal(game.bossTelegraph.name, '破阵轰击')
  assert.equal(game.bossTelegraph.x, backX)
  game.allies = []
  game.enemies[0].x = 55
  advance(game, 0.1)
  assert.equal(game.phase, 'lost')
  assert.equal(game.baseHp, 0)
  assert.equal(game.stats.kills, 0)
})

test('casualty, healing and explosion chains terminate and stay inside bounds', () => {
  const game = createGame()
  fixtureCompany(game, 'knight')
  game.jokers = ['blood-pact', 'last-laugh', 'heart-engine'].map(joker)
  select(game, [0, 1]); deploy(game)
  game.schedule = [{ at: 0, type: 'raider' }, { at: 0, type: 'raider' }]; beginBattle(game)
  advance(game, 0.1)
  const victims = game.allies
  for (const unit of victims) { unit.x = 500; unit.y = 240; unit.hp = 0 }
  for (const unit of game.enemies) { unit.x = 505; unit.y = 240; unit.hp = 10 }
  advance(game, 0.1)
  assert.equal(game.stats.lost, victims.length)
  assert.equal(game.enemies.length, 0)
  assert.equal(game.stats.kills, 2)
  assert.ok(game.energy <= game.maxEnergy)
  assert.ok(game.effects.length <= 110)
  assert.ok(game.logs.length <= 36)
})

test('snapshot restoration retains RNG, combat and future draws without trusting stored rule text', () => {
  const game = createGame({ seed: 'replay-123', doctrine: 'arcane' })
  fixtureCompany(game, 'knight')
  select(game, [0, 1, 2, 3]); deploy(game)
  beginBattle(game)
  advance(game, 7.17)
  const data = snapshotGame(game)
  const saved = JSON.stringify(data)
  const restored = restoreGame(saved)
  assert.ok(restored)
  assert.equal(restored.rng, game.rng)
  assert.equal(restored.accumulator, game.accumulator)
  assert.deepEqual(restored.hand, game.hand)
  assert.deepEqual(restored.allies, game.allies)
  for (let i = 0; i < 40; i++) { tick(game, 0.1); tick(restored, 0.1) }
  select(game, [0, 1]); select(restored, [0, 1])
  assert.equal(deploy(game), deploy(restored))
  assert.deepEqual(snapshotGame(restored), snapshotGame(game))
  const modified = JSON.parse(saved)
  modified.jokers[0].description = 'forged description'
  assert.notEqual(restoreGame(modified).jokers[0].description, 'forged description')
})

test('malformed snapshots are rejected instead of causing invalid actions or crashes', () => {
  const original = snapshotGame(createGame())
  const mutations = [
    value => { value.version = 9 },
    value => { value.wave = 0 },
    value => { value.energy = -1 },
    value => { value.hand[0].rank = '15' },
    value => { value.hand[0].id = value.hand[1].id },
    value => { value.hand[0].suit = '__proto__' },
    value => { value.deck.push(value.hand[0]) },
    value => { value.jokers[0].id = 'unimplemented' },
    value => { value.jokers.push(value.jokers[0]) },
    value => { value.selected = ['missing'] },
    value => { value.phase = 'playing' },
    value => { value.schedule[0].type = 'unknown' },
    value => { value.baseHp = value.maxBaseHp + 1 },
    value => { value.accumulator = 100 },
    value => { value.stats.deploys = -1 },
  ]
  for (const mutate of mutations) {
    const corrupted = structuredClone(original)
    mutate(corrupted)
    assert.equal(restoreGame(corrupted), null)
  }
  for (const invalid of [null, [], {}, 'bad-json']) assert.equal(restoreGame(invalid), null)
})

test('all six doctrines have multiple winnable seeds and each recommended-hand run reaches a legal ending', () => {
  for (const doctrine of DOCTRINES) {
    let wins = 0
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const game = playRun(seed, doctrine.id)
      assert.ok(['won', 'lost'].includes(game.phase), doctrine.id + ' seed ' + seed)
      assert.equal(game.stats.wavesCleared, game.phase === 'won' ? WAVES.length : game.wave - 1)
      assert.ok(game.stats.deploys >= game.wave)
      assert.ok(game.time < 850 && game.gold >= 0)
      if (game.phase === 'won') {
        wins++
        assert.ok(game.stats.kills >= 45)
        assert.equal(game.enemies.length, 0)
      } else assert.equal(game.baseHp, 0)
    }
    assert.ok(wins >= 2, doctrine.id + ' requires at least two reachable victories')
  }
})

test('merging transfers the displayed stats and wounds exactly and preserves the chosen character', () => {
  const game = createGame({ doctrine: 'arcane' })
  fixtureCompany(game, 'healer')
  const [leader, donor] = game.allies.filter(u => u.type === 'healer' && u.level === 1)
  donor.jobId=leader.jobId; donor.suit=leader.suit; donor.rank=leader.rank; donor.appearanceId=leader.appearanceId
  const knight = game.allies.find(u => u.type === 'knight')
  const count = game.allies.length
  leader.hp -= 10; donor.hp -= 5
  const future = promotionPreview(game, leader.id, donor.id)
  const previousId = leader.appearanceId
  assert.equal(future.hp, leader.hp + Math.round(donor.hp * .8))
  assert.equal(future.heal, leader.heal + Math.round(donor.heal * .8))
  assert.equal(promotionPreview(game, leader.id, knight.id), null)
  assert.equal(promote(game, leader.id, donor.id), true)
  for (const [key, value] of Object.entries(future)) assert.deepEqual(leader[key], value)
  assert.equal(leader.appearanceId, previousId)
  assert.equal(promote(game, leader.id, donor.id), false)
  assert.equal(game.promotions, 1)
  assert.equal(game.stats.lost, 0)
  assert.equal(game.allies.length, count - 1)
  const before = snapshotGame(game)
  for (const branch of ['guard', 'assault']) {
    const trial = restoreGame(before)
    assert.ok(trial)
    assert.equal(commission(trial, knight.id, branch), false)
    assert.equal(commission(trial, leader.id, branch), true)
    assert.equal(commission(trial, leader.id, branch), false)
    const veteran = trial.allies.find(unit => unit.id === leader.id)
    if (branch === 'guard') assert.equal(veteran.maxHp - veteran.hp, future.maxHp - future.hp)
    else assert.equal(veteran.heal, Math.round(future.heal * 1.3))
    assert.equal(vanguard(trial)[0].id, leader.id)
    assert.equal(restoreGame(snapshotGame(trial)).allies.find(u => u.id === leader.id).command, branch)
    assert.equal(beginBattle(trial), true)
    assert.equal(promotionPreview(trial, leader.id, knight.id), null)
  }
})

test('a royal straight flush crowns exactly one current recipient when the hand fills the remaining slots', () => {
  const game = createGame({doctrine:'scarlet'})
  fixtureCompany(game,'ranger')
  const free=FIELD_LIMIT-game.allies.length
  fixtureCards(game,['10','J','Q','K','A'].map(rank=>[rank,'♥']))
  select(game,[0,1,2,3,4]); const preview = previewHand(game)
  assert.equal(preview.name,'皇家同花顺'); assert.equal(preview.actualUnits,free);assert.equal(preview.reserve.length,1-free)
  const recipient=game.allies.find(u=>u.id===preview.crownId), before=recipient.atk
  assert.equal(recipient.type,'ranger'); assert.ok(deploy(game))
  assert.equal(game.allies.filter(u=>u.crowned).length,1)
  assert.equal(recipient.atk,Math.round((before+preview.bonus.force)*1.5))
  assert.equal(vanguard(game)[0].id,recipient.id)
})

test('legacy camp saves migrate to wave orders without changing the original deck', () => {
  const old = snapshotGame(createGame())
  delete old.reserveUsed; delete old.promotions; delete old.waveReport
  old.energyRegen = 0.8; old.maxEnergy = 12; old.energy = 8
  const migrated = restoreGame(old)
  assert.equal(migrated.energy, 16); assert.equal(migrated.energyRegen, 0)
  assert.deepEqual(old.hand, migrated.hand)
  assert.equal(migrated.reserveUsed, false)
  assert.equal(migrated.promotions, 0)
})
