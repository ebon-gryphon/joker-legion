import test from 'node:test'
import assert from 'node:assert/strict'
import * as E from './engine.js'
import {WAVES,STEP,MAX_ENEMIES} from './campaignRules.js'
import {DIFFICULTIES,BELL_INTERVAL} from './tactics.js'
import {damageUnit,settleDeaths} from './combatHealth.js'
import {resetBuildWave} from './buildPassives.js'

function practice(types,{life=12,wave=1}={}) {
  const g=E.createGame({seed:'LIFE-COMBAT'});g.wave=wave
  resetBuildWave(g)
  g.lifeVersion=1;g.lifeFailed=false;g.lifeEvents=[];g.lifeItemState={redEchoUsed:false,flushCrownUsed:false}
  const ally=E.addUnit(g,'knight','ally',1);Object.assign(ally,{x:400,y:250,range:0,speed:0,cooldown:100,atk:0})
  g.schedule=[];g.spawnIndex=0;E.beginBattle(g);g.waveTime=4;g.baseHp=life
  for(const type of types) {
    const unit=E.addUnit(g,type,'enemy',1);Object.assign(unit,{x:900,y:250,range:0,speed:0,cooldown:100,atk:0})
  }
  return g
}
function ring() {
  const g=practice(['bellkeeper']);g.enemies[0].bellTimer=.01
  E.tick(g,STEP)
  return {g,bell:g.enemies.find(unit=>unit.type==='bellkeeper'),summoned:g.enemies.find(unit=>unit.summonedBy==='bellkeeper')}
}

test('difficulty starts use life values and every ordinary type loses exactly one on a real breach',()=>{
  assert.equal(DIFFICULTIES.standard.lifeMax,12);assert.equal(DIFFICULTIES.veteran.lifeMax,8)
  for(const [difficulty,value] of [['standard',12],['veteran',8]])assert.equal(E.createGame({difficulty}).baseHp,value)
  for(const type of ['raider','bat','archer','brute','warlock','bellkeeper']) {
    const g=practice([type]);g.enemies[0].x=54;E.tick(g,STEP)
    assert.equal(g.baseHp,11,type);assert.equal(g.lifeFailed,false,type)
    const event=g.lifeEvents.find(event=>event.kind==='loss')
    assert.deepEqual([event.unitType,event.amount,event.before,event.after],[type,1,12,11])
  }
})

test('one remaining life may reach zero and clear into shop; a later real escape fails without negative life',()=>{
  const g=practice(['raider'],{life:1});g.enemies[0].x=54;E.tick(g,STEP)
  assert.equal(g.phase,'shop');assert.equal(g.baseHp,0);assert.equal(g.lifeFailed,false)
  const zero=E.restoreGame(E.snapshotGame(g));assert.ok(zero,'zero-life safe shop must restore')
  assert.ok(E.chooseReward(zero,zero.rewards.find(row=>row.effect.kind==='currency')?.id || zero.rewards[0].id))
  assert.ok(E.nextWave(zero));assert.equal(zero.phase,'ready')
  // Keep the next battle's ordinary breach isolated from the fresh wave schedule.
  zero.baseHp=0;zero.schedule=[];zero.spawnIndex=0;E.beginBattle(zero)
  const enemy=E.addUnit(zero,'raider','enemy',1);Object.assign(enemy,{x:54,y:250,speed:0,range:0,cooldown:100})
  E.tick(zero,STEP);assert.equal(zero.phase,'lost');assert.equal(zero.lifeFailed,true);assert.equal(zero.baseHp,0)
})

test('ordinary timeout settles actual live units individually and withdraws unspawned entries',()=>{
  const g=practice(['raider','brute'],{life:2})
  g.schedule=[{at:999,type:'warlock'}];g.spawnIndex=0;g.waveTime=WAVES[g.wave-1].duration-STEP
  E.tick(g,STEP)
  assert.equal(g.phase,'shop');assert.equal(g.baseHp,0);assert.equal(g.lifeFailed,false)
  assert.equal(g.waveTimeout.count,2);assert.equal(g.waveTimeout.damage,2);assert.equal(g.waveTimeout.queuedWithdrawn,1)
  assert.deepEqual(g.lifeEvents.filter(event=>event.source==='timeout' && event.kind==='loss').map(event=>[event.before,event.after]),[[2,1],[1,0]])
  const onlyQueued=practice([],{life:1});onlyQueued.schedule=[{at:999,type:'brute'}];onlyQueued.waveTime=WAVES[0].duration-STEP
  E.tick(onlyQueued,STEP);assert.equal(onlyQueued.phase,'shop');assert.equal(onlyQueued.baseHp,1)
  assert.equal(onlyQueued.lifeEvents.some(event=>event.kind==='loss'),false)
})

test('zero-life timeout and both boss defeat paths use explicit failure rather than life <= zero',()=>{
  const g=practice(['raider'],{life:0});g.waveTime=WAVES[0].duration-STEP;E.tick(g,STEP)
  assert.equal(g.phase,'lost');assert.equal(g.lifeFailed,true);assert.equal(g.waveTimeout.damage,0)
  for(const type of ['boss','finalBoss'])for(const timeout of [false,true]) {
    const run=practice([type],{life:12,wave:type==='boss'?6:12})
    if(timeout)run.waveTime=WAVES[run.wave-1].duration-STEP
    else run.enemies[0].x=54
    E.tick(run,STEP)
    assert.equal(run.phase,'lost');assert.equal(run.lifeFailed,true);assert.equal(run.baseHp,0)
    assert.ok(run.lifeEvents.some(event=>event.kind==='failure' && event.source===(timeout?'boss-timeout':'boss-breach')))
  }
})

test('a zero-damage fatal timeout remains a valid saved defeat',()=>{
  const g=practice(['raider'],{life:0});g.waveTime=WAVES[0].duration-STEP;E.tick(g,STEP)
  const restored=E.restoreGame(E.snapshotGame(g));assert.ok(restored)
  assert.equal(restored.phase,'lost');assert.equal(restored.baseHp,0);assert.equal(restored.lifeFailed,true)
})

test('ringing creates a real right-side raider without life damage and a real kill is credited once',()=>{
  const {g,bell,summoned}=ring()
  assert.ok(summoned);assert.equal(g.baseHp,12);assert.equal(g.enemies.length,2);assert.equal(g.tacticsReport.tolls,1)
  assert.equal(summoned.type,'raider');assert.ok(summoned.x>=990 && summoned.x<=1000);assert.equal(summoned.bellSourceId,bell.id)
  assert.equal(g.waveSpawned,1);assert.equal(g.lifeEvents.filter(event=>event.kind==='bell-summon').length,1)
  damageUnit(g,summoned,summoned.hp,0,g.allies[0]);settleDeaths(g);settleDeaths(g)
  assert.equal(g.waveKills,1);assert.equal(g.lifeEvents.filter(event=>event.kind==='bell-kill').length,1)
  assert.equal(g.baseHp,12)
})

test('a summoned raider can really breach or time out and is never falsely counted as a kill',()=>{
  const first=ring();first.summoned.x=54;first.summoned.speed=0;first.summoned.range=0;first.summoned.cooldown=100
  E.tick(first.g,STEP)
  assert.equal(first.g.baseHp,11);assert.equal(first.g.waveKills,0)
  assert.equal(first.g.lifeEvents.filter(event=>event.kind==='bell-breach').length,1)
  const second=ring();second.summoned.speed=0;second.summoned.range=0;second.summoned.cooldown=100
  second.g.waveTime=WAVES[0].duration-STEP;E.tick(second.g,STEP)
  assert.equal(second.g.baseHp,10);assert.equal(second.g.waveKills,0)
  assert.equal(second.g.lifeEvents.filter(event=>event.kind==='bell-timeout').length,1)
  assert.equal(second.g.waveTimeout.count,2)
})

test('the first prepared bell interrupt remains real and a full enemy field cannot fabricate an extra summon',()=>{
  const g=practice(['bellkeeper']);g.bellReady=true;g.enemies[0].bellTimer=1.5
  E.tick(g,STEP);assert.equal(g.tacticsReport.interrupts,1);assert.equal(g.bellReady,false)
  assert.equal(g.enemies.length,1);assert.ok(Math.abs(g.enemies[0].bellTimer-(BELL_INTERVAL-STEP))<1e-8)
  const crowded=practice(['bellkeeper',...Array.from({length:MAX_ENEMIES-1},()=> 'raider')])
  crowded.enemies[0].bellTimer=.01;const rng=crowded.rng;E.tick(crowded,STEP)
  assert.equal(crowded.enemies.length,MAX_ENEMIES);assert.equal(crowded.rng,rng)
  assert.equal(crowded.lifeEvents.filter(event=>event.kind==='bell-summon').length,0)
  assert.equal(crowded.lifeEvents.filter(event=>event.kind==='bell-blocked').length,1)
  assert.equal(crowded.baseHp,12)
})
