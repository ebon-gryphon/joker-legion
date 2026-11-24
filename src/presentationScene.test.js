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

test('the actual commander never cheers itself and only the existing unique field roster salutes a reserve commander',()=>{
 const field=['old','new','other','old'],s=createPresentationScene(),before=JSON.stringify(field)
 s.accept(receipt('field',5),{waveKey:'w',army:field,immediate:true})
 assert.equal(s.get().cheer.sourceUnitId,'new')
 assert.deepEqual(s.get().cheer.unitIds,['old','other'])
 s.accept(receipt('reserve',6,'reserve'),{waveKey:'w',army:['old','other'],immediate:true})
 assert.equal(s.get().reveal.placement,'reserve')
 assert.deepEqual(s.get().cheer.unitIds,['old','other'])
 assert.equal(s.get().cheer.unitIds.includes('new'),false)
 assert.equal(JSON.stringify(field),before)
})

test('one accepted salute keeps its original full/short windows and cannot restart after expiry, skip or duplicate stage',()=>{
 const s=createPresentationScene()
 s.accept(receipt('first',5),{waveKey:'w',army:['new','old'],immediate:true})
 s.advance(999);assert.equal(s.get().cheer.elapsedMs,999)
 s.advance(1);assert.equal(s.get().cheer,undefined)
 s.stage('first','muster');s.advance(1000);s.stage('first','muster')
 assert.equal(s.get().cheer,undefined)
 s.accept(receipt('second',6),{waveKey:'w',army:['old'],immediate:true})
 assert.equal(s.get().cheer.full,false)
 s.advance(419);assert.equal(s.get().cheer.elapsedMs,419)
 s.advance(1);assert.equal(s.get().cheer,undefined)
 s.skip();assert.equal(s.accept(receipt('second',6),{waveKey:'w',army:['old']}),false)
 for(const cancel of [scene=>scene.skip(),scene=>scene.advance(0,{reducedMotion:true}),scene=>{scene.setEnabled(false);scene.setEnabled(true)}]){
  const scene=createPresentationScene();scene.accept(receipt('pending',5),{waveKey:'w',army:['old']})
  cancel(scene);scene.stage('pending','muster')
  assert.equal(scene.get().active,false);assert.equal(scene.get().cheer,undefined)
  assert.equal(scene.accept(receipt('pending',5),{waveKey:'w',army:['old']}),false)
 }
})
