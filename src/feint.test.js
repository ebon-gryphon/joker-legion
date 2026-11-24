import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import {claimAvailableReward} from './rewardFixtures.js'
import assert from 'node:assert/strict'
import { createGame, beginBattle, setOrderTarget, selectCard, deploy, setFeintFlag, scoutRead, FEINT, snapshotGame, restoreGame, tick, chooseReward, nextWave } from './engine.js'
import { dailySeed, dailyRecordKey, betterDailyRun } from './daily.js'

function camp() {
  const game = createGame({ seed:'trial-flag' })
  fixtureCompany(game,'knight')
  fixtureCompany(game,'mage')
  return game
}
function order(game,type) {
  setOrderTarget(game,type)
  selectCard(game,game.hand[0].id)
  return deploy(game)
}
test('the enemy reads visible stars, a raised flag and the latest public order, and commits on departure',()=>{
  const g=camp()
  const start=g.gold
  assert.equal(setFeintFlag(g,'missing'),false)
  const base=scoutRead(g).scores.healer
  assert.ok(setFeintFlag(g,'healer'))
  assert.equal(scoutRead(g).scores.healer,base+4)
  assert.ok(order(g,'healer'))
  assert.equal(scoutRead(g).scores.healer,base+7)
  const prediction=scoutRead(g).target
  assert.equal(g.gold,start)
  assert.ok(beginBattle(g)); assert.equal(g.feint.target,prediction)
  assert.equal(g.gold,start-FEINT.stake)
  assert.equal(setFeintFlag(g,null),false)
  assert.deepEqual(restoreGame(snapshotGame(g)).feint,g.feint)
})

test('marked troops draw real aggro and a counter-order prepared in camp pays once and delays normal attacks',()=>{
  const g=camp(); setFeintFlag(g,'knight');assert.ok(order(g,'healer'));g.schedule=[{at:0,type:'raider'}]; beginBattle(g);tick(g,.1)
  g.waveTime=5.2
  const enemy=g.enemies[0], bait=g.allies.find(u=>u.type===g.feint.target), other=g.allies.find(u=>u.type!==g.feint.target)
  for(const u of g.allies){u.x=600;u.y=240;u.cooldown=100;u.speed=0}
  Object.assign(enemy,{x:500,y:240,range:200,cooldown:0})
  bait.x=530;other.x=501
  const hp=bait.hp, safe=other.hp
  tick(g,1/30)
  assert.ok(bait.hp<hp);assert.equal(other.hp,safe)
  const cd=enemy.cooldown,gold=g.gold
  g.waveTime=7;tick(g,1/30)
  assert.equal(g.feint.result,'fooled');assert.equal(g.gold,gold+FEINT.payout)
  assert.ok(Math.abs(enemy.cooldown-(cd+FEINT.delay-1/30))<1e-7)
  assert.equal(order(g,other.type),false)
  assert.equal(g.gold,gold+FEINT.payout)
  const saved=restoreGame(snapshotGame(g));assert.equal(saved.feint.result,'fooled')
  saved.enemies=[];tick(saved,.1);assert.ok(claimAvailableReward(saved,'power'));nextWave(saved);assert.equal(saved.feint,null)
})

test('premature orders, matching the enemy read, expiration and a lost stake cannot pay out',()=>{
  for(const mode of ['matched','none','expired']){
    const g=camp();setFeintFlag(g,'knight')
    if(mode==='matched') assert.ok(order(g,'knight'))
    beginBattle(g);const purse=g.gold
    g.waveTime=4;tick(g,.1);assert.equal(g.feint.result,'active')
    g.waveTime=mode==='expired'?FEINT.closes:7;tick(g,.1)
    assert.equal(g.feint.result,'missed');assert.equal(g.gold,purse)
  }
  const g=camp();setFeintFlag(g,'knight');g.gold=1;beginBattle(g);assert.equal(g.feint,null);assert.equal(g.gold,1)
  const legacy=snapshotGame(g);delete legacy.feint;assert.equal(restoreGame(legacy).feint,null)
})

test('daily deals change at Shanghai midnight and records compare like-for-like results',()=>{
  assert.equal(dailySeed(new Date('2026-11-19T15:59:59Z')),'daily-2026-11-19')
  const seed=dailySeed(new Date('2026-11-19T16:00:00Z'))
  assert.equal(seed,'daily-2026-11-20')
  assert.deepEqual(createGame({seed}).hand,createGame({seed}).hand)
  assert.equal(dailyRecordKey('normal','iron','standard'),null)
  assert.notEqual(dailyRecordKey(seed,'iron','veteran'),dailyRecordKey(seed,'iron','standard'))
  const old={waves:4,gate:0,kills:40}
  assert.ok(betterDailyRun({...old,waves:5},old))
  assert.ok(betterDailyRun({...old,kills:42},old))
  assert.equal(betterDailyRun(old,old),false)
})
