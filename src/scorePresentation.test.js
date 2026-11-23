import test from 'node:test'
import assert from 'node:assert/strict'
import {createGame,previewHand,deploy,snapshotGame,restoreGame,addUnit,forgeUnit} from './engine.js'
import {JOKER_BY_ID} from './campaignRules.js'
import {deriveDeployFacts,deriveAscendFacts} from './presentationFacts.js'
import {recruitmentView,orderRecipientViews,orderRecipientHeading} from './presentationViews.js'
import {buildScoreSequence,sequenceStateAt,createScorePlayback,advanceScorePlayback,replaceScorePlayback} from './scoreSequence.js'
function choose(game,faces){const stock=[...game.hand,...game.deck],picked=faces.map(face=>stock.find(c=>c.suit+c.rank===face));assert.ok(picked.every(Boolean));const rest=stock.filter(c=>!picked.includes(c));game.hand=[...picked,...rest.slice(0,8-picked.length)];game.deck=rest.slice(8-picked.length);game.selected=picked.map(c=>c.id)}
function own(g,id,quantity=1){g.jokers.push({...JOKER_BY_ID[id],quantity,triggers:0,flash:0})}
function army(g){for(let i=0;i<5;i++)addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:String(i+2)}})}

test('cinematic is explicit, preserves ordinary duration, and gives high hands separate hand/final/quality/muster/order focus',()=>{
  for(const faces of [['♠2'],['♠8','♥8'],['♠2','♥3','♣4','♦5','♠6']]){
    const g=createGame();choose(g,faces);const trace=previewHand(g).scoreTrace
    const old=buildScoreSequence(trace),cinematic=buildScoreSequence(trace,{cinematic:true})
    assert.ok(old.duration>=560 && old.duration<=780)
    assert.equal(cinematic.duration,old.duration)
    assert.ok(cinematic.steps.some(s=>s.id==='hand-established'))
    const final=cinematic.steps.find(s=>s.id==='final-score')
    assert.ok(final.end-final.start>=100)
    assert.equal(sequenceStateAt(cinematic,final.start+.01).focus,'final-score')
    assert.equal(sequenceStateAt(cinematic,final.start+.01).displayScore,trace.finalScore)
  }
  const g=createGame();choose(g,['♠2','♥2','♣2','♦3','♠3']);assert.ok(deploy(g))
  const sequence=buildScoreSequence(g.lastDeploy.scoreTrace,{cinematic:true})
  assert.ok(sequence.duration>=1800 && sequence.duration<=2400)
  assert.ok(sequence.steps.find(s=>s.id==='final-score').end-sequence.steps.find(s=>s.id==='final-score').start>=240)
  for(const id of ['hand-established','final-score','quality','muster','order'])assert.ok(sequence.steps.some(s=>s.id===id))
  const multiplier=sequence.steps.find(s=>s.kind==='multiply'),state=sequenceStateAt(sequence,(multiplier.start+multiplier.end)/2)
  assert.equal(state.focus,'multiplier');assert.equal(state.displayScore,null)
})

test('random legendary upgrades cannot change any visible prefix timing, focus, progress or revealed grade before quality',()=>{
  const g=createGame();choose(g,['♠2']);const trace=structuredClone(previewHand(g).scoreTrace)
  const ordinary={...trace,quality:{...trace.quality,rolled:0,rolledName:'常备'}}
  const surprise={...trace,quality:{...trace.quality,rolled:4,rolledName:'传说'},steps:[...trace.steps,{kind:'relic',id:'private-tail',label:'后续实际连锁'}]}
  const a=buildScoreSequence(ordinary,{cinematic:true}),b=buildScoreSequence(surprise,{cinematic:true})
  assert.ok(a.duration<800 && b.duration>=1800)
  const reveal=a.steps.find(s=>s.id==='quality').start
  assert.equal(b.steps.find(s=>s.id==='quality').start,reveal)
  for(let at=0;at<reveal;at+=7){
    const pick=s=>({focus:s.focus,chips:s.chips,displayScore:s.displayScore,qualityVisible:s.qualityVisible,revealedGrade:s.revealedGrade,progress:s.progress,lit:s.litCardIds,counted:s.countedCardIds})
    assert.deepEqual(pick(sequenceStateAt(a,at)),pick(sequenceStateAt(b,at)))
    assert.equal(sequenceStateAt(b,at).revealedGrade,null)
  }
  assert.equal(sequenceStateAt(b,reveal+.01).revealedGrade,4)
})

test('presentation pause freezes elapsed while disabled, reduced-motion and immediate skip still finish exactly once',()=>{
  const g=createGame();choose(g,['♠8','♥8']);const trace=previewHand(g).scoreTrace
  const running=advanceScorePlayback(createScorePlayback(trace,{cinematic:true}),100).playback
  assert.equal(advanceScorePlayback(running,9999,{paused:true}).playback,running)
  assert.equal(advanceScorePlayback(running,50,{speed:2}).playback.elapsed,200)
  for(const options of [{paused:true,enabled:false},{paused:true,reducedMotion:true},{paused:true,skip:true}]){
    const result=advanceScorePlayback(running,0,options)
    assert.equal(result.playback.done,true);assert.equal(result.complete.length,1)
    assert.equal(sequenceStateAt(result.playback.sequence,result.playback.elapsed).displayScore,trace.finalScore)
    assert.equal(advanceScorePlayback(result.playback,9999,options).complete.length,0)
  }
})

test('replaced, skipped, cleared and externally consumed presentation IDs do not replay across receipts or remounts',()=>{
  const g=createGame();choose(g,['♠2']);const a=previewHand(g).scoreTrace,b={...a,id:'second'}
  const running=advanceScorePlayback(createScorePlayback(a),100).playback
  const second=replaceScorePlayback(running,b)
  assert.equal(second.complete[0].reason,'replaced')
  const back=replaceScorePlayback(second.playback,a)
  assert.equal(back.playback.done,true);assert.equal(back.playback.elapsed,back.playback.sequence.duration)
  assert.deepEqual(back.complete,[{id:b.id,reason:'replaced'}])
  const remount=createScorePlayback(a,{cinematic:true,consumedIds:[a.id]})
  assert.equal(remount.done,true);assert.deepEqual(advanceScorePlayback(remount,2000).complete,[])
  const clear=replaceScorePlayback(running,null)
  const afterCover=createScorePlayback(a,{consumedIds:clear.complete.map(c=>c.id)})
  assert.equal(afterCover.done,true)
})

test('recruit reveal uses actual field, reserve and training facts without inventing a sixth unit or a zero delta',()=>{
  for(const status of ['fielded','reserve','training']){
    const g=createGame({seed:'ordinary-training'})
    if(status!=='fielded')army(g)
    if(status==='reserve')own(g,'score-chalk',400)
    choose(g,['♠2']);const before=snapshotGame(g);assert.ok(deploy(g))
    const facts=deriveDeployFacts(before,snapshotGame(g)),saved=JSON.stringify(facts),view=recruitmentView(facts)
    assert.equal(view.status,status)
    if(status==='fielded')assert.ok(view.unitId && g.allies.some(u=>u.id===view.unitId))
    if(status==='reserve'){assert.ok(g.reserves.some(u=>u.id===view.unitId));assert.equal(g.allies.length,5)}
    if(status==='training'){assert.equal(view.unitId,null);assert.ok(view.recipient.id);assert.equal(view.rows.length,0);assert.equal(g.allies.length,5)}
    const hidden=recruitmentView(facts,{revealed:false,qualityVisible:false})
    assert.equal(hidden.grade,undefined);assert.equal(hidden.name,undefined);assert.equal(hidden.status,undefined)
    assert.equal(JSON.stringify(facts),saved)
  }
})

test('actual order recipients show observed whole-play values and preserve unknown new-recruit baselines',()=>{
  const g=createGame();addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'3'}});choose(g,['♠2'])
  const before=snapshotGame(g);assert.ok(deploy(g));const facts=deriveDeployFacts(before,snapshotGame(g)),saved=JSON.stringify(facts)
  assert.deepEqual(orderRecipientViews(facts,{revealed:false}),[])
  const rows=orderRecipientViews(facts),old=rows.find(r=>!r.isNew),fresh=rows.find(r=>r.isNew)
  assert.ok(old.effects.some(e=>e.delta>0))
  assert.ok(fresh.effects.length && fresh.effects.every(e=>e.delta===null && e.text.startsWith('结算后')))
  assert.equal(old.scope,'whole-play')
  assert.equal(JSON.stringify(facts),saved)
})

test('order receipt names its actual order and shows recorded positive, shield and interval deltas without inventing new-unit gains',()=>{
  const effects=[{stat:'atk',before:29,after:87,delta:58},{stat:'shield',before:0,after:85,delta:85},
    {stat:'period',before:1.16,after:.638,delta:-.522}]
  const facts={order:{name:'王师进军',targetName:'铁卫',sourceScore:3520},orderRecipients:[
    {id:'old',effects},{id:'new',isNew:true,effects:effects.map(e=>({...e,before:null,delta:null}))}]}
  const saved=JSON.stringify(facts),rows=orderRecipientViews(facts)
  assert.deepEqual(orderRecipientHeading(facts),{title:'王师进军 → 铁卫',sourceScore:3520})
  assert.deepEqual(rows[0].effects.map(e=>e.deltaText),['（＋58）','（＋85）','（−0.522秒）'])
  assert.ok(rows[1].effects.every(e=>e.deltaText==='' && e.text.startsWith('结算后')))
  assert.deepEqual(orderRecipientHeading({}),{title:'本手实际受令成员',sourceScore:null})
  assert.equal(JSON.stringify(facts),saved)
})

test('independent real quality-fusion receipts reveal mythic identity and actual before/after values without a score trace',()=>{
  const g=createGame(),a=addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'3',grade:4}}),b=addUnit(g,'healer','ally',1,{identity:{suit:'♥',rank:'2',grade:4}})
  const before=snapshotGame(g);assert.ok(forgeUnit(g,a.id,b.id,'ascend'))
  const facts=deriveAscendFacts(before,snapshotGame(g),a.id),view=recruitmentView(facts,{kind:'fusion'})
  assert.equal(view.fusion,true);assert.equal(view.grade,5);assert.equal(view.quality,'神话')
  assert.equal(view.unitId,a.id);assert.equal(view.rows.find(r=>r.stat==='atk').after,a.atk)
  assert.equal(facts.scoreTrace,undefined)
})

test('all cinematic and reveal reads leave the committed expedition and saved snapshot unchanged',()=>{
  const g=createGame();choose(g,['♠8','♥8']);const before=snapshotGame(g);assert.ok(deploy(g))
  const committed=snapshotGame(g),facts=deriveDeployFacts(before,committed)
  let playback=createScorePlayback(facts.scoreTrace,{cinematic:true})
  for(let i=0;i<90;i++)playback=advanceScorePlayback(playback,16,{speed:i>30?2:1,paused:i<10}).playback
  advanceScorePlayback(playback,0,{enabled:false})
  recruitmentView(facts);orderRecipientViews(facts)
  assert.deepEqual(snapshotGame(g),committed)
  assert.ok(restoreGame(committed))
})
