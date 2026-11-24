import test from 'node:test'
import assert from 'node:assert/strict'
import { snapshotGame,restoreGame } from './engine.js'
import { deriveDeployFacts,deriveAscendFacts,deriveReportHighlights } from './presentationFacts.js'
import { createPresentationController } from './presentationEvents.js'
import { runBuildStrategy,BUILD_ROUTES,replayBuild } from '../scripts/verify-builds.mjs'
import { legalQualityFixtures } from '../scripts/verify-presentation.mjs'
const clone=value=>JSON.parse(JSON.stringify(value))

const run=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false})

test('formal receipts use actual field, reserve and training branches with honest new-soldier unknown deltas',()=>{
  const receipts=[]
  replayBuild(run,{onAction:({before,after,action})=>{if(action.type==='deploy'){
    const unchanged=snapshotGame(after),receipt=deriveDeployFacts(before,after);assert.ok(receipt)
    assert.deepEqual(snapshotGame(after),unchanged);receipts.push(receipt)
    for(const person of receipt.orderRecipients){
      assert.ok(after.allies.some(unit=>unit.id===person.id))
      assert.deepEqual(person.after,Object.fromEntries(['atk','heal','shield','period','maxHp'].map(key=>[key,after.allies.find(unit=>unit.id===person.id)[key]])))
      if(person.isNew)assert.ok(person.effects.every(effect=>effect.before===null && effect.delta===null))
      else for(const effect of person.effects)assert.equal(effect.delta,effect.after-effect.before)
    }
    assert.equal(deriveDeployFacts(after,after),null)
  }}})
  const high=receipts.find(receipt=>receipt.recruitment.status==='fielded' && receipt.recruitment.grade===4 && receipt.score>=800)
  const accepted=run.turns.find(turn=>turn.orderId===high.orderId),naturalRank={J:11,Q:12,K:13,A:14}
  assert.equal(high.recruitment.status,'fielded');assert.equal(high.recruitment.grade,accepted.grade)
  assert.equal(high.recruitment.statBonus,accepted.scoreTrace.scoringCards.reduce((sum,card)=>sum+(naturalRank[card.rank] || Number(card.rank)),0))
  assert.deepEqual(high.order.bonus,accepted.scoreTrace.order.bonus);assert.equal(high.order.sourceScore,accepted.score)
  const reserve=receipts.find(receipt=>receipt.recruitment.status==='reserve')
  assert.ok(reserve);assert.ok(reserve.recruitment.unitId)
  assert.ok(!reserve.orderRecipients.some(unit=>unit.id===reserve.recruitment.unitId))
  const training=receipts.find(receipt=>receipt.recruitment.status==='training')
  assert.ok(training);assert.equal(training.recruitment.unitId,null)
  assert.ok(training.recruitment.xpGain>0);assert.ok(training.recruitment.recipient?.id)
})

test('sidecar combat cues follow real contribution changes and retain stacked orders without claiming exclusive bonus damage',()=>{
  const controller=createPresentationController({maxRecent:8}),observed=[]
  replayBuild(run,{onAction:({before,after,action})=>{
    if(action.type==='deploy')controller.onDeploy(before,after)
    observed.push(...controller.sample(after))
  },onTick:game=>observed.push(...controller.sample(game))})
  assert.ok(observed.some(event=>event.kind==='attack' && event.actualAmount>0))
  assert.ok(observed.some(event=>event.kind==='guard' && event.actualAmount>0))
  for(const event of observed.filter(event=>['attack','heal'].includes(event.kind))) {
    assert.equal(event.actual,true);assert.ok(event.orderIds.length>0);assert.match(event.reason,/不能解释为某一手/)
  }
  const seen=new Set()
  for(const event of observed.filter(event=>['attack','heal'].includes(event.kind))) {
    const key=event.wave+'/'+event.type+'/'+event.kind;assert.ok(!seen.has(key));seen.add(key)
  }
  assert.ok(controller.getEvents().length<=8)
})

test('enabled, disabled, skip and 2x presentation modes preserve every engine snapshot, RNG and seed-4 twelfth-wave result',()=>{
  for(const mode of ['enabled','disabled','skip','2x']) {
    const controller=createPresentationController({enabled:mode!=='disabled'})
    if(mode==='2x')controller.setSpeed(2)
    const game=replayBuild(run,{onAction:({before,after,action})=>{
      const unchanged=snapshotGame(after)
      if(action.type==='deploy')controller.onDeploy(before,after)
      if(action.type==='forge')controller.onAscend(before,after,action.params.leaderId)
      controller.sample(after);if(mode==='skip')controller.skip()
      assert.deepEqual(snapshotGame(after),unchanged);assert.equal(after.rng,unchanged.rng)
    },onTick:game=>{controller.sample(game);if(mode==='skip')controller.skip()}})
    assert.deepEqual(snapshotGame(game),run.finalSnapshot)
    assert.deepEqual([game.phase,game.wave,game.baseHp],['won',12,100])
  }
})

test('mythic and prismatic presentation fixtures come from real equal-quality fusion, never a random recruit roll',()=>{
  for(const fixture of legalQualityFixtures()) {
    const restored=restoreGame(fixture.snapshot);assert.ok(restored)
    assert.ok([5,6].includes(fixture.expected.grade));assert.equal(fixture.action.params.kind,'ascend')
    const leader=fixture.snapshot.allies.concat(fixture.snapshot.reserves).find(unit=>unit.id===fixture.action.params.leaderId)
    const donor=fixture.snapshot.allies.concat(fixture.snapshot.reserves).find(unit=>unit.id===fixture.action.params.donorId)
    assert.equal(leader.grade,fixture.expected.grade-1);assert.equal(donor.grade,leader.grade)
    assert.equal(deriveAscendFacts(fixture.snapshot,fixture.snapshot,leader.id),null)
    assert.ok(fixture.actions.every(action=>!['spawn','set-grade','grant-gold'].includes(action.type)))
  }
})

test('report payoff summaries are read-only, source-based, and only add queen interruption when a precise live event exists',()=>{
  const report=run.waves.at(-1).report,before=clone(report),rows=deriveReportHighlights(report)
  assert.deepEqual(report,before);assert.ok(rows.some(row=>row.kind==='regiment'))
  assert.ok(!rows.some(row=>row.id==='queen-interrupt'))
  const live=deriveReportHighlights(report,{liveEvents:[{kind:'queen-interrupt',actual:true,wave:report.wave}],limit:10})
  assert.ok(live.some(row=>row.id==='queen-interrupt'))
  assert.deepEqual(report,before)
})

test('cleared boss warnings do not fabricate interruption; only new exact logs, real counters and positive item events produce cues',()=>{
  const game={seed:'cue-boundary',wave:12,battleId:12,waveTime:0,tacticsReport:{interrupts:0},logs:[],
    combatLedger:{waveId:'cue-boundary-12',started:true,units:[],itemEvents:[]},bossTelegraph:{name:'王庭震荡'}}
  const controller=createPresentationController();assert.deepEqual(controller.sample(game),[])
  game.bossTelegraph=null;assert.deepEqual(controller.sample(game),[])
  game.logs.push({id:'real-interrupt',text:'王庭震荡被打断 · 已削去首领 8% 最大生命'})
  assert.equal(controller.sample(game).filter(event=>event.kind==='queen-interrupt').length,1)
  assert.deepEqual(controller.sample(game),[])
  game.combatLedger.itemEvents.push({id:'heart-engine',triggered:false,effects:{damage:0},targetIds:[]})
  assert.deepEqual(controller.sample(game),[])
  game.combatLedger.itemEvents.push({id:'heart-engine',triggered:true,effects:{damage:17.5,shieldDamage:0},targetIds:['enemy-1','enemy-2']})
  const before=clone(game),heart=controller.sample(game).find(event=>event.kind==='heart-engine')
  assert.equal(heart.actualAmount,17.5);assert.deepEqual(game,before)
  game.tacticsReport.interrupts=1;assert.equal(controller.sample(game).filter(event=>event.kind==='bell-interrupt').length,1)
})
