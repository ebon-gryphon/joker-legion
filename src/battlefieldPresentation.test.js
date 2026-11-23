import test from 'node:test'
import assert from 'node:assert/strict'
import {sampleUnitPresentation,filterPresentationEffects,paintUnitPresentation,PRESENTATION_DURATIONS} from './battlefieldPresentation.js'
import {drawUnit} from './battlefieldUnits.js'
import {createGame,addUnit,beginBattle,tick,snapshotGame,restoreGame} from './engine.js'
import {presentationPhrase,createAudio} from './audio.js'

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const soldier=(id='ally',type='knight',grade=4)=>({id,side:'ally',type,grade,level:1,pattern:type==='healer'?'pair':type==='ranger'?'three':'high',jobId:type==='healer'?'priest':type==='ranger'?'archer':'blade',suit:'♠',rank:'2',x:295,y:208,hp:100,maxHp:100,shield:0,impactAt:-100})
function canvas(){const commands=[],target={globalAlpha:1};return {commands,c:new Proxy(target,{get:(o,key)=>key in o?o[key]:(...args)=>commands.push([key,...args]),set:(o,key,value)=>(o[key]=value,true)})}}

test('only the actual field recruit reveals; legendary never starts the whole-army cheer',()=>{
 const unit=freeze(soldier()),other=freeze(soldier('other'))
 const p=freeze({active:true,reveal:{active:true,unitId:unit.id,grade:4,placement:'field',elapsedMs:210},cheer:{active:true,grade:4,unitIds:[unit.id,other.id],elapsedMs:400}})
 const revealed=sampleUnitPresentation(unit,p)
 assert.ok(revealed.reveal>0);assert.equal(revealed.cheer,0);assert.equal(revealed.pose,null)
 assert.equal(sampleUnitPresentation(other,p),null)
 assert.equal(sampleUnitPresentation(unit,{...p,reveal:{...p.reveal,placement:'reserve'}}),null)
 assert.equal(sampleUnitPresentation(unit,{...p,reveal:{...p.reveal,elapsedMs:420}}),null)
})

test('accepted mythic cheers stagger 100–300ms, end in one second, and use a shorter repeat',()=>{
 const units=['knight','ranger','healer','mage','knight'].map((type,i)=>freeze(soldier('a'+i,type,i===0?5:0)))
 const p={active:true,cheer:{active:true,grade:5,full:true,unitIds:units.map(u=>u.id)}}
 assert.equal(sampleUnitPresentation(units[0],{...p,cheer:{...p.cheer,elapsedMs:90}}),null)
 assert.ok(sampleUnitPresentation(units[0],{...p,cheer:{...p.cheer,elapsedMs:125}})?.pose)
 assert.equal(sampleUnitPresentation(units[1],{...p,cheer:{...p.cheer,elapsedMs:125}}),null)
 const samples=units.map(u=>sampleUnitPresentation(u,{...p,cheer:{...p.cheer,elapsedMs:400}}))
 assert.ok(samples.every(s=>s.cheer>0))
 assert.deepEqual(samples.slice(0,3).map(s=>s.pose.gesture),['standard','offer','rise'])
 assert.ok(samples.every(s=>s.pose.x===0 && s.pose.y===0 && s.pose.gait===0))
 assert.equal(sampleUnitPresentation(units[0],{...p,cheer:{...p.cheer,elapsedMs:1000}}),null)
 assert.equal(sampleUnitPresentation(units[0],{...p,cheer:{...p.cheer,full:false,elapsedMs:420}}),null)
 assert.equal(PRESENTATION_DURATIONS.cheer,1000)
})

test('skip, reduced motion and disabled presentation clear pending silhouettes and all transient marks',()=>{
 const unit=freeze(soldier()),p={active:true,pendingUnitIds:[unit.id],reveal:{unitId:unit.id,grade:4,placement:'field',elapsedMs:210}}
 assert.equal(sampleUnitPresentation(unit,p).pending,true)
 for(const config of [{skip:true},{reducedMotion:true},{active:false}])assert.equal(sampleUnitPresentation(unit,{...p,...config}),null)
})

test('pending artwork keeps original hit geometry and never mutates the accepted unit',()=>{
 const unit=freeze(soldier()),sample=freeze({x:unit.x,y:unit.y,walking:false,pendingDamage:0}),before=structuredClone(unit)
 const base=canvas(),masked=canvas(),labels=[],pendingLabels=[]
 const args=[unit,sample,0,0,n=>n,new Map(),0,true,null,0,false,null,null,null]
 const bounds=drawUnit(base.c,...args,labels)
 const pending=drawUnit(masked.c,...args,pendingLabels,{pending:true})
 assert.deepEqual(pending,bounds);assert.equal(pendingLabels.find(l=>l.unit===unit.id).text,'正在集结')
 assert.deepEqual(unit,before)
})

test('legacy recruitment effects are filtered by view without touching unrelated combat effects',()=>{
 const unit=freeze(soldier()),effects=freeze([{type:'summon',x:295,y:208},{type:'burst',x:295,y:188,text:'传说刀兵'},
  {type:'burst',x:295,y:188,text:'有效治疗'},{type:'burst',x:220,y:180,text:'整备'},{type:'damage',x:295,y:188,amount:10}])
 const p=freeze({active:true,pendingUnitIds:[unit.id]})
 const filtered=filterPresentationEffects(effects,[unit],p)
 assert.deepEqual(filtered,effects.slice(2));assert.equal(effects.length,5)
 assert.equal(filterPresentationEffects(effects,[unit],{...p,skip:true}),effects)
 assert.equal(filterPresentationEffects(effects,[unit],{active:true,reveal:{unitId:unit.id,grade:4,placement:'field',elapsedMs:500}}),effects)
})

test('only measured action cues flash, and foot marks never draw text over names',()=>{
 const unit=freeze(soldier()),p=freeze({active:true,cues:[{unitId:unit.id,kind:'heal',actual:false,elapsedMs:10}]})
 assert.equal(sampleUnitPresentation(unit,p),null)
 const actual=sampleUnitPresentation(unit,{...p,cues:[{...p.cues[0],actual:true}]})
 assert.equal(actual.cue,'heal');assert.ok(actual.flash>0)
 assert.ok(sampleUnitPresentation(unit,{active:false,cues:[{...p.cues[0],actual:true}]}).flash>0)
 assert.equal(sampleUnitPresentation(unit,{active:false,skip:true,cues:[{...p.cues[0],actual:true}]}),null)
 const surface=canvas();paintUnitPresentation(surface.c,unit,freeze(actual),295,208,54,49,{layer:'over'})
 assert.ok(surface.commands.length>0);assert.ok(surface.commands.every(([name])=>!['fillText','strokeText'].includes(name)))
 assert.equal(sampleUnitPresentation(unit,{...p,cues:[{...p.cues[0],actual:true,elapsedMs:180}]}),null)
})

test('presentation on, off, skip and fast external clocks leave complete battle snapshots and RNG identical',()=>{
 const baseline=createGame({seed:'pure-battlefield-presentation'})
 for(const type of ['knight','healer','ranger'])addUnit(baseline,type,'ally',2)
 beginBattle(baseline);const shown=restoreGame(snapshotGame(baseline)),surface=canvas()
 for(let i=0;i<150;i++){
  tick(baseline,1/30);tick(shown,1/30)
  const ids=shown.allies.map(u=>u.id),p={active:i%4!==0,skip:i%4===1,reducedMotion:i%4===2,elapsedMs:i*16*(i%4===3?2:1),
    pendingUnitIds:i<4?ids.slice(0,1):[],order:{unitIds:ids,elapsedMs:(i*16)%440},cheer:{grade:5,unitIds:ids,elapsedMs:(i*16)%1000}}
  const effects=filterPresentationEffects(shown.effects,shown.allies,p)
  for(const unit of shown.allies)paintUnitPresentation(surface.c,unit,sampleUnitPresentation(unit,p),unit.x,unit.y,54,49)
  assert.ok(Array.isArray(effects))
  assert.deepEqual(snapshotGame(shown),snapshotGame(baseline))
 }
})

test('presentation audio is short, rejects legendary cheers and can be cancelled without cancelling ordinary cues',()=>{
 assert.deepEqual(presentationPhrase('cheer',{grade:4}),[])
 for(const kind of ['reveal','cheer','order','first-action'])for(const full of [true,false]){
  const phrase=presentationPhrase(kind,{grade:6,full})
  assert.ok(phrase.length>0 && phrase.length<=4)
  assert.ok(phrase.every(([,duration,at,,volume])=>duration+at<1 && volume<=.025))
 }
 const previousWindow=globalThis.window,oscillators=[]
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}})
 class Context{constructor(){this.currentTime=1;this.state='running';this.destination={}}createGain(){return {gain:param(),connect(){},disconnect(){}}}createOscillator(){const o={frequency:param(),connect(){},disconnect(){},start(){},stops:[],stop(t){this.stops.push(t)}};oscillators.push(o);return o}close(){return Promise.resolve()}}
 globalThis.window={AudioContext:Context}
 try{
  const audio=createAudio();assert.equal(audio.presentationCue('cheer',{grade:4}),false);assert.equal(oscillators.length,0)
  audio.play('deploy');const ordinary=oscillators.slice()
  assert.equal(audio.presentationCue('cheer',{grade:5}),true);const newVoices=oscillators.slice(ordinary.length)
  audio.quietPresentation();assert.ok(ordinary.every(o=>o.stops.length===1));assert.ok(newVoices.every(o=>o.stops.length===2))
  audio.setEnabled(false);const count=oscillators.length;assert.equal(audio.presentationCue('order'),false);assert.equal(oscillators.length,count);audio.destroy()
 }finally{globalThis.window=previousWindow}
})

test('the replaced quality burst stays suppressed after reveal expiry, skip or reduced motion without hiding actual first-action effects',()=>{
 const unit=freeze(soldier('accepted', 'knight',5)),effects=freeze([
  {type:'burst',x:295,y:186,text:'神话降临'},{type:'burst',x:295,y:188,text:'传说刀兵'},
  {type:'burst',x:295,y:196,text:'传说号令'},{type:'burst',x:310,y:186,text:'神话降临'},
 ])
 for(const flags of [{active:false},{active:true,skip:true},{active:true,reducedMotion:true},{active:true,reveal:{active:true,unitId:unit.id,placement:'field',grade:5,elapsedMs:800}}]){
  const p=freeze({...flags,suppressedUnitIds:[unit.id]})
  assert.deepEqual(filterPresentationEffects(effects,[unit],p),effects.slice(2))
 }
 assert.equal(effects.length,4)
})

test('a reserve recipient suppresses its legacy floor burst without creating a renderable sixth soldier',()=>{
 const field=freeze(soldier('field')),reserve=freeze({...soldier('reserve','knight',5),x:106.75,y:298.85})
 const effects=freeze([{type:'burst',x:106.75,y:276.85,text:'神话降临'}])
 const p=freeze({active:true,suppressedUnitIds:[reserve.id],reveal:{active:true,unitId:reserve.id,grade:5,placement:'reserve',elapsedMs:200}})
 assert.deepEqual(filterPresentationEffects(effects,[field,reserve],p),[])
 assert.equal(sampleUnitPresentation(field,p),null)
 assert.equal(sampleUnitPresentation(reserve,p),null)
 assert.equal(effects.length,1)
})

test('exact accepted quality effect IDs remain replaceable after camp rearrangement without touching another effect at that position',()=>{
 const leader=freeze({...soldier('leader','knight',5),x:295,y:208})
 const effects=freeze([{id:'accepted-quality',type:'burst',x:125,y:272,text:'神话降临'},
  {id:'other-quality',type:'burst',x:125,y:272,text:'神话降临'},
  {id:'actual-guard',type:'burst',x:295,y:196,text:'传说号令'}])
 for(const flags of [{active:false},{active:true,skip:true},{active:true,reducedMotion:true}]){
  const p=freeze({...flags,suppressedEffectIds:['accepted-quality']})
  assert.deepEqual(filterPresentationEffects(effects,[leader],p),effects.slice(1))
 }
 assert.equal(effects.length,3)
})
