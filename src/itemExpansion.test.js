import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addUnit, previewHand, deploy, beginBattle, buyExtraHand, extraHandPrice,
  discard, redrawPrice, chooseReward, nextWave, snapshotGame, restoreGame, buyJoker } from './engine.js'
import { JOKERS, JOKER_BY_ID } from './campaignRules.js'
import { DETACHMENTS } from './recruitment.js'
import { copies } from './gameState.js'
import { endWave } from './campaign.js'
import { damageUnit, healUnit, settleDeaths } from './combatHealth.js'
import { trainingBonus } from './training.js'

const own = (g,id,quantity=1) => g.jokers.push({...JOKER_BY_ID[id],quantity,triggers:0,flash:0})
function soldier(g,pattern='high') {
  const face=DETACHMENTS[pattern].members[0]
  return addUnit(g,face.type,'ally',1,{identity:{...face,pattern,grade:0,source:'card'}})
}
function deal(g,faces) {
  const stock=[...g.hand,...g.deck], cards=faces.map(face=>stock.find(c=>c.suit+c.rank===face))
  const rest=stock.filter(c=>!cards.includes(c))
  g.hand=[...cards,...rest.slice(0,8-cards.length)]; g.deck=rest.slice(8-cards.length);g.selected=cards.map(c=>c.id)
}

test('expanded inventory contains 34 buyable items, with working saved stacks and sold slots',()=>{
  assert.equal(JOKERS.length,34)
  assert.equal(new Set(JOKERS.map(i=>i.id)).size,34)
  const g=createGame();g.phase='shop';g.rewardChosen='repair';g.gold=100
  g.shop=['black-wax','ward-flask','oath-standard']
  for(const id of g.shop) assert.ok(buyJoker(g,id))
  const copy=restoreGame(snapshotGame(g)); assert.ok(copy)
  assert.deepEqual(copy.soldShop,g.shop)
  assert.ok(copy.jokers.some(i=>i.id==='oath-standard'))
})

test('black, court and straight score items affect actual scoring cards and the accepted order',()=>{
  const g=createGame();deal(g,['♠10','♣J','♦Q','♥K','♠A'])
  const baseline=previewHand(g)
  own(g,'black-wax',2);own(g,'court-seal',2);own(g,'straight-compass',2)
  const planned=previewHand(g), chips=3*2+3*2*2+2*4
  assert.equal(planned.extraChips,chips)
  assert.equal(planned.score.total,(baseline.score.chips+chips)*baseline.score.mult)
  assert.ok(deploy(g));assert.equal(g.lastDeploy.score,planned.score.total)
})

test('consumables remain on invalid actions and spend once on the successful operation',()=>{
  const g=createGame();own(g,'silver-pass',2);own(g,'redraw-voucher',2);own(g,'blade-oil',2)
  g.gold=1;assert.equal(extraHandPrice(g),2);assert.equal(buyExtraHand(g),false)
  assert.equal(copies(g,'silver-pass'),2)
  g.gold=30;assert.ok(buyExtraHand(g));assert.equal(copies(g,'silver-pass'),1);assert.equal(extraHandPrice(g),6)
  g.discards=0;assert.equal(redrawPrice(g),0);assert.equal(discard(g),false);assert.equal(copies(g,'redraw-voucher'),2)
  g.selected=[g.hand[0].id];assert.ok(discard(g));assert.equal(copies(g,'redraw-voucher'),1);assert.equal(g.discards,0)
  assert.equal(deploy(g),false);assert.equal(copies(g,'blade-oil'),2)
  const control=restoreGame(snapshotGame(g));assert.ok(control)
  control.jokers=control.jokers.filter(i=>i.id!=='blade-oil')
  g.selected=[g.hand[0].id];control.selected=[control.hand[0].id]
  assert.ok(deploy(g));assert.ok(deploy(control));assert.equal(copies(g,'blade-oil'),1)
  assert.equal(g.allies[0].atk,control.allies[0].atk+3)
  assert.equal(g.allies[0].heal,control.allies[0].heal+3)
})

test('opening items apply actual shields and tempo once, and temporary boosts expire on regroup',()=>{
  const g=createGame(), unit=soldier(g);unit.fusionJobs=['blade','priest']
  for(const id of ['war-drum','ward-flask','oath-standard','midnight-lantern','supply-satchel']) own(g,id,1)
  const basePeriod=unit.period
  assert.ok(beginBattle(g));assert.equal(unit.shield,18+Math.ceil(unit.maxHp*.08))
  assert.ok(unit.period<basePeriod);assert.ok(g.enemies.every(e=>e.cooldown>=.8))
  assert.equal(copies(g,'ward-flask'),0);assert.equal(beginBattle(g),false)
  endWave(g);assert.equal(g.allies[0].period,basePeriod)
  assert.ok(chooseReward(g,'power'));assert.ok(nextWave(g));assert.equal(g.discards,4)
  assert.ok(restoreGame(snapshotGame(g)))
})

test('new combat items change healing, both boss damage and mitigation without affecting normal enemies',()=>{
  const g=createGame(), ally=soldier(g)
  own(g,'healer-brooch',2);own(g,'boss-hunter',2);own(g,'iron-rivets',2)
  ally.hp=ally.maxHp-50;assert.equal(healUnit(g,ally,25),26)
  ally.shield=0;const hp=ally.hp;assert.equal(damageUnit(g,ally,10),8);assert.equal(ally.hp,hp-8)
  assert.equal(damageUnit(g,ally,1),.7)
  for(const type of ['boss','finalBoss','raider']) {
    const enemy=addUnit(g,type,'enemy');enemy.hp=enemy.maxHp=1000
    assert.equal(damageUnit(g,enemy,100),type==='raider'?100:106)
  }
})

test('fallen ally rally is applied once per real casualty and expires after the wave',()=>{
  const g=createGame(), lead=soldier(g), donor=soldier(g,'pair');own(g,'revenge-flag')
  const base=lead.atk;beginBattle(g);donor.hp=0;settleDeaths(g)
  assert.equal(lead.atk,base+2);settleDeaths(g);assert.equal(lead.atk,base+2)
  endWave(g);assert.equal(g.allies.find(u=>u.id===lead.id).atk,base+trainingBonus(1,1).atk)
})
