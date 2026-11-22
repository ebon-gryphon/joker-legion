import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, setOrderTarget, previewHand, deploy, trainOrder, printCards,
  beginBattle, tick, chooseReward, nextWave, snapshotGame, restoreGame, buyJoker, buyExtraHand, extraHandPrice, recommendHand, discard } from './engine.js'
import { scoringHand, orderBonus } from './orders.js'

function deal(game, faces) {
  const cards = [...game.hand, ...game.deck]
  const held = faces.map(face => cards.find(c => c.suit + c.rank === face))
  assert.ok(held.every(Boolean))
  const remaining = cards.filter(c => !held.includes(c))
  game.hand = [...held, ...remaining.slice(0,8-held.length)]
  game.deck = remaining.slice(8-held.length)
  game.selected = held.map(c => c.id)
}

test('a pair always contracts one matching priest regardless of the order of the suits', () => {
  const g = createGame({seed:123,doctrine:'scarlet'})
  for (const [first,second] of [['♥8','♦8'],['♦8','♥8']]) {
    const game = restoreGame(snapshotGame(g))
    deal(game,[first,second,'♠K'])
    const before = snapshotGame(game), p = previewHand(game)
    assert.equal(beginBattle(game),false)
    assert.deepEqual(p.recruits.map(u=>[u.suit+u.rank,u.level,u.source]), [['♥8',1,'card']])
    assert.deepEqual(snapshotGame(game),before)
    assert.ok(deploy(game))
    assert.equal(game.gold,before.gold)
    assert.equal(game.energy,before.energy-p.cost)
    assert.deepEqual(game.allies.map(u=>u.appearanceId),p.recruits.map(u=>u.appearanceId))
    assert.ok(game.allies.filter(u=>u.type===p.target).every(u=>u.shield===p.bonus.shield))
  }
})

test('identical off-suit pairs shield either chosen regiment, kickers neither add points nor another body', () => {
  const game = createGame({doctrine:'arcane'})
  fixtureCompany(game,'knight')
  deal(game,['♣8','♦8','♥K'])
  const original = snapshotGame(game)
  for (const role of ['knight','healer']) {
    const copy = restoreGame(original)
    assert.ok(setOrderTarget(copy,role))
    const expected = previewHand(copy), bare = previewHand(copy,copy.selected.slice(0,2))
    assert.deepEqual(expected.scoringIds,copy.selected.slice(0,2))
    assert.equal(expected.points,16); assert.deepEqual(expected.bonus,bare.bonus)
    assert.deepEqual(expected.bonus,{shield:28}); assert.equal(expected.cost,3)
    assert.ok(deploy(copy)); assert.equal(copy.allies.length,original.allies.length+expected.actualUnits)
    assert.ok(copy.allies.every(u=>u.shield===(u.type===role ? 28 : 0)))
    assert.equal(copy.energy,13)
    copy.allies.pop()
    fixtureCompany(copy,'ranger')
    assert.equal(copy.allies.at(-1).shield,0)
  }
})

test('a straight changes action cadence, a full house raises HP and attack or healing on the selected bodies', () => {
  for (const [faces,shape] of [[['♥A','♦2','♠3','♣4','♥5'],'straight'],[['♥8','♦8','♣8','♣Q','♠Q'],'fullHouse']]) {
    const game=createGame({doctrine:'scarlet'}); fixtureCompany(game,'healer'); deal(game,faces)
    const p=previewHand(game), unit=game.allies[0], old={...unit}, count=game.allies.length
    assert.equal(p.key,shape); assert.ok(deploy(game)); assert.equal(game.allies.length,count+p.actualUnits)
    if(shape==='straight') assert.equal(unit.period,old.period*(1-p.bonus.haste/100))
    else {
      assert.equal(unit.maxHp,old.maxHp+p.bonus.vitality);assert.equal(unit.atk,old.atk+p.bonus.force)
      assert.equal(unit.heal,old.heal+p.bonus.force)
    }
  }
  assert.equal(scoringHand([{suit:'♣',rank:'K'},{suit:'♥',rank:'A'}]).points,11)
})

test('victory regroups everyone without a casualty trigger, but learned orders, jokers and gold carry over', () => {
  const game=createGame({doctrine:'arcane'});fixtureCompany(game,'knight');game.schedule=[]; beginBattle(game); game.waveTime=4; tick(game,.05)
  assert.equal(game.phase,'shop'); assert.equal(game.stats.lost,0); assert.ok(game.allies.length)
  const ids=game.allies.map(u=>u.id)
  assert.equal(trainOrder(game,'pair'),false)
  assert.equal(buyJoker(game,game.shop[0]),false)
  assert.ok(chooseReward(game,'supply'))
  const gold=game.gold
  assert.ok(trainOrder(game,'pair')); assert.equal(game.handLevels.pair,2); assert.equal(game.gold,gold-5)
  const trained=snapshotGame(game)
  assert.equal(trainOrder(game,'fullHouse'),false); assert.deepEqual(snapshotGame(game),trained)
  const copy=restoreGame(trained)
  assert.ok(buyJoker(copy,copy.shop[0])); assert.equal(chooseReward(copy,'supply'),false); const purse=copy.gold
  assert.ok(nextWave(copy)); assert.equal(copy.gold,purse); assert.equal(copy.jokers.length,2)
  assert.deepEqual(copy.allies.map(u=>u.id),ids); assert.equal(copy.handLevels.pair,2)
  deal(copy,['♣8','♦8']); assert.equal(previewHand(copy).bonus.shield,orderBonus('pair',2,16).shield)
  copy.phase='shop'; copy.rewardChosen='supply'; copy.gold=5; assert.ok(trainOrder(copy,'pair'))
  copy.trainedHere=false; copy.gold=10
  assert.equal(trainOrder(copy,'pair'),false); assert.equal(copy.gold,10)
  copy.gold=4; assert.equal(trainOrder(copy,'high'),false)
})

test('legacy camps, battles and shops preserve their recorded soldiers on every reopening', () => {
  const game=createGame();fixtureCompany(game,'mage')
  const fresh=snapshotGame(game); assert.deepEqual(restoreGame(fresh).allies,game.allies)
  for(const phase of ['ready','battle','shop']) {
    const legacy=structuredClone(fresh);delete legacy.orderRules;legacy.phase=phase;legacy.energy=5
    const restored=restoreGame(legacy)
    assert.ok(restored);assert.deepEqual(restored.allies.map(u=>u.id),game.allies.map(u=>u.id))
    assert.deepEqual(restored.hand,legacy.hand)
    if(phase==='ready') { assert.equal(restored.energy,16); assert.ok(fixtureCompany(restored,'knight')) }
    assert.deepEqual(restoreGame(snapshotGame(restored)).allies,restored.allies)
  }
  for(const mutate of [v=>{v.handLevels.pair=0},v=>{v.orderTarget='bogus'},v=>{v.orderRules=99},v=>{v.trainedHere=-1}]) {
    const bad=structuredClone(fresh);mutate(bad);assert.equal(restoreGame(bad),null)
  }
})

test('the banner shields the opening priest and battle orders cannot rebuild an empty field', () => {
  const game = createGame({doctrine:'iron'})
  deal(game,['♥8','♦8','♣K'])
  assert.equal(previewHand(game).target,'healer')
  assert.equal(setOrderTarget(game,'knight'),false)
  const opening = previewHand(game)
  assert.equal(opening.targetCount,1)
  assert.ok(deploy(game))
  assert.equal(game.allies[0].shield,opening.bonus.shield+24)
  assert.ok(beginBattle(game))
  game.allies = []
  deal(game,['♣Q'])
  assert.equal(previewHand(game).canDeploy,false)
  const frozen = snapshotGame(game)
  assert.equal(deploy(game),false)
  assert.deepEqual(snapshotGame(game),frozen)
})

test('v2 saves preserve an assembled camp and edited deck while switching further recruitment to cards', () => {
  const game = createGame({doctrine:'arcane'})
  fixtureCompany(game,'mage')
  deal(game,['♥7','♦7'])
  assert.ok(printCards(game,game.hand[4].id,[game.hand[5].id]))
  const previous = snapshotGame(game)
  previous.schedule.push({ at: 22, type: 'brute', convoyGuard: true })
  Object.assign(previous,{orderRules:2,companies:['mage'],mustersLeft:2})
  const loaded = restoreGame(previous)
  assert.equal(loaded.orderRules,3)
  assert.deepEqual(loaded.allies,previous.allies)
  assert.deepEqual(loaded.selected,previous.selected)
  assert.deepEqual(loaded.deck,previous.deck)
  assert.deepEqual(loaded.cardEdits,previous.cardEdits)
  assert.ok(!loaded.schedule.some(spawn=>spawn.convoyGuard))
  assert.ok(!Object.hasOwn(loaded,'companies'))
  const preview = previewHand(loaded)
  assert.ok(deploy(loaded))
  assert.equal(loaded.allies.length,previous.allies.length+preview.actualUnits)
})

test('three camp orders survive saves and a staffed new wave resets the budget', () => {
  let g=createGame({doctrine:'scarlet'})
  g.selected=[g.hand[0].id];assert.ok(deploy(g));assert.equal(g.handsLeft,2)
  for(let left=1;left>=0;left--){
    g.selected=[g.hand[0].id];assert.ok(deploy(g));assert.equal(g.handsLeft,left)
    g=restoreGame(snapshotGame(g));assert.ok(g)
  }
  g.selected=[g.hand[0].id];const spent=snapshotGame(g)
  assert.equal(deploy(g),false);assert.deepEqual(snapshotGame(g),spent)
  assert.ok(beginBattle(g));assert.equal(g.enemies.length,g.schedule.length)
  g.enemies=[];g.waveTime=4;tick(g,.1)
  assert.ok(chooseReward(g,'power'));assert.ok(nextWave(g))
  assert.equal(g.handsLeft,3);assert.equal(g.allies.length,3)
})

test('an older active oversized army can resume without gaining slots, and pending enemies enter exactly once', () => {
  const g=createGame({doctrine:'scarlet'})
  fixtureCompany(g,'knight')
  while(g.allies.length<16) g.allies.push({...g.allies[0],id:'old-'+g.allies.length})
  const old=snapshotGame(g)
  delete old.handsBought;delete old.paidHandsLeft;delete old.handsLeft;delete old.legacyFieldSize
  old.phase='battle';old.enemies=[];old.spawnIndex=0;old.stats.deploys=2
  old.schedule=[{at:1,type:'raider'},{at:15,type:'brute'}]
  const loaded=restoreGame(old)
  assert.equal(loaded.allies.length,16);assert.equal(loaded.enemies.length,2)
  assert.equal(loaded.handsLeft,1);assert.ok(restoreGame(snapshotGame(loaded)))
  loaded.selected=[loaded.hand[0].id];assert.equal(previewHand(loaded).actualUnits,0);assert.equal(deploy(loaded),false);assert.equal(loaded.allies.length,16)
  tick(loaded,.1);assert.equal(loaded.waveSpawned,2)
})

test('extra hands cost progressively more, survive camp reloads, and pay the exact next order’s energy', () => {
  let g = createGame({seed:92,doctrine:'scarlet'})
  g.gold = 12
  assert.equal(extraHandPrice(g),4)
  assert.ok(buyExtraHand(g,4))
  assert.deepEqual([g.gold,g.handsLeft,g.handsBought,g.paidHandsLeft],[8,4,1,1])
  assert.deepEqual(g.selected,[])
  const quoted = snapshotGame(g)
  assert.equal(buyExtraHand(g,4),false)
  assert.equal(deploy(g),false)
  assert.deepEqual(snapshotGame(g),quoted)
  g.selected = [g.hand.find(card => card.suit !== '♠').id]
  assert.ok(discard(g))
  assert.equal(g.paidHandsLeft,1)
  deal(g,['♠3','♠4','♠5','♠6','♠7'])
  g.energy = 0
  assert.ok(recommendHand(g))
  assert.equal(previewHand(g).cost,0)
  assert.ok(deploy(g))
  assert.deepEqual([g.allies.length,g.handsLeft,g.paidHandsLeft,g.energy],[1,3,0,0])
  deal(g,['♥8'])
  assert.equal(previewHand(g).reason,'军令不足')
  assert.ok(buyExtraHand(g,8))
  g = restoreGame(snapshotGame(g))
  assert.deepEqual([g.gold,g.handsLeft,g.paidHandsLeft,extraHandPrice(g)],[0,4,1,12])
  const poor = snapshotGame(g)
  assert.equal(buyExtraHand(g),false)
  assert.deepEqual(snapshotGame(g),poor)
  assert.ok(deploy(g))
  assert.deepEqual([g.energy,g.handsLeft,g.allies.length],[0,3,2])
  assert.ok(beginBattle(g));assert.equal(buyExtraHand(g),false)
})

test('an exhausted wave can buy a fourth play and unused purchases and price reset together next wave', () => {
  const g = createGame({seed:94,doctrine:'scarlet'})
  g.gold = 20
  for (let n=0;n<3;n++) {
    g.selected = [g.hand[0].id]
    assert.ok(deploy(g))
  }
  assert.equal(g.handsLeft,0)
  assert.ok(buyExtraHand(g))
  assert.ok(buyExtraHand(g))
  g.selected = [g.hand[0].id]
  assert.ok(deploy(g))
  assert.deepEqual([g.stats.deploys,g.handsLeft,g.paidHandsLeft],[4,1,1])
  assert.ok(beginBattle(g));assert.equal(g.enemies.length,g.schedule.length)
  g.enemies=[];g.waveTime=4;tick(g,.1)
  assert.equal(g.phase,'shop')
  const shop = snapshotGame(g)
  assert.equal(buyExtraHand(g),false)
  assert.deepEqual(snapshotGame(g),shop)
  assert.ok(chooseReward(g,'power'));assert.ok(nextWave(g))
  assert.deepEqual([g.handsLeft,g.handsBought,g.paidHandsLeft,extraHandPrice(g)],[3,0,0,4])
})

test('old four-hand saves retain spent actions and new saves reject impossible paid balances', () => {
  const g=createGame({seed:95}), current=snapshotGame(g)
  for (let remaining=0;remaining<=4;remaining++) {
    const old = {...current,handsLeft:remaining}
    delete old.handsBought;delete old.paidHandsLeft
    const loaded=restoreGame(old)
    assert.deepEqual([loaded.handsLeft,loaded.handsBought,loaded.paidHandsLeft],[Math.max(0,remaining-1),0,0])
    assert.ok(restoreGame(snapshotGame(loaded)))
  }
  for(const fields of [{handsLeft:4},{handsBought:1,paidHandsLeft:2},{handsLeft:0,handsBought:1,paidHandsLeft:1},{handsBought:-1},{paidHandsLeft:undefined}]) {
    assert.equal(restoreGame({...current,...fields}),null)
  }
})
