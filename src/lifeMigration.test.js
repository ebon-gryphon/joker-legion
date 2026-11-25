import test from 'node:test'
import assert from 'node:assert/strict'
import * as E from './engine.js'
import {endWave} from './campaign.js'
import {createRewardOffer} from './waveRewards.js'
import {resetBuildWave,acquireBuildPassive} from './buildPassives.js'

function oldState({difficulty='standard',hp=100,max=difficulty==='veteran'?75:100,phase='ready',wave=1}={}){
  const g=E.createGame({seed:'life-migration',difficulty});g.wave=wave;resetBuildWave(g)
  E.addUnit(g,'knight','ally',1)
  if(phase!=='ready'){E.beginBattle(g);if(phase==='shop')endWave(g)}
  const s=E.snapshotGame(g);s.phase=phase;s.baseHp=hp;s.maxBaseHp=max
  for(const key of ['lifeVersion','lifeFailed','lifeEvents','lifeItemState','buildPassives','legacyLifeHistory'])delete s[key]
  for(const record of [s.combatLedger,s.lastCombatReport])if(record){for(const key of ['lifeVersion','lifeStart','lifeEnd','lifeMaxStart','lifeMaxEnd','lifeEvents','passiveEvents'])delete record[key]}
  if(phase==='shop'){
    s.rewards=['gold-purse','order-notes','item-cache'].map(id=>createRewardOffer(g,id));s.rewardChosen=false;s.rewardState={wave,claimedId:null}
  }
  return s
}
test('old life retains proportional damage, never maps a damaged run to full, and active runs keep at least one',()=>{
  for(const [hp,expected] of [[100,12],[99,11],[50,6],[15,2],[1,1],[0,1]]){
    const s=oldState({hp}),r=E.restoreGame(s);assert.ok(r);assert.equal(r.baseHp,expected);assert.equal(r.maxBaseHp,12)
    assert.equal(r.gold,s.gold);assert.equal(r.crystals,s.crystals);assert.equal(r.allies[0].id,s.allies[0].id)
    assert.equal(E.restoreGame(E.snapshotGame(r)).baseHp,expected)
  }
  const lost=E.restoreGame(oldState({phase:'lost',hp:0}));assert.ok(lost);assert.equal(lost.baseHp,0);assert.equal(lost.lifeFailed,true)
})
test('veteran life and old maximum rewards use their own eight-life base and sixteen-life cap',()=>{
  for(const [hp,max,life,newMax] of [[75,75,8,8],[37,75,4,8],[47,95,6,12],[100,195,9,16]]){
    const r=E.restoreGame(oldState({difficulty:'veteran',hp,max}));assert.ok(r)
    assert.deepEqual([r.baseHp,r.maxBaseHp],[life,newMax])
  }
})
test('ready, battle and both shop claim states retain their existing book/item targets without rerolling',()=>{
  for(const phase of ['ready','battle','shop'])for(const claimed of [false,true]){
    const s=oldState({phase,hp:50})
    if(phase==='shop' && claimed){s.rewardChosen=s.rewards[0].id;s.rewardState.claimedId=s.rewardChosen}
    const r=E.restoreGame(s);assert.ok(r,phase);assert.equal(r.rng,s.rng);assert.equal(r.phase,phase)
    if(phase==='shop'){
      assert.deepEqual(r.rewards.map(row=>row.id),s.rewards.map(row=>row.id));assert.deepEqual(r.rewards.map(row=>row.payload),s.rewards.map(row=>row.payload))
      assert.equal(r.rewardChosen,s.rewardChosen)
      if(claimed){const before=E.snapshotGame(r);assert.equal(E.chooseReward(r,r.rewardChosen),false);assert.deepEqual(E.snapshotGame(r),before)}
    }
    assert.ok(E.restoreGame(E.snapshotGame(r)))
  }
})
test('life reward offers migrate to two-life facts while a newly capped offer gets a deterministic resource fallback',()=>{
  const s=oldState({phase:'shop',hp:150,max:170})
  s.rewards[0]={id:'gate-masonry',payload:{amount:10,repair:10,cap:200}}
  const r=E.restoreGame(s);assert.ok(r);assert.equal(r.maxBaseHp,24);assert.equal(r.rng,s.rng)
  assert.equal(r.rewards.length,3);assert.equal(new Set(r.rewards.map(row=>row.id)).size,3);assert.ok(!r.rewards.some(row=>row.id==='gate-masonry'))
  const repair=oldState({phase:'shop',hp:50});repair.rewards[0]={id:'repair',payload:{amount:20}}
  const healed=E.restoreGame(repair);assert.ok(healed);assert.equal(healed.rewards[0].payload.amount,2)
  const before=healed.baseHp;assert.ok(E.chooseReward(healed,'repair'));assert.equal(healed.baseHp,before+2)
  assert.equal(healed.lifeEvents.at(-1).sourceId,'repair')
})
test('old direct bell damage becomes historical data and never debits the new life ledger again',()=>{
  const s=oldState({phase:'battle',hp:81});s.tacticsReport.tolls=1;s.tacticsReport.gateDamage=19
  s.combatLedger.gate={...s.combatLedger.gate,start:100,end:81,battleStart:100,damage:19,repaired:0,sources:{bell:19,breach:0,timeout:0,unknown:0}}
  const r=E.restoreGame(s);assert.ok(r);assert.equal(r.baseHp,10);assert.deepEqual(r.lifeEvents,[])
  assert.equal(r.legacyLifeHistory.gate.damage,19);assert.equal(r.legacyLifeHistory.tactics.gateDamage,19)
  assert.equal(r.combatLedger.gate.damage,0);assert.equal(r.tacticsReport.gateDamage,0)
  E.tick(r,1/30);assert.equal(r.baseHp,10)
})
test('new zero-life runs and saved passive counters are never treated as legacy or refreshed on reload',()=>{
  const g=E.createGame();g.baseHp=0;assert.ok(acquireBuildPassive(g,'light-march'))
  g.buildPassives.wave.previousHand='pair';g.buildPassives.wave.counters.lightMarchUses=1
  const r=E.restoreGame(E.snapshotGame(g));assert.ok(r);assert.equal(r.baseHp,0)
  assert.deepEqual(r.buildPassives,g.buildPassives)
  for(const mutate of [s=>s.lifeItemState.redEchoUsed='yes',s=>s.maxBaseHp=25,s=>s.lifeFailed=true,s=>s.buildPassives.ids.push('light-march'),s=>s.buildPassives.wave.counters.lightMarchUses=7]){
    const s=E.snapshotGame(g);mutate(s);if(s.lifeFailed)s.baseHp=1
    assert.equal(E.restoreGame(s),null)
  }
})
