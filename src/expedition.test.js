import {claimTestReward, setTestRewardShelf, claimAvailableReward} from './rewardFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { beginBattle, buyExtraHand, chooseReward, createGame, deploy, designateChampion,
  discard, nextWave, previewHand, recommendHand, restoreGame, selectCard, setOrderTarget,
  snapshotGame, tick, useTrick } from './engine.js'
import { loadExpedition, saveExpedition, storageKey } from './expeditionStorage.js'
import { grantExperience, trainingBonus } from './training.js'
import { addUnit, commission, drill, forgeUnit, moveInCamp, buyJoker, sellJoker, rerollShop, trainOrder } from './engine.js'
import { damageUnit, settleDeaths } from './combatHealth.js'

function order(game, faces) {
  const cards = [...game.hand, ...game.deck]
  const chosen = faces.map(face => cards.find(card => card.suit + card.rank === face))
  assert.ok(chosen.every(Boolean))
  const rest = cards.filter(card => !chosen.includes(card))
  game.hand = [...chosen, ...rest.slice(0, 8 - chosen.length)]
  game.deck = rest.slice(8 - chosen.length)
  for (const card of chosen) assert.ok(selectCard(game, card.id))
  const plan = previewHand(game)
  assert.ok(deploy(game))
  return plan
}

function clear(game) {
  assert.ok(beginBattle(game))
  game.enemies = []
  game.waveTime = 4
  tick(game, .1)
  assert.equal(game.phase, 'shop')
}

test('a standing captain gains marks on surviving waves and keeps identity, outfit and training on reload', () => {
  let g=createGame({seed:'return',doctrine:'scarlet'})
  order(g,['♠K','♥K'])
  const first=g.allies[0]
  designateChampion(g,first.id);grantExperience(g,first,12)
  clear(g);assert.equal(g.champion.marks,1)
  assert.ok(claimTestReward(g,'power'));assert.ok(nextWave(g))
  order(g,['♠3'])
  assert.equal(g.champion.unitId,first.id)
  clear(g);assert.deepEqual([g.champion.level,g.champion.marks],[2,2])
  assert.ok(claimTestReward(g,'enlist'));g=restoreGame(snapshotGame(g));assert.ok(nextWave(g))
  assert.equal(g.allies.length,3);assert.equal(g.allies.at(-1).jobId,'pike')
  const captain=g.allies.find(u=>u.id===first.id)
  assert.deepEqual([captain.locked,captain.grade,captain.trainingXp,captain.variantRank],[true,first.grade,14,'K'])
  assert.ok(beginBattle(g))
})

test('enlist is an eligible random reward on every wave and never duplicates on resume', () => {
  for (const wave of [1,2,3,4,5]) {
    const g=createGame({seed:wave})
    g.wave=wave
    order(g,['♥2']);clear(g)
    assert.equal(g.rewards.length,3);assert.equal(new Set(g.rewards.map(row=>row.id)).size,3)
    if(!g.rewards.some(item=>item.id==='enlist')){const before=snapshotGame(g);assert.equal(chooseReward(g,'enlist'),false);assert.deepEqual(snapshotGame(g),before)}
    assert.ok(claimTestReward(g,'enlist'))
    assert.equal(chooseReward(g,'power'),false)
    const resumed=restoreGame(snapshotGame(g))
    assert.ok(nextWave(resumed));assert.equal(nextWave(resumed),false)
    const camp=restoreGame(snapshotGame(resumed))
    assert.equal(camp.allies.length,2);assert.equal(camp.allies[1].jobId,'pike')
    assert.equal(camp.handsLeft,3)
  }
})

test('ghost and voice cannot mutate cards, troops or gold through stale battle commands',()=>{
  for (const doctrine of ['iron','voice']) {
    const g=createGame({seed:123,doctrine})
    order(g,['♥A'])
    assert.ok(buyExtraHand(g))
    const id=g.hand[0].id
    assert.ok(selectCard(g,id))
    assert.ok(beginBattle(g))
    assert.deepEqual(g.selected,[])
    const original=snapshotGame(g)
    assert.equal(buyExtraHand(g),false);assert.equal(selectCard(g,id),false)
    assert.equal(useTrick(g,doctrine==='iron'?id:'knight',1),false)
    assert.equal(setOrderTarget(g,'knight'),false)
    assert.equal(recommendHand(g),null)
    assert.equal(discard(g),false);assert.equal(deploy(g),false)
    assert.deepEqual(snapshotGame(g),original)
  }
})

test('a corrupt local save is replaceable and only explicit camp selections resume',()=>{
  const values=new Map([[storageKey,'{broken']])
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
  assert.equal(loadExpedition(storage),null)
  const g=createGame({seed:'save'})
  selectCard(g,g.hand[0].id)
  saveExpedition(storage,g)
  assert.deepEqual(loadExpedition(storage).selected,g.selected)
  storage.setItem(storageKey,JSON.stringify(snapshotGame(g)))
  assert.deepEqual(loadExpedition(storage).selected,[])
})

test('a wiped, fused captain returns after a breached wave and a mid-battle reload', () => {
  let game = createGame({ seed:'wounded' }); game.gold=20
  const captain = addUnit(game, 'knight', 'ally', 2)
  const partner = addUnit(game, 'healer', 'ally', 2)
  const donor = addUnit(game, 'mage', 'ally')
  assert.ok(designateChampion(game, captain.id))
  assert.ok(moveInCamp(game, captain.id, 300, 246))
  assert.ok(forgeUnit(game, captain.id, partner.id, 'paladin'))
  assert.ok(drill(game, donor.id, captain.id))
  const { maxHp, atk, trainingXp } = captain
  const before = trainingBonus(trainingXp,game.wave), after = trainingBonus(trainingXp+1,game.wave)
  const hpGain=after.hp-before.hp, attackGain=after.atk-before.atk
  assert.ok(commission(game, captain.id, 'guard'))
  assert.ok(captain.maxHp > maxHp)
  assert.ok(beginBattle(game))
  damageUnit(game, captain, captain.maxHp)
  settleDeaths(game)
  assert.deepEqual(game.allies, [])
  game = restoreGame(snapshotGame(game))
  assert.equal(game.casualties[0].id, captain.id)
  for (let i=0; i<90 && game.phase === 'battle'; i++) tick(game, 1)
  assert.equal(game.phase, 'shop')
  assert.ok(game.baseHp > 0 && game.baseHp < game.maxBaseHp)
  assert.equal(game.waveKills, 0)
  assert.ok(claimTestReward(game, 'repair'))
  assert.ok(nextWave(game))
  const [unit] = game.allies
  assert.equal(game.allies.length, 1)
  assert.deepEqual([unit.id, unit.fusion, unit.level, unit.locked, unit.trainingXp, unit.hp, unit.maxHp, unit.atk],
    [captain.id, 'paladin', 3, true, trainingXp+1, maxHp+hpGain, maxHp+hpGain, atk+attackGain])
  assert.deepEqual([unit.x, unit.y, unit.campSpot, unit.command, game.casualties.length], [300,246,{x:300,y:246},undefined,0])
  assert.ok(beginBattle(game))
})

test('choosing supplies unlocks trade once and a full roster trains from the enlisted soldier', () => {
  const game = createGame({seed:'full-camp'})
  game.wave = 2
  for (const type of ['healer','mage','ranger','knight','healer']) addUnit(game, type, 'ally')
  const captain = game.allies[2]
  assert.ok(designateChampion(game, captain.id))
  const ids = game.allies.map(u=>u.id)
  clear(game)
  const gold = game.gold
  assert.equal(buyJoker(game, game.shop[0]), false)
  assert.equal(sellJoker(game, game.jokers[0].id), false)
  assert.equal(rerollShop(game), false)
  assert.equal(trainOrder(game, 'pair'), false)
  assert.equal(nextWave(game), false)
  assert.equal(game.gold, gold)
  assert.ok(claimTestReward(game, 'enlist'))
  assert.equal(chooseReward(game, 'power'), false)
  assert.ok(nextWave(game))
  assert.deepEqual(game.allies.map(u=>u.id), ids)
  assert.ok(game.allies[2].trainingXp > 0)
})

test('late fusion uses the actual stats a veteran gained in an earlier wave', () => {
  const game = createGame({seed:'training'})
  const donor = addUnit(game,'knight','ally',2)
  const baseHp = donor.maxHp, baseAtk = donor.atk
  grantExperience(game, donor, 30)
  clear(game)
  assert.ok(claimTestReward(game,'supply')); assert.ok(nextWave(game))
  const lead = addUnit(game,'healer','ally',2)
  const hp = lead.maxHp, atk = lead.atk
  const gain = trainingBonus(31, game.wave)
  assert.ok(forgeUnit(game, lead.id, donor.id, 'paladin'))
  assert.equal(lead.maxHp, hp + gain.hp + Math.round(baseHp * .6))
  assert.equal(lead.atk, atk + gain.atk + Math.round(baseAtk * .6))
})

test('old shop display records recover only documented identities, without consuming random draws', () => {
  const game = createGame({seed:'old-shop'})
  order(game,['♠8','♥8'])
  const captain = game.allies[0]
  designateChampion(game, captain.id)
  grantExperience(game, captain, 6)
  clear(game)
  const legacy = snapshotGame(game)
  delete legacy.casualties
  delete legacy.victorySeen
  legacy.allies = []
  const resumed = restoreGame(legacy)
  assert.equal(resumed.allies[0].id, captain.id)
  assert.deepEqual([resumed.allies[0].name, resumed.allies[0].locked, resumed.allies[0].trainingXp], ['青铃牧师',true,7])
  assert.deepEqual([resumed.sequence,resumed.rng,resumed.stats.summoned],[legacy.sequence,legacy.rng,legacy.stats.summoned])
  assert.deepEqual(restoreGame(snapshotGame(resumed)).allies, resumed.allies)
})
