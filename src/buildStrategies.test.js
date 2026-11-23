import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILD_ROUTES,runBuildStrategy,replayBuild } from '../scripts/verify-builds.mjs'

test('seed 4 reaches a real second-wave 3520 flush-five through earned gold and four legal prints, then replays to its actual ending',()=>{
  const run=runBuildStrategy(BUILD_ROUTES[0])
  const firstPrint=run.actions.find(action=>action.type==='print')
  assert.equal(firstPrint.wave,2);assert.equal(firstPrint.params.source.face,'♦A')
  assert.equal(firstPrint.params.targets.length,4);assert.equal(firstPrint.params.price,14)
  assert.equal(firstPrint.after.gold,2)
  const high=run.turns.find(turn=>turn.wave===2 && turn.key==='flushFive')
  assert.equal(high.score,3520);assert.equal(high.grade,4)
  assert.match(high.scoreTrace.recruit.statBonusSource,/\+70%/);assert.match(high.scoreTrace.recruit.statBonusSource,/评分牌点共 55/)
  assert.deepEqual([high.scoreTrace.hand.baseChips,high.scoreTrace.scoringCards.reduce((sum,card)=>sum+card.points,0),high.scoreTrace.chipBonuses.reduce((sum,item)=>sum+item.delta,0),high.scoreTrace.mult],[160,55,5,16])
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
  assert.equal(red.effects.healed,0);assert.equal(red.effects.gateRepaired,0)
  const events=run.waves.flatMap(wave=>wave.itemEvents).filter(event=>event.id==='heart-engine' || event.itemId==='heart-engine')
  assert.ok(events.some(event=>event.effects.damage>0))
  assert.ok(run.result.heartEngineDamage>0);assert.equal(run.result.redEchoHealing,0)
  assert.ok(['won','lost'].includes(run.result.phase));assert.equal(replayBuild(run).phase,run.result.phase)
  assert.ok(run.fixtures.some(fixture=>fixture.id==='c-before-heart-conversion'))
})
