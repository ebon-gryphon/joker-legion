import test from 'node:test'
import assert from 'node:assert/strict'
import * as E from './engine.js'
import {WAVES,STEP,MAX_ENEMIES} from './campaignRules.js'
import {DIFFICULTIES,BELL_INTERVAL} from './tactics.js'
import {damageUnit,settleDeaths} from './combatHealth.js'
import {resetBuildWave} from './buildPassives.js'
import {combatSummary,validCombatRecord} from './combatStats.js'
import {saveCombatHistory,loadCombatHistory,exportCombatHistory} from './combatHistory.js'

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

test('ordinary timeout settles actual live units individually at the published deadline',()=>{
  const g=practice(['raider','brute'],{life:2})
  g.waveTime=WAVES[g.wave-1].duration-STEP
  E.tick(g,STEP)
  assert.equal(g.phase,'shop');assert.equal(g.baseHp,0);assert.equal(g.lifeFailed,false)
  assert.equal(g.waveTimeout.count,2);assert.equal(g.waveTimeout.damage,2)
  assert.deepEqual(g.lifeEvents.filter(event=>event.source==='timeout' && event.kind==='loss').map(event=>[event.before,event.after]),[[2,1],[1,0]])

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

test('post-wave life rewards extend the saved timeline once while preserving frozen combat facts and RNG',()=>{
  const clone=value=>JSON.parse(JSON.stringify(value))
  const battleFacts=report=>{const facts=clone(report);for(const key of ['lifeEvents','passiveEvents','lifeEnd','lifeMaxEnd'])delete facts[key];return facts}
  for(const [id,seed] of [['repair','reward-report-4'],['gate-masonry','reward-report-15']]){
    const g=E.createGame({seed});g.jokers=[]
    const soldier=E.addUnit(g,'knight','ally',1);Object.assign(soldier,{atk:0,range:0,speed:0,cooldown:100})
    g.schedule=[];g.spawnIndex=0;E.beginBattle(g);g.waveTime=4;g.baseHp=8
    const enemy=E.addUnit(g,'raider','enemy',1);Object.assign(enemy,{x:54,y:250,speed:0,range:0,cooldown:100,atk:0})
    damageUnit(g,soldier,soldier.hp);settleDeaths(g);E.tick(g,STEP)
    assert.equal(g.phase,'shop');assert.ok(g.rewards.some(offer=>offer.id===id),'the seeded real shelf contains '+id)
    const before=combatSummary(g),frozen=clone(before),rng=g.rng,shopSnapshot=E.snapshotGame(g)
    assert.equal(before.units.find(row=>row.unitId===soldier.id).alive,false)
    assert.ok(g.allies.some(unit=>unit.id===soldier.id&&unit.hp>0),'the fallen soldier already regrouped')
    const data=new Map(),storage={getItem:key=>data.get(key) || null,setItem:(key,value)=>data.set(key,value)}
    saveCombatHistory(storage,before)
    assert.ok(E.chooseReward(g,id));const after=combatSummary(g)
    assert.notEqual(after,before);assert.deepEqual(before,frozen);assert.deepEqual(battleFacts(after),battleFacts(before))
    assert.deepEqual(after.lifeEvents,g.lifeEvents);assert.deepEqual(after.passiveEvents,g.buildPassives.events)
    assert.equal(after.lifeEnd,g.baseHp);assert.equal(after.lifeMaxEnd,g.maxBaseHp)
    const rewardEvents=after.lifeEvents.filter(event=>event.sourceId===id)
    assert.deepEqual(rewardEvents.map(event=>event.kind),id==='repair'?['heal']:['max','heal'])
    assert.equal(rewardEvents.find(event=>event.kind==='heal').amount,2)
    assert.equal(g.rng,rng)
    saveCombatHistory(storage,after)
    const history=loadCombatHistory(storage);assert.equal(history.length,1);assert.deepEqual(history[0].lifeEvents,after.lifeEvents)
    assert.deepEqual(JSON.parse(exportCombatHistory(history)).records[0].lifeEvents,after.lifeEvents)
    const loaded=E.restoreGame(JSON.stringify(E.snapshotGame(g)));assert.ok(loaded)
    assert.deepEqual(combatSummary(loaded).lifeEvents,after.lifeEvents)
    const claimed=E.snapshotGame(g);assert.equal(E.chooseReward(g,id),false);assert.deepEqual(E.snapshotGame(g),claimed);assert.equal(combatSummary(g),after)
    const legacy=clone(shopSnapshot)
    for(const key of ['lifeVersion','lifeFailed','lifeEvents','lifeItemState','buildPassives','legacyLifeHistory'])delete legacy[key]
    for(const record of [legacy.combatLedger,legacy.lastCombatReport])for(const key of ['lifeVersion','lifeStart','lifeMaxStart','lifeEnd','lifeMaxEnd','lifeEvents','passiveEvents'])delete record[key]
    legacy.baseHp=58;legacy.maxBaseHp=100
    const old=E.restoreGame(legacy);assert.ok(old)
    const oldReport=combatSummary(old),oldFacts=clone(oldReport),oldLife=old.baseHp,oldMax=old.maxBaseHp,oldRng=old.rng
    assert.ok(E.chooseReward(old,id));const updated=combatSummary(old)
    assert.notEqual(updated,oldReport);assert.deepEqual(oldReport,oldFacts)
    assert.equal(updated.lifeVersion,undefined);assert.deepEqual(updated.gate,oldFacts.gate)
    assert.equal(updated.postWaveLife.lifeStart,oldLife);assert.equal(updated.postWaveLife.lifeMaxStart,oldMax)
    assert.deepEqual(updated.postWaveLife.lifeEvents,old.lifeEvents);assert.equal(updated.postWaveLife.lifeEnd,old.baseHp)
    assert.equal(updated.postWaveLife.lifeMaxEnd,old.maxBaseHp);assert.equal(old.rng,oldRng)
    assert.ok(validCombatRecord(updated));const malformed=clone(updated);malformed.postWaveLife.lifeEnd=NaN;assert.equal(validCombatRecord(malformed),false)
    saveCombatHistory(storage,updated);assert.deepEqual(loadCombatHistory(storage)[0].postWaveLife,updated.postWaveLife)
    const oldReloaded=E.restoreGame(JSON.stringify(E.snapshotGame(old)));assert.ok(oldReloaded)
    assert.deepEqual(combatSummary(oldReloaded).postWaveLife,updated.postWaveLife)
    const oldClaimed=E.snapshotGame(old);assert.equal(E.chooseReward(old,id),false);assert.deepEqual(E.snapshotGame(old),oldClaimed)
  }
  const fused=E.createGame({seed:'passive-postwave-16'});fused.jokers=[]
  const leader=E.addUnit(fused,'knight','ally'),donor=E.addUnit(fused,'healer','ally')
  assert.ok(E.forgeUnit(fused,leader.id,donor.id,'profession'));Object.assign(leader,{range:0,speed:0,cooldown:100})
  fused.schedule=[];fused.spawnIndex=0;E.beginBattle(fused);fused.waveTime=4;fused.baseHp=8
  const enemy=E.addUnit(fused,'raider','enemy');Object.assign(enemy,{x:54,y:250,speed:0,range:0,cooldown:100});E.tick(fused,STEP)
  assert.equal(fused.phase,'shop');assert.ok(fused.rewards.some(offer=>offer.id==='fusion-code'))
  const oldSnapshot=E.snapshotGame(fused)
  for(const key of ['lifeVersion','lifeFailed','lifeEvents','lifeItemState','buildPassives','legacyLifeHistory'])delete oldSnapshot[key]
  for(const record of [oldSnapshot.combatLedger,oldSnapshot.lastCombatReport])for(const key of ['lifeVersion','lifeStart','lifeMaxStart','lifeEnd','lifeMaxEnd','lifeEvents','passiveEvents'])delete record[key]
  oldSnapshot.baseHp=58;oldSnapshot.maxBaseHp=100
  const old=E.restoreGame(oldSnapshot);assert.ok(old);const before=old.lastCombatReport,rng=old.rng
  assert.ok(E.chooseReward(old,'fusion-code'));const after=combatSummary(old)
  assert.notEqual(after,before);assert.equal(after.postWaveLife,undefined);assert.equal(old.lifeEvents.length,0);assert.equal(old.rng,rng)
  assert.deepEqual(after.passiveEvents,old.buildPassives.events);assert.ok(after.passiveEvents.some(event=>event.id==='fusion-code'&&event.effective))
  const restored=E.restoreGame(JSON.stringify(E.snapshotGame(old)));assert.ok(restored);assert.deepEqual(restored.lastCombatReport.passiveEvents,after.passiveEvents)
})
