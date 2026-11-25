import test from 'node:test'
import assert from 'node:assert/strict'
import {getSpriteFrame} from './spriteAtlas.js'
import {highTierVisualForFrame,highTierFusionModules} from './highTierArt.js'
import {actionPose} from './choreography.js'
import {performanceOf} from './performance.js'
import {drawUnit} from './battlefieldUnits.js'
import {snapshotGame} from './engine.js'
import {BUILD_ROUTES,runBuildStrategy,replayBuild} from '../scripts/verify-builds.mjs'

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const copy=value=>JSON.parse(JSON.stringify(value))
const roles={sovereign:'flushFive',priest:'pair',shield:'fullHouse',archer:'three'}
const unit=(jobId,grade)=>({id:'visual-'+jobId,side:'ally',type:jobId==='priest'?'healer':jobId==='archer'?'ranger':'knight',jobId,
 pattern:roles[jobId],grade,level:1,suit:'♠',rank:'K',x:295,y:208,hp:100,maxHp:100,shield:0,impactAt:-100})
const context=()=>new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(()=>{}),set:(target,key,value)=>(target[key]=value,true)})

test('art selection accepts frozen profession state and never promotes a lower quality or invents a fusion inheritance',()=>{
 for(const job of Object.keys(roles))for(const grade of [0,4,5,6]){
  const soldier=freeze({...unit(job,grade),fusionJobs:[job,'fire','shield','priest']}),before=copy(soldier)
  const frame=freeze(getSpriteFrame(soldier)),look=highTierVisualForFrame(frame),modules=highTierFusionModules(frame)
  assert.equal(Boolean(look),grade>=5)
  assert.ok(modules.length<=2)
  assert.ok(modules.every(module=>soldier.fusionJobs.slice(1).includes(module.job)))
  assert.deepEqual(soldier,before);assert.deepEqual(frame.fusionJobs,soldier.fusionJobs)
 }
})

test('the four upgraded silhouettes retain the original drawUnit interaction geometry at every grade and pose',()=>{
 for(const job of Object.keys(roles))for(const grade of [0,4,5,6]){
  const soldier=freeze(unit(job,grade)),before=copy(soldier),height=49+(grade>=4?3:0)
  const expected={id:soldier.id,side:'ally',left:268,right:322,top:208-height,bottom:211}
  for(const walking of [false,true])for(const reduced of [false,true]){
   const bounds=drawUnit(context(),soldier,freeze({x:295,y:208,walking,pendingDamage:0}),2,0,y=>y,new Map(),0,true,null,2,reduced,null,null,null,[])
   assert.deepEqual(bounds,expected)
  }
  const profile=performanceOf(soldier),contact=actionPose(profile,profile.windup)
  assert.equal(contact.contact,1,'Use the existing real contact time, never a separate visual hit clock')
  assert.deepEqual(soldier,before)
 }
})

test('high-tier visual sampling leaves every legal seed-4 action snapshot and RNG equal through the 12-wave victory',()=>{
 const baseline=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false})
 const game=replayBuild(baseline,{onAction:({after})=>{
  const before=snapshotGame(after),frozen=freeze(copy(before))
  const originalRandom=Math.random
  Math.random=()=>{throw Error('Rendering must not roll randomness')}
  try{
   for(const soldier of [...frozen.allies,...frozen.reserves]){
    const frame=freeze(getSpriteFrame(soldier))
    highTierVisualForFrame(frame);highTierFusionModules(frame)
    const profile=performanceOf(soldier)
    if(profile)for(const t of [0,profile.windup*.65,profile.windup,profile.windup+profile.release*.6])actionPose(profile,t)
   }
  }finally{Math.random=originalRandom}
  assert.deepEqual(frozen,before);assert.deepEqual(snapshotGame(after),before);assert.equal(after.rng,before.rng)
 }})
 assert.deepEqual(snapshotGame(game),baseline.finalSnapshot)
 assert.deepEqual([game.phase,game.wave],['won',12])
 assert.equal(game.lifeVersion,1);assert.equal(game.lifeFailed,false)
 assert.ok(game.baseHp>=0 && game.baseHp<=game.maxBaseHp)
 assert.deepEqual(game.rewards,[]);assert.deepEqual(game.shop,[]);assert.equal(game.lastSettlement,null)
 assert.equal(game.rng,baseline.finalSnapshot.rng)
})
