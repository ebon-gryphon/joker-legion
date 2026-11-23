import test from 'node:test'
import assert from 'node:assert/strict'
import {createGame,previewHand,deploy,snapshotGame} from './engine.js'
import {JOKER_BY_ID} from './campaignRules.js'
import {buildScoreSequence,sequenceStateAt,createScorePlayback,advanceScorePlayback,replaceScorePlayback} from './scoreSequence.js'

function choose(game,faces){
 const deck=[...game.hand,...game.deck],picked=faces.map(face=>deck.find(card=>card.suit+card.rank===face))
 assert.ok(picked.every(Boolean))
 const remaining=deck.filter(card=>!picked.includes(card));game.hand=[...picked,...remaining.slice(0,8-picked.length)]
 game.deck=remaining.slice(8-picked.length);game.selected=picked.map(card=>card.id)
}
function own(game,id,quantity=1){game.jokers.push({...JOKER_BY_ID[id],quantity,triggers:0,flash:0})}

test('the visual sequence preserves authoritative addition order and never shows a score before multiplication',()=>{
 const game=createGame();own(game,'score-chalk',2);own(game,'pair-ink',2);own(game,'straight-compass')
 choose(game,['♠2','♥3','♣4','♦5','♠6']);const trace=previewHand(game).scoreTrace,before=JSON.stringify(trace)
 const sequence=buildScoreSequence(trace)
 assert.deepEqual(sequence.steps.map(step=>step.id),trace.steps.map(step=>step.id))
 assert.ok(!sequence.steps.some(step=>step.itemId==='pair-ink'),'an unmet item does not fake a trigger')
 const multiply=sequence.steps.findIndex(step=>step.kind==='multiply')
 for(const [i,step] of sequence.steps.entries()){
   const state=sequenceStateAt(sequence,(step.start+step.end)/2)
   assert.equal(state.step.id,step.id)
   if(step.kind==='item')assert.ok(i<multiply)
   assert.equal(state.score,i<multiply?null:trace.finalScore)
 }
 assert.equal(sequenceStateAt(sequence,sequence.duration).chips,trace.chipsBeforeMult)
 assert.equal(sequenceStateAt(sequence,sequence.duration).score,trace.finalScore)
 assert.equal(JSON.stringify(trace),before)
})

test('ordinary hands finish in under 800ms and enhanced chains stay within 1.2 seconds',()=>{
 for(const faces of [['♠2'],['♠8','♥8'],['♠2','♥3','♣4','♦5','♠6']]){
  const game=createGame();choose(game,faces);const sequence=buildScoreSequence(previewHand(game).scoreTrace)
  assert.ok(sequence.duration>=500 && sequence.duration<800)
 }
 const game=createGame();for(const id of ['score-chalk','red-thread','black-wax','court-seal','straight-compass','score-ticket'])own(game,id,3)
 choose(game,['♠10','♠J','♠Q','♠K','♠A']);const sequence=buildScoreSequence(previewHand(game).scoreTrace)
 assert.equal(sequence.enhanced,true);assert.ok(sequence.duration<=1200)
 assert.equal(sequenceStateAt(sequence,sequence.duration+10000).done,true)
})

test('2× timing, mid-sequence speed changes and skipping never emit completion twice',()=>{
 const game=createGame();choose(game,['♠8','♥8']);const trace=previewHand(game).scoreTrace,p=createScorePlayback(trace)
 const normal=advanceScorePlayback(p,240),fast=advanceScorePlayback(p,120,{speed:2})
 assert.equal(normal.playback.elapsed,fast.playback.elapsed)
 const switched=advanceScorePlayback(fast.playback,100,{speed:1})
 assert.equal(switched.playback.elapsed,340)
 const finished=advanceScorePlayback(switched.playback,0,{skip:true})
 assert.deepEqual(finished.complete,[{id:trace.id,reason:'skipped'}])
 assert.equal(sequenceStateAt(finished.playback.sequence,finished.playback.elapsed).score,trace.finalScore)
 assert.deepEqual(advanceScorePlayback(finished.playback,9999).complete,[])
 assert.deepEqual(advanceScorePlayback(finished.playback,0,{skip:true}).complete,[])
})

test('rapid hands replace the active visual immediately and duplicate trace deliveries do not replay',()=>{
 const game=createGame();choose(game,['♠8','♥8']);const one=previewHand(game).scoreTrace
 const two={...one,id:'next-hand'},started=advanceScorePlayback(createScorePlayback(one),100).playback
 const replaced=replaceScorePlayback(started,two)
 assert.deepEqual(replaced.complete,[{id:one.id,reason:'replaced'}])
 assert.equal(replaced.playback.sequence.id,two.id);assert.equal(replaced.playback.elapsed,0)
 const duplicate=replaceScorePlayback(replaced.playback,{...two})
 assert.equal(duplicate.playback,replaced.playback);assert.deepEqual(duplicate.complete,[])
 const cleared=replaceScorePlayback(replaced.playback,null)
 assert.equal(cleared.playback,null);assert.deepEqual(cleared.complete,[{id:two.id,reason:'replaced'}])
})

test('playing, skipping and replacing a visual cannot repeat the already-atomic order or item consumption',()=>{
 const game=createGame();own(game,'score-ticket',3);choose(game,['♠8','♥8'])
 assert.equal(deploy(game),true)
 const committed=snapshotGame(game),trace=game.lastDeploy.scoreTrace
 let playback=createScorePlayback(trace)
 for(let i=0;i<120;i++)playback=advanceScorePlayback(playback,16,{speed:i>30?2:1}).playback
 playback=advanceScorePlayback(playback,0,{skip:true}).playback
 playback=replaceScorePlayback(playback,{...trace,id:'next-visual-only'}).playback
 advanceScorePlayback(playback,0,{skip:true,reason:'reduced-motion'})
 assert.deepEqual(snapshotGame(game),committed)
 assert.equal(game.jokers.find(item=>item.id==='score-ticket').quantity,2)
 assert.equal(game.stats.deploys,1)
})

test('empty or malformed visuals fail closed and negative frame durations cannot rewind a hand',()=>{
 assert.equal(buildScoreSequence(null),null);assert.equal(createScorePlayback({id:'broken'}),null)
 const game=createGame();choose(game,['♠2']);const p=advanceScorePlayback(createScorePlayback(previewHand(game).scoreTrace),100).playback
 assert.equal(advanceScorePlayback(p,-50).playback.elapsed,100)
 assert.equal(advanceScorePlayback(p,NaN).playback.elapsed,100)
})

test('selection introduction lights cards one by one without prematurely adding points',()=>{
 const game=createGame();choose(game,['♠8','♥8','♣2']);const trace=previewHand(game).scoreTrace,sequence=buildScoreSequence(trace)
 const first=sequenceStateAt(sequence,0),middle=sequenceStateAt(sequence,sequence.introDuration*.5),last=sequenceStateAt(sequence,sequence.introDuration-.01)
 assert.equal(first.step.kind,'selection');assert.equal(first.chips,0);assert.equal(first.score,null)
 assert.equal(first.litCardIds.length,1);assert.equal(middle.litCardIds.length,2);assert.equal(last.litCardIds.length,3)
 assert.deepEqual(last.countedCardIds,[])
 const base=sequenceStateAt(sequence,sequence.introDuration)
 assert.equal(base.step.kind,'base');assert.equal(base.chips,trace.hand.baseChips+trace.hand.levelChips)
 assert.deepEqual(base.countedCardIds,[])
 const counted=sequenceStateAt(sequence,sequence.steps.find(step=>step.kind==='card').start+.01)
 assert.equal(counted.countedCardIds.length,1)
 assert.ok(!sequence.steps.some(step=>step.kind==='card' && step.id===trace.nonScoringCards[0].id))
})

test('quality and recruitment remain concealed until their authoritative outcome steps; relics retain actual order',()=>{
 const game=createGame();own(game,'third-act');own(game,'red-echo');game.stats.deploys=2;choose(game,['♥8','♦8'])
 assert.equal(deploy(game),true)
 const trace=game.lastDeploy.scoreTrace,sequence=buildScoreSequence(trace)
 assert.deepEqual(sequence.steps.map(s=>s.id),trace.steps.map(s=>s.id))
 const quality=sequence.steps.find(s=>s.id==='quality'),muster=sequence.steps.find(s=>s.id==='muster')
 assert.equal(sequenceStateAt(sequence,0).qualityVisible,false)
 assert.equal(sequenceStateAt(sequence,quality.start-.01).qualityVisible,false)
 assert.equal(sequenceStateAt(sequence,quality.start+.01).qualityVisible,true)
 assert.equal(sequenceStateAt(sequence,muster.start-.01).musterVisible,false)
 assert.equal(sequenceStateAt(sequence,muster.start+.01).musterVisible,true)
 const ids=sequence.steps.map(s=>s.id)
 assert.ok(ids.indexOf('relic-third-act')<ids.indexOf('muster'))
 assert.ok(ids.indexOf('order')>ids.indexOf('muster'))
 assert.ok(ids.indexOf('relic-iron-banner')>ids.indexOf('order'))
 assert.ok(ids.indexOf('relic-red-echo')>ids.indexOf('relic-iron-banner'))
 for(const step of sequence.steps.filter(s=>['relic','order'].includes(s.kind))){assert.equal(step.delta,undefined);assert.equal(sequenceStateAt(sequence,(step.start+step.end)/2).score,trace.finalScore)}
 assert.ok(sequence.duration<800)
})
