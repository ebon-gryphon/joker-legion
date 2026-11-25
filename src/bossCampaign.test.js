import {claimTestReward, setTestRewardShelf, claimAvailableReward} from './rewardFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addUnit, beginBattle, tick, WAVES, waveSchedule, chooseReward, nextWave, snapshotGame, restoreGame } from './engine.js'
import { bossStep, breachDamage } from './combatActions.js'
import { HOSTILE, scoutWave } from './tactics.js'
import { BOSS_SKILLS } from './bossRules.js'
import { validDailyRecord } from './daily.js'
import {resetBuildWave} from './buildPassives.js'

function royalBattle(wave = 12, formation = 'guard') {
  const g = createGame({seed:'two-royals'})
  g.wave = wave
  resetBuildWave(g)
  g.formation = formation
  addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'2'}})
  addUnit(g,'healer','ally',1,{identity:{suit:'♥',rank:'2'}})
  g.schedule = [{at:0,type:wave===12?'finalBoss':'boss'}]
  assert.ok(beginBattle(g))
  for (let i=0;i<g.allies.length;i++) Object.assign(g.allies[i],{x:300-i*160,y:220+i*70,hp:4000,maxHp:4000,atk:30+i*20,cooldown:100,speed:0,shield:0})
  Object.assign(g.enemies[0],{x:800,y:260,cooldown:100,speed:0})
  return g
}

test('twelve deterministic waves place separate, stronger bosses at six and twelve with escalating late forces',()=>{
  assert.equal(WAVES.length,12)
  assert.deepEqual(WAVES.filter(w=>w.boss).map(w=>w.id),[6,12])
  assert.ok(HOSTILE.boss.hp>5050 && HOSTILE.boss.atk>54)
  assert.ok(HOSTILE.finalBoss.hp>HOSTILE.boss.hp && HOSTILE.finalBoss.atk>HOSTILE.boss.atk)
  for (const difficulty of ['standard','veteran']) for(let w=1;w<=12;w++) {
    const schedule=waveSchedule('campaign',w,difficulty)
    assert.deepEqual(schedule,waveSchedule('campaign',w,difficulty))
    assert.ok(schedule.length>0 && schedule.length<=40)
    assert.equal(scoutWave(schedule).bossAt,[6,12].includes(w)?0:null)
    if(w>=7 && w<=11) assert.ok(schedule.length>waveSchedule('campaign',w-1,difficulty).length)
  }
  assert.ok(waveSchedule('campaign',12).some(s=>s.type==='finalBoss'))
  assert.equal(breachDamage('finalBoss',77),77)
})

test('clearing the midpoint opens supplies and wave seven; only wave twelve ends the expedition',()=>{
  for(const wave of [6,12]) {
    const g=royalBattle(wave)
    g.enemies=[];g.spawnIndex=g.schedule.length;g.waveTime=4
    tick(g,1/30)
    assert.equal(g.stats.wavesCleared,wave)
    assert.equal(g.phase,wave===12?'won':'shop')
    assert.ok(restoreGame(snapshotGame(g)))
    assert.equal(nextWave(g),false)
    if(wave===12){assert.deepEqual(g.rewards,[]);assert.deepEqual(g.shop,[]);continue}
    assert.ok(claimAvailableReward(g,'power'))
    assert.ok(nextWave(g));assert.equal(g.wave,wave===6?7:12)
    assert.equal(g.phase,wave===6?'ready':'won')
    assert.ok(restoreGame(snapshotGame(g)))
  }
})

test('the king warns front and rear attacks before damage, and spread formation mitigates their area hits',()=>{
  for(const enraged of [false,true]) for(const formation of ['guard','spread']) {
    const g=royalBattle(6,formation), boss=g.enemies[0]
    if(enraged) boss.hp=boss.maxHp/2
    g.bossTimer=0;bossStep(g,1/30)
    const expected=enraged?BOSS_SKILLS.rupture:BOSS_SKILLS.scarlet
    assert.equal(g.bossTelegraph.name,expected.name)
    const target=enraged?g.allies[1]:g.allies[0], hp=target.hp
    assert.equal(g.bossTelegraph.x,target.x)
    assert.equal(target.hp,hp)
    bossStep(g,expected.duration-.1);assert.equal(target.hp,hp)
    bossStep(g,.11)
    assert.equal(g.bossTelegraph,null)
    assert.ok(Math.abs(hp-target.hp-expected.damage*(formation==='spread'?.6:1))<1e-6)
    if(enraged) assert.equal(target.cooldown,101.2)
  }
})

test('the final boss alternates a marked strike and a shield-countered, interruptible global shockwave',()=>{
  const g=royalBattle(), boss=g.enemies[0]
  g.bossTimer=0;bossStep(g,.01)
  assert.equal(g.bossTelegraph.name,'断线裁决')
  assert.equal(g.bossTelegraph.x,g.allies[1].x)
  const hp=g.allies.map(u=>u.hp)
  bossStep(g,3.21)
  assert.equal(g.allies[0].hp,hp[0]);assert.equal(hp[1]-g.allies[1].hp,175)
  g.bossTimer=0;bossStep(g,.01)
  assert.equal(g.bossTelegraph.name,'王庭震荡')
  const before=g.allies.map(u=>u.hp)
  g.allies[0].shield=10
  bossStep(g,4.01)
  assert.equal(before[0]-g.allies[0].hp,65)
  assert.equal(before[1]-g.allies[1].hp,150)
  // A later shockwave uses actual damage dealt since its own warning, not total fight damage.
  boss.bossCasts=3;g.bossTimer=0;bossStep(g,.01)
  boss.hp-=boss.maxHp*.08
  const undamaged=g.allies.map(u=>u.hp)
  bossStep(g,.01)
  assert.equal(g.bossTelegraph,null)
  assert.deepEqual(g.allies.map(u=>u.hp),undamaged)
  assert.ok(g.logs.some(l=>l.text.includes('王庭震荡被打断')))
})

test('twelve-wave and in-flight royal warnings roundtrip while old six-wave victories remain victories',()=>{
  const g=royalBattle()
  g.enemies[0].bossCasts=1;g.bossTimer=0;bossStep(g,.01)
  const copy=restoreGame(snapshotGame(g))
  assert.ok(copy);assert.equal(copy.wave,12)
  assert.deepEqual(copy.bossTelegraph,g.bossTelegraph)
  bossStep(g,4.01);bossStep(copy,4.01)
  assert.deepEqual(snapshotGame(copy),snapshotGame(g))
  const legacy=snapshotGame(royalBattle(6))
  delete legacy.campaignLength
  legacy.enemies=[];legacy.spawnIndex=legacy.schedule.length;legacy.waveTime=56
  legacy.phase='won';legacy.stats.wavesCleared=6;legacy.bossTelegraph=null
  const won=restoreGame(legacy)
  assert.ok(won);assert.equal(won.phase,'won');assert.equal(won.campaignLength,6)
  assert.equal(nextWave(won),false)
  const active=structuredClone(legacy)
  active.phase='battle';active.stats.wavesCleared=5
  const continued=restoreGame(active)
  assert.ok(continued);assert.equal(continued.campaignLength,12)
  tick(continued,1/30);assert.equal(continued.phase,'shop')
  assert.ok(claimTestReward(continued,'power'));assert.ok(nextWave(continued));assert.equal(continued.wave,7)
  for(const mutate of [s=>s.wave=13,s=>s.bossTelegraph.remaining=-1,s=>s.bossTelegraph.mode='unknown',s=>s.enemies[0].bossCasts=-1]) {
    const bad=snapshotGame(copy)
    // Ensure the invalid-warning cases start with a real, active warning.
    bad.bossTelegraph={...BOSS_SKILLS.court,x:300,y:240,remaining:3,startHp:12000}
    mutate(bad);assert.equal(restoreGame(bad),null)
  }
  assert.ok(validDailyRecord({waves:12,gate:50,kills:200}))
  assert.equal(validDailyRecord({waves:13,gate:50,kills:200}),false)
})
