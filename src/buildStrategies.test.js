import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILD_ROUTES,runBuildStrategy,replayBuild } from '../scripts/verify-builds.mjs'

test('seed 4 prints a real second-wave legendary flush-five with earned gold, pays shops in crystals and replays the random offers through final victory',()=>{
  const run=runBuildStrategy(BUILD_ROUTES[0])
  const firstPrint=run.actions.find(action=>action.type==='print')
  assert.equal(firstPrint.wave,2)
  assert.equal(firstPrint.params.targets.length,4);assert.equal(firstPrint.params.price,14)
  assert.ok(firstPrint.before.gold>=firstPrint.params.price)
  assert.equal(firstPrint.after.gold,firstPrint.before.gold-firstPrint.params.price)
  assert.equal(firstPrint.after.crystals,firstPrint.before.crystals)
  const high=run.turns.find(turn=>turn.wave===2 && turn.key==='flushFive')
  assert.ok(high.score>=800);assert.equal(high.grade,4)
  const recruitPoints={J:11,Q:12,K:13,A:14}
  assert.equal(high.scoreTrace.recruit.statBonus,high.scoreTrace.scoringCards.reduce((sum,card)=>sum+(recruitPoints[card.rank] || Number(card.rank)),0))
  assert.ok(high.scoreTrace.recruit.statBonusSource.includes('+'+high.scoreTrace.recruit.statBonus+'%'))
  assert.equal(new Set(high.scoreTrace.scoringCards.map(card=>card.suit+card.rank)).size,1)
  assert.equal(high.scoreTrace.scoringCards.length,5)
  const trace=high.scoreTrace,points=trace.scoringCards.reduce((sum,card)=>sum+card.points,0),bonuses=trace.chipBonuses.reduce((sum,item)=>sum+item.delta,0)
  assert.equal(trace.chipsBeforeMult,trace.hand.baseChips+trace.hand.levelChips+points+bonuses)
  assert.equal(high.score,trace.chipsBeforeMult*trace.mult+(trace.finalBonus?.amount || 0))
  for(const action of run.actions.filter(action=>action.type==='buy' || action.type==='reroll')){
    assert.equal(action.after.gold,action.before.gold)
    assert.ok(action.after.crystals<action.before.crystals)
  }
  for(const action of run.actions.filter(action=>action.type==='reward')){
    assert.equal(action.params.offers.length,3);assert.equal(new Set(action.params.offers).size,3)
    assert.ok(action.params.offers.includes(action.params.id))
  }
  assert.equal(run.result.phase,'won');assert.equal(run.result.wave,12)
  assert.equal(run.actions[0].before.life,12)
  assert.equal(run.result.lifeFailed,false);assert.ok(run.result.life>=0 && run.result.life<=run.result.maxLife)
  assert.equal(run.waves.reduce((sum,wave)=>sum+(wave.report.economy?.crystals.total || 0),0),65)
  assert.equal(run.actions.some(action=>action.wave===12 && ['reward','buy','next-wave'].includes(action.type)),false)
  assert.equal(run.waves.find(wave=>wave.wave===12).phase,'won')
  assert.ok(run.waves.some(wave=>wave.wave===2 && wave.phase==='shop'))
  assert.equal(replayBuild(run).phase,run.result.phase)
  assert.ok(run.fixtures.some(fixture=>fixture.id==='a-before-3520'))
})

test('seed 1 records the global sixth play as real full-army XP rather than an invented sixth soldier',()=>{
  const run=runBuildStrategy(BUILD_ROUTES[1]),training=run.milestones.firstTraining
  assert.ok(training);assert.equal(training.ordinal,6);assert.equal(training.wave,2);assert.ok(training.xp>0)
  const turn=run.turns.find(turn=>turn.ordinal===training.ordinal)
  assert.equal(turn.scoreTrace.recruit.actualCount,0);assert.equal(turn.scoreTrace.recruit.reserve,false)
  assert.ok(turn.scoreTrace.recruit.receiver?.id);assert.ok(turn.recruitment.xpGain>0)
  const third=turn.scoreTrace.items.find(item=>item.id==='third-act').actual
  assert.ok(third.triggered);assert.equal(third.effects.starGain,0);assert.ok(third.effects.xpGain>0)
  assert.equal(run.result.wavesRecorded,12);assert.equal(replayBuild(run).phase,run.result.phase)
})

test('seed 3 reports full-health Red Echo as zero healing and Holy Grail as actual damage through a faithfully replayable run',()=>{
  const run=runBuildStrategy(BUILD_ROUTES[2])
  const red=run.milestones.firstRedEcho.actual
  assert.equal(red.triggered,true);assert.equal(red.effective,false)
  assert.equal(red.effects.healed,0);assert.equal(red.effects.lifeHealed,0)
  const events=run.waves.flatMap(wave=>wave.itemEvents).filter(event=>event.id==='heart-engine' || event.itemId==='heart-engine')
  assert.ok(events.some(event=>event.effects.damage>0))
  assert.ok(run.result.heartEngineDamage>0);assert.equal(run.result.redEchoHealing,0)
  assert.ok(['won','lost'].includes(run.result.phase));assert.equal(replayBuild(run).phase,run.result.phase)
  assert.ok(run.fixtures.some(fixture=>fixture.id==='c-before-heart-conversion'))
})
