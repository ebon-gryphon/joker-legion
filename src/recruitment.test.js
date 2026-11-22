import test from 'node:test'
import assert from 'node:assert/strict'
import { CARD_RANKS } from './cardCatalog.js'
import { ORDER_BOOK } from './orders.js'
import { DETACHMENTS, recruitName, revealGrade } from './recruitment.js'
import { getSpriteFrame } from './spriteAtlas.js'
import { FUSION_BY_ID } from './forge.js'
import { QUALITY_OUTFITS, outfitFrame } from './outfits.js'
import { soldierValue } from './training.js'
import { addUnit, beginBattle, createGame, deploy, designateChampion, nextWave, previewHand, recommendHand, restoreGame, snapshotGame, tick } from './engine.js'

// Use physical deck slots even for the same-face prints required by secret hands.
function deal(game, faces) {
  const stock = [...game.hand,...game.deck], held = []
  for (const face of faces) {
    let index = stock.findIndex(card => card.suit+card.rank === face)
    if (index < 0) {
      index = stock.findIndex(card => !faces.includes(card.suit+card.rank))
      const card = stock[index]
      card.baseFace ??= card.suit+card.rank
      game.cardEdits[card.baseFace] = face
      Object.assign(card,{suit:face[0],rank:face.slice(1)})
    }
    held.push(stock.splice(index,1)[0])
  }
  game.hand = [...held,...stock.splice(0,8-held.length)]
  game.deck = stock
  game.selected = held.map(card => card.id)
  return game
}
const fresh = (faces,seed = 45) => deal(createGame({seed,doctrine:'arcane'}),faces)
const house = (core,pair) => ['♥'+core,'♠'+pair,'♦'+core,'♣'+core,'♥'+pair]

test('every printed handbook example recruits precisely its contracted profession and headcount',()=>{
  for (const [key,rule] of Object.entries(ORDER_BOOK)) {
    const g = fresh(rule.example.split(' ')), p = previewHand(g), squad = DETACHMENTS[key]
    assert.equal(p.key,key)
    assert.equal(p.count,1)
    assert.deepEqual(p.recruits.map(u=>u.level),[1])
    assert.ok(deploy(g)); assert.equal(g.allies.length,p.count)
    assert.ok(g.allies.every(u=>u.jobId===squad.job && u.pattern===key && u.statBonus===p.statBonus))
    assert.deepEqual(restoreGame(snapshotGame(g)).allies,g.allies)
  }
})

test('physical ranks still distinguish thirteen identities while outfit names and portraits follow the revealed quality',()=>{
  for (const key of ['pair','three','fullHouse','flushHouse']) {
    const looks = new Set()
    for (const rank of CARD_RANKS) {
      const other = rank==='K' ? '2' : 'K'
      const faces = key==='pair' ? ['♣'+rank,'♦'+rank] : key==='three' ? ['♠'+rank,'♦'+rank,'♥'+rank] :
        key==='fullHouse' ? house(rank,other) : [rank,other,rank,rank,other].map(r=>'♣'+r)
      const g = fresh(faces), p = previewHand(g)
      assert.equal(p.variantRank,rank)
      assert.equal(previewHand(g,[...g.selected].reverse()).look.name,p.look.name)
      assert.ok(deploy(g))
      const lead = g.allies[0]; looks.add(lead.appearanceId)
      assert.equal(lead.name,recruitName(key,lead.grade)); assert.equal(lead.appearanceId,p.look.design.id)
      assert.deepEqual(getSpriteFrame(lead),outfitFrame(key,lead.grade))
      assert.ok(g.allies.every(u=>u.jobId===DETACHMENTS[key].job && u.variantRank===rank))
      assert.deepEqual(restoreGame(snapshotGame(g)).allies,g.allies)
    }
    assert.equal(looks.size,13)
  }
})

test('22233 and 222KK keep the same shield guards and rarity but have different permanent combat stats',()=>{
  const low = fresh(house('2','3')), high = fresh(house('2','K'))
  const a = previewHand(low), b = previewHand(high)
  assert.deepEqual([a.score.total,b.score.total],[208,264])
  assert.deepEqual([a.statBonus,b.statBonus],[12,32]); assert.equal(a.grade,b.grade)
  assert.equal(a.look.name,'蓝翎盾卫');assert.deepEqual(a.look,b.look)
  assert.ok(deploy(low)); assert.ok(deploy(high))
  for (const [i,u] of high.allies.entries()) {
    const v = low.allies[i]
    assert.equal(u.appearanceId,v.appearanceId); assert.equal(u.grade,v.grade)
    assert.equal(u.level,v.level);assert.ok(u.maxHp>v.maxHp && u.atk>v.atk)
    assert.ok(soldierValue(u)>soldierValue(v))
  }
  assert.deepEqual(restoreGame(snapshotGame(high)).allies,high.allies)
})

test('natural face ranks distinguish J, Q, K and A even at the same poker score, and ignore kickers',()=>{
  const hands = ['J','Q','K','A'].map(rank=>previewHand(fresh(house('2',rank))))
  assert.deepEqual(hands.map(p=>p.statBonus),[28,30,32,34])
  assert.deepEqual(hands.map(p=>p.score.total),[264,264,264,272])
  const pair = fresh(['♠2','♣2','♦K'])
  assert.equal(previewHand(pair).statBonus,4)
  assert.equal(previewHand(pair).look.name,'灰布牧师')
})

test('leader reveals use the published exclusive probabilities and only an accepted order advances the draw',()=>{
  const distribution = floor => {
    const buckets = [0,0,0,0,0]
    for(let roll=0;roll<100;roll++) buckets[revealGrade(floor,roll+.5)]++
    return buckets
  }
  assert.deepEqual([0,1,2,3,4].map(distribution),[[91,0,8,0,1],[0,83,15,0,2],[0,0,78,18,4],[0,0,0,88,12],[0,0,0,0,100]])
  const g = fresh(['♠2','♥2'],104), initial=snapshotGame(g)
  recommendHand(g);previewHand(g,[g.hand[0].id]);assert.deepEqual(snapshotGame(g),initial)
  const copy=restoreGame(initial);copy.energy=0
  assert.equal(deploy(copy),false);copy.energy=g.energy
  assert.ok(deploy(copy));assert.ok(deploy(g));assert.deepEqual(copy.allies,g.allies)
  const [priest]=g.allies
  assert.deepEqual(g.allies.map(u=>u.grade),[4]);assert.equal(priest.legendGuard,true)
  const patient=addUnit(g,'knight','ally')
  assert.equal(patient.legendGuard,undefined)
  assert.ok(beginBattle(g));patient.hp-=20
  priest.cooldown=0;Object.assign(patient,{x:priest.x+8,y:priest.y})
  const before=patient.shield;tick(g,.1)
  assert.equal(priest.legendGuard,undefined)
  assert.equal(patient.shield,before+Math.ceil(priest.maxHp*.12))
  assert.ok(restoreGame(snapshotGame(g)))
})

test('a retained mainstay keeps its outfit while a new pair recruits its own priest',()=>{
  const g=fresh(['♠2','♥2']);deploy(g)
  const lead=g.allies[0];lead.trainingXp=6;designateChampion(g,lead.id)
  g.phase='shop';g.rewardChosen='power';assert.ok(nextWave(g))
  deal(g,['♣3','♦3','♠2'])
  assert.ok(!previewHand(g,[g.selected[2]]).recruits.some(u=>u.pattern==='pair'))
  assert.equal(previewHand(g).variantRank,'3');assert.ok(deploy(g))
  assert.equal(g.allies[0].standard,true);assert.equal(g.allies[0].name,lead.name);assert.equal(g.allies[1].name,recruitName('pair',g.allies[1].grade))
  assert.ok(g.allies[0].trainingXp>=6)
})

test('all thirteen pairs wear the same body at a given grade and every profession has seven visibly distinct frames',()=>{
  for (const pattern of Object.keys(DETACHMENTS)) {
    const frames = new Set()
    for (const [grade] of QUALITY_OUTFITS.entries()) {
      const expected=outfitFrame(pattern,grade)
      for (const rank of CARD_RANKS) {
        assert.deepEqual(getSpriteFrame({pattern,variantRank:rank,grade}),expected)
      }
      assert.deepEqual(getSpriteFrame(expected),expected)
      frames.add(expected.frame)
    }
    assert.equal(frames.size,7)
  }
  assert.notEqual(outfitFrame('pair',2).frame,outfitFrame('fullHouse',2).frame)
  assert.equal(outfitFrame('pair',2).column,outfitFrame('fullHouse',2).column)
})

test('original physical identities, learned stats and fusion art survive the change of clothes',()=>{
  const g = fresh(house('2','K'));deploy(g)
  const saved = snapshotGame(g);saved.allies.forEach(u=>{u.name='圆盾哨卫'})
  saved.lastDeploy.variantName='圆盾哨卫'
  const loaded = restoreGame(saved)
  assert.equal(loaded.lastDeploy.variantName,'金冕盾卫')
  assert.deepEqual(loaded.allies,g.allies)
  const guard=loaded.allies[0]
  assert.equal(guard.appearanceId,'spades-2');assert.deepEqual(getSpriteFrame(guard),outfitFrame('fullHouse',guard.grade))
  assert.equal(getSpriteFrame({appearanceId:'spades-2'}).atlas,'spades')
  const fusion=Object.keys(FUSION_BY_ID)[0]
  assert.deepEqual(getSpriteFrame({...guard,fusion}),outfitFrame(fusion,guard.grade))
})

test('a seven-point high card can recruit a legendary one-star soldier on its first order',()=>{
  const g=fresh(['♠2'],104), p=previewHand(g)
  assert.equal(p.score.total,7);assert.equal(p.grade,0)
  assert.ok(deploy(g))
  assert.deepEqual(g.allies.map(u=>[u.jobId,u.level,u.grade]),[['blade',1,4]])
  assert.equal(g.allies[0].legendGuard,true)
  assert.equal(g.allies[0].name,'金冕刀兵')
  assert.equal(g.lastDeploy.variantName,g.allies[0].name)
  assert.deepEqual(getSpriteFrame(g.allies[0]),outfitFrame('high',4))
})
