import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, nextWave, previewHand, snapshotGame, restoreGame, tick, useTrick, beginBattle, deploy, chooseReward, playedFace, printCards, DOCTRINES, JOKERS } from './engine.js'
import { PERFORMERS } from './performers.js'

test('all six performers can play any opening face from a fresh hand without choosing a company', () => {
  for (const actor of PERFORMERS) {
    const g = createGame({seed:3,doctrine:actor.doctrine})
    assert.equal(g.allies.length,0)
    assert.equal(Object.keys(g.handLevels).length,12)
    assert.equal(beginBattle(g),false)
    for (const card of g.hand) {
      const copy=restoreGame(snapshotGame(g))
      copy.selected=[card.id]
      assert.ok(deploy(copy))
      assert.equal(copy.allies[0].jobId,'blade')
      assert.equal(copy.allies[0].cardSlot,card.suit+card.rank)
      assert.ok(beginBattle(copy))
    }
  }
})

function camp(doctrine) {
  const game = createGame({ seed:3, doctrine })
  fixtureCompany(game,'knight')
  return game
}
function advance(game, seconds) {
  for (let count=0; count<Math.round(seconds*30); count++) tick(game,1/30)
}

test('鬼手 can turn a dealt pair into a straight without altering the deck print', () => {
  const game = camp('iron')
  const stock = [...game.hand,...game.deck]
  const faces = ['♠6','♦7','♠8','♥8','♣10']
  const cards = faces.map(face => stock.find(card => card.suit+card.rank===face))
  const other = stock.filter(card => !cards.includes(card))
  game.hand = [...cards,...other.slice(0,3)]
  game.deck = other.slice(3)
  const ids = cards.map(card => card.id)
  assert.equal(previewHand(game,ids).key,'pair')
  assert.equal(useTrick(game,cards[3].id,2),false)
  assert.equal(useTrick(game,cards[3].id,1),true)
  assert.equal(game.hand[3].rank,'8')
  assert.equal(playedFace(game,game.hand[3]).rank,'9')
  const restored = restoreGame(snapshotGame(game))
  assert.equal(previewHand(restored,ids).key,'straight')
  assert.equal(useTrick(restored,cards[0].id,1),false)
  restored.selected=ids
  assert.ok(deploy(restored))
  assert.equal(restored.lastDeploy.key,'straight')
  assert.equal(restored.palmedCard,null)
  assert.deepEqual(restored.cardEdits,{})
  assert.ok(restoreGame(snapshotGame(restored)))
})

test('双面 copies a live ally for six seconds, independent of the battle order and casualty triggers', () => {
  const g=camp('arcane'), unit=g.allies[0]
  assert.equal(useTrick(g,unit.id),false)
  beginBattle(g)
  g.reserveUsed=true
  assert.equal(useTrick(g,'missing'),false)
  assert.ok(useTrick(g,unit.id))
  const echo=g.allies.at(-1)
  assert.equal(echo.appearanceId,unit.appearanceId)
  assert.equal(echo.atk,unit.atk)
  assert.equal(echo.hp,unit.hp)
  assert.notEqual(echo.id,unit.id)
  advance(g,1)
  const loaded=restoreGame(snapshotGame(g))
  assert.ok(loaded.allies.some(u=>u.id===echo.id))
  advance(loaded,5.1)
  assert.ok(!loaded.allies.some(u=>u.id===echo.id))
  assert.equal(loaded.stats.lost,0)
  assert.equal(loaded.trickUsed,true)
})

test('铃铛 moves the chosen enemy into reach and continues the lure after a mid-flight save', () => {
  const g=camp('scarlet')
  beginBattle(g);advance(g,1.5)
  const target=g.enemies.at(-1)
  assert.equal(useTrick(g,g.allies[0].id),false)
  assert.ok(useTrick(g,target.id))
  assert.equal(g.reserveUsed,false)
  const goal=target.lure.toX
  advance(g,.55)
  const loaded=restoreGame(snapshotGame(g)), enemy=loaded.enemies.find(u=>u.id===target.id)
  assert.ok(enemy.x < target.lure.fromX && enemy.x > goal)
  advance(loaded,.5)
  assert.equal(enemy.lure,undefined)
  assert.ok(Math.abs(enemy.x-goal)<10)
  assert.equal(useTrick(loaded,enemy.id),false)
})

test('all six performers have a unique starter, selection art and HUD portrait, and refresh each wave', () => {
  assert.deepEqual(PERFORMERS.map(actor => actor.avatarFrame).sort((a,b)=>a-b),[0,1,2,3,4,5])
  assert.deepEqual(PERFORMERS.map(actor => actor.doctrine).sort(),DOCTRINES.map(choice => choice.id).sort())
  for (const key of ['id','doctrine','partner','art','keyArt']) assert.equal(new Set(PERFORMERS.map(actor=>actor[key])).size,6)
  for (const {doctrine,partner} of PERFORMERS) {
    const snap=snapshotGame(camp(doctrine))
    delete snap.trickUsed;delete snap.palmedCard;delete snap.keptCardId
    const game=restoreGame(snap)
    assert.equal(game.jokers[0].name,partner)
    assert.equal(game.keptCardId,null)
    assert.equal(game.trickUsed,false)
    game.trickUsed=true
    game.schedule=[];beginBattle(game)
    advance(game,3.2)
    assert.ok(chooseReward(game,'supply'));assert.ok(nextWave(game))
    assert.equal(game.trickUsed,false)
    assert.equal(game.palmedCard,null)
  }
})

test('夹层 carries exactly one physical card, including its changed print, across the shop, save and shuffle', () => {
  const game = camp('sleeve')
  const [source,kept] = game.hand
  assert.ok(printCards(game,source.id,[kept.id]))
  assert.ok(kept.baseFace)
  assert.equal(useTrick(game,kept.id),false)
  game.schedule=[];beginBattle(game)
  advance(game,3.2)
  assert.equal(game.phase,'shop')
  assert.equal(useTrick(game,'missing'),false)
  assert.ok(useTrick(game,kept.id))
  assert.equal(useTrick(game,source.id),false)
  const snap = snapshotGame(game)
  assert.equal(restoreGame({...snap,keptCardId:'missing'}),null)
  assert.equal(restoreGame({...snap,trickUsed:false}),null)
  const loaded = restoreGame(snap)
  assert.ok(chooseReward(loaded,'supply'))
  assert.ok(nextWave(loaded))
  assert.deepEqual(loaded.hand[0],kept)
  assert.equal(loaded.hand.length,8)
  assert.equal(loaded.deck.length,44)
  assert.equal(new Set([...loaded.hand,...loaded.deck].map(c=>c.baseFace ?? c.suit+c.rank)).size,52)
  assert.equal(loaded.keptCardId,null)
  assert.equal(loaded.trickUsed,false)
  assert.ok(restoreGame(snapshotGame(loaded)))
})

test('替嗓 sends one paid order to two different living regiments, triggering its partner effects only once', () => {
  const game = camp('voice')
  const stock = [...game.hand,...game.deck]
  const pair = ['♦7','♣7'].map(face => stock.find(card => card.suit + card.rank === face))
  const rest = stock.filter(card => !pair.includes(card))
  game.hand = [...pair,...rest.slice(0,6)]
  game.deck = rest.slice(6)
  game.jokers.push({...JOKERS.find(joker=>joker.id==='iron-banner'),triggers:0,flash:0})
  assert.equal(useTrick(game,'healer'),false)
  game.selected = pair.map(card=>card.id)
  const initial = snapshotGame(game)
  assert.equal(useTrick(game,'knight'),false)
  assert.equal(useTrick(game,'missing'),false)
  assert.deepEqual(snapshotGame(game),initial)
  game.energy = 0
  assert.equal(useTrick(game,'healer'),false)
  assert.equal(game.trickUsed,false)
  game.energy = initial.energy
  const order = previewHand(game), startingCount = game.allies.length
  assert.ok(useTrick(game,'healer'))
  assert.equal(game.stats.deploys,1)
  assert.equal(game.energy,initial.energy-order.cost)
  assert.equal(game.bellReady,true)
  assert.equal(game.trickUsed,true)
  assert.equal(game.stats.jokerTriggers,1)
  assert.equal(game.allies.length,startingCount+order.actualUnits)
  for (const member of game.allies.slice(0,startingCount)) {
    assert.equal(member.shield,member.type==='knight' ? order.bonus.shield : Math.floor(order.bonus.shield/2))
  }
  for (const [index,member] of game.allies.slice(startingCount).entries()) {
    const shield = member.type===order.target ? order.bonus.shield : member.type==='healer' ? Math.floor(order.bonus.shield/2) : 0
    assert.equal(member.shield,shield+(index===0 ? 24 : 0))
  }
  const loaded = restoreGame(snapshotGame(game))
  assert.equal(useTrick(loaded,'healer'),false)
  assert.equal(loaded.lastDeploy.squad.includes('牧师复令'),true)
})

test('活扣 waits through shielded hits, saves the marked ally exactly once and never counts the rescue as a death', () => {
  const game = camp('escape'), leader = game.allies[0]
  assert.equal(useTrick(game,leader.id),false)
  beginBattle(game)
  advance(game,1.5)
  assert.equal(useTrick(game,game.enemies[0].id),false)
  assert.ok(useTrick(game,leader.id))
  const snap = snapshotGame(game)
  const doubled = structuredClone(snap)
  doubled.allies[1].lifeline = true
  assert.equal(restoreGame(doubled),null)
  assert.equal(restoreGame({...snap,doctrine:'arcane'}),null)
  const loaded = restoreGame(snap), target = loaded.allies[0], enemy = loaded.enemies[0]
  loaded.allies = [target]
  loaded.enemies = [enemy]
  target.x = 450; target.y = enemy.y; target.hp = 3; target.cooldown = 5; target.shield = 100
  enemy.atk = 30; enemy.x = 460; enemy.cooldown = 0
  advance(loaded,1/30)
  assert.equal(target.hp,3)
  assert.equal(target.lifeline,true)
  target.shield = 0; enemy.cooldown = 0
  advance(loaded,1/30)
  assert.equal(target.hp,1)
  assert.ok(target.x <= 351)
  assert.equal(target.lifeline,undefined)
  assert.equal(loaded.stats.lost,0)
  assert.equal(loaded.reserveUsed,false)
  assert.ok(restoreGame(snapshotGame(loaded)))
  assert.equal(useTrick(loaded,target.id),false)
  enemy.x = target.x + 1; enemy.cooldown = 0
  advance(loaded,1/30)
  assert.equal(loaded.allies.length,0)
  assert.equal(loaded.stats.lost,1)
})
