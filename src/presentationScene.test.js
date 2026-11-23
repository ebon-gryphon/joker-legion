import test from 'node:test'
import assert from 'node:assert/strict'
import {createPresentationScene} from './presentationScene.js'
const receipt=(id,grade,status='fielded')=>({id,recruitment:{grade,status,unitId:'new'},orderRecipients:[{unitId:'old'}]})
test('only formal grades above legendary cheer; real reserve never adds a sixth field unit',()=>{
 for(let grade=0;grade<=6;grade++){
  const s=createPresentationScene(),r=receipt('r',grade,'reserve'),before=JSON.stringify(r)
  s.accept(r,{waveKey:'w',army:['old','other']});s.stage('r','muster')
  assert.equal(!!s.get().cheer,grade>4);assert.equal(!!s.get().reveal,grade>=4)
  if(grade>4){assert.deepEqual(s.get().cheer.unitIds,['old','other']);assert.equal(s.get().reveal.placement,'reserve')}
  assert.equal(JSON.stringify(r),before)
 }
})
test('each wave cheers fully once, subsequent results are short, skip/replacement/reload cannot replay',()=>{
 const s=createPresentationScene()
 s.accept(receipt('a',5),{waveKey:'w',army:['old']});s.stage('a','muster');assert.equal(s.get().cheer.full,true)
 s.skip();assert.equal(s.accept(receipt('a',5),{waveKey:'w'}),false)
 s.accept(receipt('b',6),{waveKey:'w',army:['old']});s.stage('b','muster');assert.equal(s.get().cheer.full,false)
 s.accept(receipt('c',5),{waveKey:'w2'});s.stage('c','muster');assert.equal(s.get().cheer.full,true)
 s.reset();s.prime('w2',true);s.accept(receipt('d',5),{waveKey:'w2'});s.stage('d','muster');assert.equal(s.get().cheer.full,false)
})
test('2x, visual pause, reduced motion and disabling only alter external visual time',()=>{
 const s=createPresentationScene();s.accept(receipt('a',5),{waveKey:'w',army:['old']});s.stage('a','muster')
 s.advance(100,{paused:true});assert.equal(s.get().cheer.elapsedMs,0)
 s.advance(100,{speed:2});assert.equal(s.get().cheer.elapsedMs,200)
 s.advance(0,{reducedMotion:true});assert.equal(s.get().active,false)
 s.setEnabled(false);s.accept(receipt('b',6),{waveKey:'w'});s.stage('b','muster');assert.equal(s.get().active,false)
})
