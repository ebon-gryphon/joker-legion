import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addUnit, beginBattle, deploy, snapshotGame, restoreGame, tick, useTrick, chooseReward, nextWave } from './engine.js'
import { endWave } from './campaign.js'
import { damageUnit, healUnit, settleDeaths } from './combatHealth.js'
import { unitStep } from './combatActions.js'
import { restoreBase } from './gameState.js'
import { initializeCombatStats, combatSummary, finishCombatStats, validCombatStats, validCombatRecord, recordGateDamage } from './combatStats.js'
import { loadCombatHistory, saveCombatHistory, exportCombatHistory, combatHistoryKey, COMBAT_HISTORY_LIMIT, COMBAT_HISTORY_BYTES } from './combatHistory.js'
import { getCardDesign } from './cardCatalog.js'

function practice({doctrine='iron',enemies=['raider','raider','raider']}={}) {
  const g=createGame({seed:'personal-report',doctrine})
  addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'2'}})
  addUnit(g,'healer','ally',1,{identity:{suit:'♥',rank:'2'}})
  g.schedule=enemies.map(type=>({at:0,type}));assert.ok(beginBattle(g))
  for(const u of [...g.allies,...g.enemies]) {u.speed=0;u.cooldown=100;u.shield=0}
  for(const e of g.enemies) e.hp=e.maxHp=100
  return g
}
const row=(g,u)=>combatSummary(g).units.find(r=>r.unitId===u.id)
const system=(g,id)=>combatSummary(g).systems.find(r=>r.id===id)
function storage() {
  const values=new Map()
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
}
function completed(runId='test-run') {
  const g=practice();initializeCombatStats(g,{runId});g.waveTime=3
  damageUnit(g,g.enemies[0],100,0,g.allies[0]);settleDeaths(g)
  finishCombatStats(g,'cleared')
  return combatSummary(g)
}

test('personal damage, shield absorption, effective healing and last-hit kills use exact unit IDs without overkill or projectile duplication',()=>{
  const g=practice(), [a,b]=g.allies, enemy=g.enemies[0]
  enemy.shield=25
  assert.equal(damageUnit(g,enemy,80,.2,a),55)
  assert.equal(row(g,a).damage,55)
  assert.equal(damageUnit(g,enemy,80,.2,b),45)
  settleDeaths(g);settleDeaths(g)
  assert.deepEqual([row(g,a).kills,row(g,b).kills,g.stats.kills],[0,1,1])
  assert.equal(damageUnit(g,enemy,100,0,a),0)
  assert.equal(combatSummary(g).totals.damage,100)
  a.hp=50;a.maxHp=100;a.shield=20
  assert.equal(damageUnit(g,a,45,.2,g.enemies[0]),25)
  assert.deepEqual([row(g,a).taken,row(g,a).absorbed],[25,20])
  assert.equal(healUnit(g,a,200,.2,b),75)
  assert.equal(healUnit(g,a,200,.2,b),0)
  assert.equal(row(g,b).healed,75)
  assert.equal(row(g,a).name,getCardDesign(a).name)
})

test('pooled relic damage and unknown sources stay in system rows, including their kills',()=>{
  const g=practice(), [a,b]=g.allies
  g.jokers.push({id:'heart-engine',triggers:0,flash:0})
  g.healedCharge=60;a.hp-=20;g.enemies[0].hp=10
  healUnit(g,a,15,0,b);settleDeaths(g)
  assert.equal(row(g,b).healed,15)
  assert.equal(row(g,b).damage,0)
  assert.deepEqual([system(g,'heart-engine').damage,system(g,'heart-engine').kills],[40,1])
  damageUnit(g,g.enemies[0],100);settleDeaths(g)
  assert.equal(system(g,'unattributed').kills,1)
  assert.equal(row(g,a).kills+row(g,b).kills,0)
  assert.equal(combatSummary(g).totals.kills,g.stats.kills)
})

test('a death-triggered explosion is recorded once as its actual item source and never as a soldier attack',()=>{
  const g=practice(), dead=g.allies[0], enemy=g.enemies[0]
  g.jokers.push({id:'last-laugh',triggers:0,flash:0})
  dead.x=350;dead.y=240
  for(const foe of g.enemies) {foe.hp=20;foe.x=360;foe.y=240}
  damageUnit(g,dead,dead.hp,0,enemy);settleDeaths(g);settleDeaths(g)
  assert.equal(row(g,dead).deaths,1)
  assert.equal(row(g,dead).damage,0)
  assert.equal(system(g,'last-laugh').damage,60)
  assert.equal(system(g,'last-laugh').kills,3)
  assert.equal(combatSummary(g).totals.kills,3)
})

test('a mirror has its own contribution row, kills and shield losses without duplicating its original soldier',()=>{
  const g=practice({doctrine:'arcane'}), original=g.allies[0]
  assert.ok(useTrick(g,original.id))
  const echo=g.allies.find(u=>u.echoUntil!=null)
  damageUnit(g,g.enemies[0],100,.2,echo);settleDeaths(g)
  assert.deepEqual([row(g,echo).damage,row(g,echo).kills,row(g,original).damage,row(g,original).kills],[100,1,0,0])
  assert.equal(row(g,echo).echo,true)
  damageUnit(g,echo,echo.hp,0,g.enemies[0]);settleDeaths(g)
  assert.equal(row(g,echo).deaths,0)
  assert.equal(g.stats.lost,0)
})

test('basic attacks, splash, inherited weapons, star volleys and charged fusion skills all credit their acting soldier once',()=>{
  const g=practice(), actor=g.allies[0]
  Object.assign(actor,{x:300,y:240,jobId:'blade',fusionJobs:['blade','pike','outrider','fire'],royalStars:1,
    fusion:'warden',skillCharge:2,atk:20,attacks:2,cooldown:0,range:250})
  for(let i=0;i<g.enemies.length;i++) Object.assign(g.enemies[i],{x:330+i*20,y:240,hp:1000,maxHp:1000})
  const damage=g.stats.damage
  unitStep(g,actor,1/30)
  assert.equal(row(g,actor).damage,g.stats.damage-damage)
  assert.ok(row(g,actor).damage>100)
  assert.equal(combatSummary(g).systems.length,0)
  assert.ok(g.effects.some(e=>e.type==='projectile'))
  assert.equal(g.fusionUses.warden,1)
})

test('pre-battle orders, gross gate damage, repairs, net loss, duration and remaining energy survive wave completion',()=>{
  const g=createGame({seed:'orders-and-gate'})
  g.selected=[g.hand[0].id];assert.ok(deploy(g))
  const energy=g.energy
  g.schedule=[{at:0,type:'bellkeeper'}];assert.ok(beginBattle(g))
  g.enemies[0].bellTimer=.01;g.enemies[0].cooldown=100;g.enemies[0].speed=0
  unitStep(g,g.enemies[0],1/30)
  restoreBase(g,5)
  g.jokers.push({id:'gate-rivet',quantity:2,triggers:0,flash:0})
  g.waveTime=8.5;g.enemies=[];g.spawnIndex=g.schedule.length
  endWave(g)
  const report=combatSummary(g)
  assert.equal(report.result,'cleared');assert.equal(report.duration,8.5)
  assert.deepEqual([report.gate.start,report.gate.damage,report.gate.repaired,report.gate.end,report.gate.netLoss,report.gate.untracked],[100,11,7,96,4,0])
  assert.equal(report.orders.length,1);assert.equal(report.orders[0].phase,'ready')
  assert.equal(report.orders[0].cost,16-energy);assert.equal(report.energyLeft,energy)
  assert.equal(report.majorOrders[0].count,1)
  assert.ok(validCombatRecord(report));assert.ok(validCombatStats(snapshotGame(g)))
  const original=structuredClone(report)
  assert.ok(chooseReward(g,'repair'))
  assert.deepEqual(combatSummary(g),original)
  assert.ok(nextWave(g));assert.equal(g.combatLedger.wave,2)
  assert.notEqual(g.combatLedger.waveId,report.waveId)
})

test('historical tactics, formation, fusion skills and regiment totals are immutable snapshots with optional old-history compatibility',()=>{
  const g=practice()
  g.formation='hunt';g.tacticsReport.prevented=12;g.tacticsReport.interrupts=1
  g.fusionUses={warden:2};g.waveReport.knight.damage=55
  const report=finishCombatStats(g,'cleared')
  g.formation='guard';g.tacticsReport.prevented=99;g.fusionUses.warden=7;g.waveReport.knight.damage=200
  assert.equal(report.formation,'hunt')
  assert.equal(report.tacticsReport.prevented,12)
  assert.deepEqual(report.fusionUses,{warden:2})
  assert.equal(report.regimentReport.knight.damage,55)
  assert.ok(validCombatRecord(report))
  for(const mutate of [r=>r.formation='invalid',r=>r.tacticsReport.prevented=-1,r=>r.fusionUses.unknown=1,r=>r.regimentReport.knight.damage='55']) {
    const bad=structuredClone(report);mutate(bad);assert.equal(validCombatRecord(bad),false)
  }
  const old=structuredClone(report)
  for(const key of ['formation','tacticsReport','fusionUses','regimentReport']) delete old[key]
  assert.ok(validCombatRecord(old))
  const store=storage();saveCombatHistory(store,old)
  assert.equal(loadCombatHistory(store).length,1)
  assert.equal(loadCombatHistory(store)[0].formation,undefined)
})

test('gate summaries distinguish preparation repairs from combat damage and combat repairs even when the whole wave gains health',()=>{
  const g=createGame({seed:'prepared-gate'})
  g.baseHp=80;initializeCombatStats(g)
  addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'2'}})
  restoreBase(g,20)
  g.schedule=[{at:0,type:'bellkeeper'}];assert.ok(beginBattle(g))
  g.enemies[0].bellTimer=.01;g.enemies[0].cooldown=100;g.enemies[0].speed=0
  unitStep(g,g.enemies[0],1/30)
  restoreBase(g,3)
  g.waveTime=4;g.enemies=[];g.spawnIndex=g.schedule.length;endWave(g)
  const gate=combatSummary(g).gate
  assert.deepEqual([gate.start,gate.battleStart,gate.end],[80,100,92])
  assert.deepEqual([gate.preparationRepaired,gate.battleDamage,gate.battleRepaired],[20,11,3])
  assert.equal(gate.netLoss,-12)
  assert.equal(gate.combatNetLoss,8)
  assert.equal(gate.untracked,0)
})

test('older gate ledgers resume without fabricating unavailable preparation-versus-combat repair counters',()=>{
  const g=practice(), saved=snapshotGame(g)
  for(const key of ['preparationDamage','preparationRepaired','battleDamage','battleRepaired']) delete saved.combatLedger.gate[key]
  const restored=restoreGame(saved);assert.ok(restored)
  restored.baseHp-=10;restoreBase(restored,3)
  const report=finishCombatStats(restored,'cleared')
  assert.equal(report.gate.battleRepaired,undefined)
  assert.equal(report.gate.repaired,3)
  assert.equal(report.gate.combatNetLoss,7)
  assert.ok(validCombatRecord(report))
})

test('failure records timeout gate damage once and completing a report twice is idempotent',()=>{
  const g=practice({enemies:['boss']})
  g.baseHp=20;initializeCombatStats(g,{runId:'loss'})
  g.waveTime=37.99;tick(g,1/30)
  assert.equal(g.phase,'lost')
  const report=combatSummary(g)
  assert.equal(report.result,'lost');assert.equal(report.gate.damage,20);assert.equal(report.gate.netLoss,20)
  assert.deepEqual(finishCombatStats(g,'lost'),report)
  assert.equal(tick(g,1),false)
  assert.deepEqual(combatSummary(g),report)
  assert.deepEqual(report.runOutcome,{status:'defeat',wave:1,clearedWaves:0,terminal:true,finalWave:1})
})

test('gate damage preserves exact bell, breach and timeout sources, with old unclassified damage kept separate',()=>{
  const g=practice({enemies:['bellkeeper','raider']})
  g.enemies[0].bellTimer=.01;unitStep(g,g.enemies[0],1/30)
  g.enemies[1].x=50;unitStep(g,g.enemies[1],1/30);settleDeaths(g)
  g.waveTime=37.99;tick(g,1/30)
  assert.deepEqual(combatSummary(g).gate.sources,{bell:11,breach:6,timeout:8,unknown:0})
  assert.equal(combatSummary(g).gate.damage,25)
  const old=practice();old.baseHp-=5;recordGateDamage(old,5,'bell')
  const saved=snapshotGame(old);delete saved.combatLedger.gate.sources
  const resumed=restoreGame(saved);assert.ok(resumed)
  resumed.baseHp-=3;recordGateDamage(resumed,3,'breach')
  assert.deepEqual(combatSummary(resumed).gate.sources,{bell:0,breach:3,timeout:0,unknown:5})
})

test('final victory records the completion wave while earlier cleared waves remain nonterminal',()=>{
  const g=practice();g.enemies=[];g.spawnIndex=g.schedule.length;g.waveTime=4;endWave(g)
  assert.deepEqual(combatSummary(g).runOutcome,{status:'wave-cleared',wave:1,clearedWaves:1,terminal:false,finalWave:null})
  const final=practice();final.wave=12;final.stats.wavesCleared=11
  initializeCombatStats(final);final.enemies=[];final.spawnIndex=final.schedule.length;final.waveTime=4;endWave(final)
  assert.deepEqual(combatSummary(final).runOutcome,{status:'victory',wave:12,clearedWaves:12,terminal:true,finalWave:12})
  assert.ok(validCombatRecord(combatSummary(final)))
})

test('mid-battle resume continues exact counters, while old or corrupted measurement data restarts explicitly as partial',()=>{
  const g=practice(), a=g.allies[0]
  g.waveTime=4;damageUnit(g,g.enemies[0],20,.2,a)
  const saved=snapshotGame(g), restored=restoreGame(saved);assert.ok(restored)
  assert.equal(restored.combatLedger.partial,false)
  for(const run of [g,restored]) {damageUnit(run,run.enemies[0],90,.2,run.allies[0]);settleDeaths(run);run.waveTime=6;finishCombatStats(run,'cleared')}
  assert.deepEqual(combatSummary(restored),combatSummary(g))
  const legacy=structuredClone(saved);delete legacy.combatLedger;delete legacy.lastCombatReport
  const old=restoreGame(legacy);assert.ok(old);assert.equal(old.combatLedger.partial,true)
  assert.equal(combatSummary(old).totals.damage,0)
  damageUnit(old,old.enemies[0],10,0,old.allies[0]);old.waveTime=6
  assert.equal(combatSummary(old).totals.damage,10);assert.equal(combatSummary(old).duration,2)
  const corrupt=structuredClone(saved);corrupt.combatLedger.units[0].damage=-10
  assert.equal(validCombatStats(corrupt),false)
  const recovered=restoreGame(corrupt);assert.ok(recovered);assert.equal(recovered.combatLedger.partial,true)
  assert.equal(recovered.stats.damage,saved.stats.damage)
})

test('measurement never changes combat values, random draws, action IDs or battle effects',()=>{
  const g=practice({enemies:['brute']}), control=structuredClone(g)
  control.combatLedger.ended=true
  for(const run of [g,control]) {
    Object.assign(run.allies[0],{x:300,y:240,cooldown:0})
    Object.assign(run.allies[1],{x:280,y:240,cooldown:0})
    Object.assign(run.enemies[0],{x:330,y:240,cooldown:0})
    for(let i=0;i<60 && run.phase==='battle';i++) tick(run,1/30)
  }
  const state=game=> {const result=snapshotGame(game);delete result.combatLedger;delete result.lastCombatReport;return result}
  assert.deepEqual(state(g),state(control))
})

test('an old mid-battle save preserves total battle duration separately from the measured portion',()=>{
  const g=practice();g.waveTime=10
  const saved=snapshotGame(g);delete saved.combatLedger;delete saved.lastCombatReport
  const resumed=restoreGame(saved);assert.ok(resumed)
  resumed.waveTime=30
  const report=finishCombatStats(resumed,'cleared')
  assert.equal(report.partial,true)
  assert.equal(report.duration,20)
  assert.equal(report.battleDuration,30)
  assert.ok(validCombatRecord(report))
  const older=structuredClone(report);delete older.battleDuration
  assert.ok(validCombatRecord(older))
})

test('local history deduplicates a resumed wave, separates retries, exports valid JSON and respects a large byte-bounded history',()=>{
  const store=storage(), first=completed('first'), retry=completed('retry')
  saveCombatHistory(store,first);saveCombatHistory(store,structuredClone(first))
  assert.equal(loadCombatHistory(store).length,1)
  saveCombatHistory(store,retry);assert.equal(loadCombatHistory(store).length,2)
  const parsed=JSON.parse(exportCombatHistory(loadCombatHistory(store)))
  assert.equal(parsed.schema,'joker-legion-combat-history');assert.equal(parsed.records.length,2)
  const records=Array.from({length:COMBAT_HISTORY_LIMIT+5},(_,i)=> {
    const r=structuredClone(first);r.runId='many-'+i;r.waveId=JSON.stringify([r.runId,r.battleId,r.wave]);return r
  })
  store.setItem(combatHistoryKey,JSON.stringify(records))
  const retained=loadCombatHistory(store)
  assert.equal(retained.length,COMBAT_HISTORY_LIMIT)
  assert.equal(retained.at(-1).runId,'many-'+(COMBAT_HISTORY_LIMIT+4))
  assert.ok(new TextEncoder().encode(JSON.stringify(retained)).length<=COMBAT_HISTORY_BYTES)
  const large=Array.from({length:8},(_,i)=> {
    const r=structuredClone(first);r.runId='large-'+i;r.waveId=JSON.stringify([r.runId,r.battleId,r.wave])
    r.units=Array.from({length:300},(_,j)=>({...r.units[0],unitId:'row-'+j,name:'名'.repeat(160),jobLabel:'职'.repeat(160),qualityLabel:'品'.repeat(160)}))
    r.totals=Object.fromEntries(Object.keys(r.totals).map(key=>[key,r.units.reduce((sum,row)=>sum+row[key],0)]))
    return r
  })
  store.setItem(combatHistoryKey,JSON.stringify(large))
  const bounded=loadCombatHistory(store)
  assert.ok(bounded.length>0 && bounded.length<large.length)
  assert.equal(bounded.at(-1).runId,'large-7')
  assert.ok(new TextEncoder().encode(JSON.stringify(bounded)).length<=COMBAT_HISTORY_BYTES)
  store.setItem(combatHistoryKey,'invalid-json');assert.deepEqual(loadCombatHistory(store),[])
  assert.deepEqual(loadCombatHistory({getItem:()=>{throw Error('blocked')}}),[])
  assert.throws(()=>saveCombatHistory({getItem:()=>null,setItem:()=>{throw Error('quota')}},first),/quota/)
})
