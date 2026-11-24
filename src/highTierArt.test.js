import test from 'node:test'
import assert from 'node:assert/strict'
import { drawArticulatedUniform } from './articulatedSprites.js'
import { outfitFrame, UNIFORM_ROLES } from './outfits.js'
import { getSpriteFrame, isUnitAtlas } from './spriteAtlas.js'
import {
  HIGH_TIER_ATLAS, HIGH_TIER_FUSION_ATLAS, HIGH_TIER_PARTS, HIGH_TIER_PROTOTYPES,
  highTierVisualForFrame, highTierArtReady, highTierFusionModules,
  drawHighTierFusionModule,
} from './highTierArt.js'

function context(trace=[]) {
  return new Proxy({trace}, {get(target,key) {
    if(key in target)return target[key]
    return (...args)=>trace.push([key,...args.map(value=>typeof value==='object'?value.id || 'canvas':value)])
  },set(target,key,value){target[key]=value;return true}})
}
let canvasId=0
function canvasDocument() {
  return {createElement(){const canvas={id:`canvas-${++canvasId}`,width:0,height:0};canvas.getContext=()=>context();return canvas}}
}
function artwork(name,frames=8) {
  return {ready:true,image:{id:name},bounds:Array.from({length:frames},(_,index)=>({x:index*20,y:0,width:60,height:100}))}
}
function render(records,frame,pose={state:'idle',gesture:'thrust',breath:.2}) {
  const trace=[],c=context(trace)
  assert.equal(drawArticulatedUniform(c,records,frame,17,29,54,52,{pose}),true)
  return trace
}
function withCanvas(callback) {
  const previous=globalThis.document;globalThis.document=canvasDocument()
  try {return callback()}finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
}

test('eight prototype rows map to isolated part frames and leave all other qualities and professions alone',()=>{
  assert.equal(isUnitAtlas(HIGH_TIER_ATLAS),true)
  const prototypeRoles=new Set(HIGH_TIER_PROTOTYPES.map(look=>look.role))
  const rows=[]
  for(const role of UNIFORM_ROLES)for(let grade=0;grade<=6;grade++) {
    const look=highTierVisualForFrame(outfitFrame(role,grade))
    if(grade<5 || !prototypeRoles.has(role)){assert.equal(look,null);continue}
    rows.push(look.atlasRow)
    for(const [column,part] of HIGH_TIER_PARTS.entries())assert.equal(look.frames[part],look.atlasRow*4+column)
  }
  assert.deepEqual(rows.sort((a,b)=>a-b),[0,1,2,3,4,5,6,7])
  for(const jobId of ['sovereign','priest','shield','archer']) {
    const unit=Object.freeze({side:'ally',jobId,grade:6})
    assert.equal(highTierVisualForFrame(getSpriteFrame(unit)).job,jobId)
  }
})

test('loading the new atlas makes no drawing change to any lower tier or non-prototype profession',()=>withCanvas(()=>{
  const records=new Map([['regalia',artwork('regalia')],['armory',artwork('armory')]])
  const additions=artwork(HIGH_TIER_ATLAS,32),prototypes=new Set(HIGH_TIER_PROTOTYPES.map(look=>look.role))
  for(const role of UNIFORM_ROLES)for(let grade=0;grade<=6;grade++) {
    if(grade>4 && prototypes.has(role))continue
    const frame={...outfitFrame(role,grade),fusionJobs:['blade','archer','priest','shield']}
    records.delete(HIGH_TIER_ATLAS);const original=render(records,frame)
    records.set(HIGH_TIER_ATLAS,additions)
    assert.deepEqual(render(records,frame),original,`${role}/${grade}`)
  }
}))

function primaryGeometry(trace) {
  let matrix=[1,0,0,1,0,0];const stack=[],draws=[]
  const multiply=([a,b,c,d,e,f])=>{
    const [A,B,C,D,E,F]=matrix
    matrix=[A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F]
  }
  for(const [name,...args] of trace) {
    if(name==='save')stack.push([...matrix])
    else if(name==='restore')matrix=stack.pop()
    else if(name==='translate')multiply([1,0,0,1,...args])
    else if(name==='scale')multiply([args[0],0,0,args[1],0,0])
    else if(name==='rotate')multiply([Math.cos(args[0]),Math.sin(args[0]),-Math.sin(args[0]),Math.cos(args[0]),0,0])
    else if(name==='drawImage' && !['armory',HIGH_TIER_FUSION_ATLAS].includes(args[0]))draws.push({args,matrix:[...matrix]})
  }
  return draws
}

test('focused fire and paired-blade accents use four dedicated frames without changing any primary drawing or joint',()=>withCanvas(()=>{
  const records=new Map([['regalia',artwork('regalia')],['armory',artwork('armory')],[HIGH_TIER_ATLAS,artwork(HIGH_TIER_ATLAS,32)]])
  const focused=artwork(HIGH_TIER_FUSION_ATLAS,4),poses=[
    {state:'idle',gesture:'cast',breath:.4},{state:'walk',gesture:'draw',gait:.8},
    {state:'hit',gesture:'bash',flinch:.6},{state:'action',gesture:'standard',backWeight:.8},
    {state:'action',gesture:'draw',contact:.9},{state:'salute',gesture:'rise',salute:1,saluteLift:2,contact:1},
  ]
  for(const look of HIGH_TIER_PROTOTYPES)for(const grade of [5,6])for(const job of ['fire','assassin'])for(const pose of poses) {
    const frame=Object.freeze({...outfitFrame(look.role,grade),fusionJobs:Object.freeze([look.job,job])})
    const module=highTierFusionModules(frame)[0]
    assert.equal(module.focus.atlas,HIGH_TIER_FUSION_ATLAS)
    assert.equal(module.focus.frame,(job==='fire'?0:2)+grade-5)
    records.delete(HIGH_TIER_FUSION_ATLAS);const old=render(records,frame,pose)
    records.set(HIGH_TIER_FUSION_ATLAS,focused);const current=render(records,frame,pose)
    assert.deepEqual(primaryGeometry(current),primaryGeometry(old),`${look.job}/${grade}/${job}/${pose.state}`)
    const parts=current.filter(row=>row[0]==='drawImage' && row[1]===HIGH_TIER_FUSION_ATLAS)
    assert.equal(parts.length,1,'the paired-blade atlas already contains both blades')
    assert.equal(parts[0][2]/20,module.focus.frame)
  }
}))

test('a missing or failed focused accent keeps the old module and all unrelated accents draw identically',()=>withCanvas(()=>{
  const records=new Map([['regalia',artwork('regalia')],['armory',artwork('armory')],[HIGH_TIER_ATLAS,artwork(HIGH_TIER_ATLAS,32)]])
  for(const job of ['fire','assassin']) {
    const frame={...outfitFrame('flushFive',6),fusionJobs:['sovereign',job]},baseline=render(records,frame)
    for(const bad of [{ready:false},{...artwork('failed',4),error:true},artwork('missing',0)]) {
      records.set(HIGH_TIER_FUSION_ATLAS,bad)
      assert.deepEqual(render(records,frame),baseline)
    }
    records.delete(HIGH_TIER_FUSION_ATLAS)
  }
  for(const job of ['priest','shield','archer','ward','pike','cavalry','outrider','duelist','blade']) {
    const frame={...outfitFrame('flushFive',5),fusionJobs:['sovereign',job]},baseline=render(records,frame)
    records.set(HIGH_TIER_FUSION_ATLAS,artwork(HIGH_TIER_FUSION_ATLAS,4))
    assert.deepEqual(render(records,frame),baseline,job)
    records.delete(HIGH_TIER_FUSION_ATLAS)
  }
}))

test('broad accents remain below the face and above the planted foot even in the second module slot',()=>{
  const focused=artwork(HIGH_TIER_FUSION_ATLAS,4)
  focused.bounds.forEach((bounds,index)=>{bounds.width=index<2?65:100})
  const records=new Map([[HIGH_TIER_FUSION_ATLAS,focused]])
  const modules=highTierFusionModules({...outfitFrame('flushFive',6),fusionJobs:['sovereign','fire','assassin']})
  assert.equal(modules.length,2)
  for(const module of modules) {
    const c=context(),bodyHeight=112
    const anchor=module.anchor?[module.anchor[0]*80,module.anchor[1]*bodyHeight]:[80,10]
    assert.equal(drawHighTierFusionModule(c,records,module,anchor,bodyHeight,module.angle),true)
    const move=c.trace.find(row=>row[0]==='translate'),image=c.trace.find(row=>row[0]==='drawImage')
    const top=move[2]+image[7],bottom=top+image[9],normalScale=52/132
    assert.ok(top>=bodyHeight*.22,'fire stays to the side and waist blades stay below the face')
    assert.ok(bottom<bodyHeight,'no accent reaches the ground or the name below it')
    assert.ok(image[8]*normalScale>=12 && image[9]*normalScale>=18,'normal-size accent has a broad readable footprint')
  }
})

test('a missing, failed or incomplete prototype atlas uses the complete existing rig',()=>withCanvas(()=>{
  const records=new Map([['regalia',artwork('regalia')],['armory',artwork('armory')]])
  const frame=outfitFrame('flushFive',6),look=highTierVisualForFrame(frame),baseline=render(records,frame)
  for(const record of [{ready:false},{...artwork('bad',32),error:true},artwork('short',2)]) {
    records.set(HIGH_TIER_ATLAS,record)
    assert.equal(highTierArtReady(record,look),false)
    assert.deepEqual(render(records,frame),baseline)
  }
}))

test('high-tier layers follow the existing head, cloth and hand sockets without changing body scale or frozen input',()=>withCanvas(()=>{
  const records=new Map([['regalia',artwork('regalia')],['armory',artwork('armory')],[HIGH_TIER_ATLAS,artwork(HIGH_TIER_ATLAS,32)]])
  const poses=[
    {state:'idle',gesture:'cast',breath:.4}, {state:'walk',gesture:'draw',gait:.8},
    {state:'hit',gesture:'bash',flinch:.6}, {state:'action',gesture:'standard',backWeight:.8},
    {state:'action',gesture:'draw',contact:.9}, {state:'action',gesture:'rise',contact:.7},
  ]
  for(const prototype of HIGH_TIER_PROTOTYPES)for(const grade of [5,6])for(const pose of poses) {
    const frame=Object.freeze(outfitFrame(prototype.role,grade));Object.freeze(pose)
    const before=JSON.stringify({frame,pose}),trace=render(records,frame,pose),look=highTierVisualForFrame(frame)
    const parts=trace.filter(row=>row[0]==='drawImage' && row[1]===HIGH_TIER_ATLAS)
    assert.deepEqual(parts.map(row=>row[2]/20),[look.frames.back,look.frames.armor,look.frames.head,look.frames.hand])
    assert.deepEqual(trace.filter(row=>row[0]==='scale'),[['scale',Math.min(54/126,52/132),Math.min(54/126,52/132)]])
    assert.equal(trace.some(row=>row[0]==='drawImage' && row[1]==='armory'),false,'primary equipment is replaced rather than stacked')
    assert.equal(JSON.stringify({frame,pose}),before)
    assert.ok(trace.flat().filter(value=>typeof value==='number').every(Number.isFinite))
  }
}))

test('fusion modules keep the primary profession, use two declared distinct silhouettes and never mutate the source list',()=>withCanvas(()=>{
  const fusionJobs=Object.freeze(['sovereign','assassin','archer','shield','priest','fire','pike','cavalry'])
  const frame=Object.freeze({...outfitFrame('flushFive',6),fusionJobs}),before=JSON.stringify(frame)
  const modules=highTierFusionModules(frame)
  assert.deepEqual(modules.map(module=>module.canonical),['priest','shield'])
  assert.equal(modules[0].frame,3*4+1,'priest keeps its ritual backpiece')
  assert.equal(modules[1].frame,5*4+2,'shield keeps its tower-shield piece')
  assert.deepEqual(highTierFusionModules({...frame,fusionJobs:['sovereign','pike','cavalry','assassin']}).map(module=>module.canonical),['pike','assassin'])
  const archer=highTierFusionModules({...frame,fusionJobs:['sovereign','archer']})[0]
  assert.equal(archer.frame,7*4+1,'archer keeps its quiver, not a second full main bow')
  const assassin=highTierFusionModules({...frame,fusionJobs:['sovereign','assassin']})[0]
  assert.equal(assassin.copies,2)
  const records=new Map([['regalia',artwork('regalia')],['armory',artwork('armory')],[HIGH_TIER_ATLAS,artwork(HIGH_TIER_ATLAS,32)]])
  const trace=render(records,frame)
  assert.equal(trace.filter(row=>row[0]==='drawImage' && row[1]===HIGH_TIER_ATLAS).length,6)
  assert.equal(JSON.stringify(frame),before)
  for(const module of modules)assert.ok(module.anchor[1]>=.39,'secondary parts remain below the face')
}))
