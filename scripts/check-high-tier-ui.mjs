#!/usr/bin/env node
// Isolated browser QA. Visual specimens are never inserted into a playable game.
// LEGION_HIGH_TIER_SCENARIOS=art,ui,route; LEGION_HIGH_TIER_ALLOW_MISSING=1 captures the old-art fallback.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {restoreGame,forgeUnit,snapshotGame} from '../src/engine.js'

const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'output')
const groups=new Set((process.env.LEGION_HIGH_TIER_SCENARIOS || 'art,ui,route').split(','))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),results=[],errors=[]
const fixture=async name=>JSON.parse(await readFile(join(output,'presentation-fixtures',name+'-before.json'),'utf8'))
const mythic=await fixture('mythic'),prismatic=await fixture('prismatic')
let chrome,vite,ws,url=process.env.LEGION_TEST_URL
await mkdir(output,{recursive:true})
if(!url){try{if((await fetch('http://127.0.0.1:5187/')).ok)url='http://127.0.0.1:5187/'}catch{}}
if(!url){url='http://127.0.0.1:5191/';vite=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5191','--strictPort'],{cwd:root,stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await pause(100)}}
const profile=await mkdtemp(join(tmpdir(),'legion-high-tier-'))
const binary=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync)
assert.ok(binary,'Chrome required; set LEGION_CHROME_BINARY')
chrome=spawn(binary,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})

async function browserArtProbe(allowMissing,earnedSnapshot,fusedUnits){
 const [sprites,art,poses,performances,rig,units,battlefield]=await Promise.all([
  import('/src/spriteAtlas.js'),import('/src/highTierArt.js'),import('/src/choreography.js'),import('/src/performance.js'),
  import('/src/articulatedSprites.js'),import('/src/battlefieldUnits.js'),import('/src/battlefield.js')])
 const subscription=sprites.loadFactionAtlases(),records=subscription.records
 for(let i=0;i<200;i++){
  if(records.get('uniforms')?.ready && (records.get(art.HIGH_TIER_ATLAS)?.ready || allowMissing))break
  await new Promise(resolve=>setTimeout(resolve,50))
 }
 if(!records.get('uniforms')?.ready)throw Error('Base uniform atlas did not load')
 const newArt=records.get(art.HIGH_TIER_ATLAS),atlasReady=!!newArt?.ready
 if(!atlasReady&&!allowMissing)throw Error('New four-profession atlas not ready; keep the fallback evidence separate from acceptance')
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
 const copy=value=>JSON.parse(JSON.stringify(value))
 const hash=pixels=>{let h=2166136261;for(const n of pixels)h=Math.imul(h^n,16777619);return (h>>>0).toString(16)}
 const pngs=[],stats=[],fallback=[]
 const make=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas}
 const pixelHash=canvas=>hash(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)
 const save=(name,canvas)=>pngs.push({name,data:canvas.toDataURL('image/png').split(',')[1]})
 const names={sovereign:'御前君主',priest:'随军牧师',shield:'盾卫',archer:'长弓手'}
 const descriptor=(look,grade)=>freeze({id:'art-specimen-'+look.job,side:'ally',jobId:look.job,pattern:look.role,type:look.job==='priest'?'healer':look.job==='archer'?'ranger':'knight',
  grade,level:1,suit:look.job==='priest'?'♥':look.job==='archer'?'♣':'♠',rank:'K',hp:100,maxHp:100,shield:0,x:200,y:200,impactAt:-100})
 const normalHeight=grade=>49+(grade>=4?3:0)
 for(const grayscale of [false,true]){
  const board=make(760,540),c=board.getContext('2d');c.fillStyle='#211c2b';c.fillRect(0,0,board.width,board.height)
  c.fillStyle='#efe1c4';c.font='16px system-ui';c.fillText('四职业 · 原战场尺寸（1星，54×49/52逻辑像素）'+(grayscale?' · Canvas灰度':''),20,28)
  c.font='12px system-ui';c.fillText('美术样本，不是注入游戏的成品兵；所有品质共用原关节和脚底锚点。',20,49)
  for(const [row,look] of art.HIGH_TIER_PROTOTYPES.entries()){
   c.fillStyle='#ddc8a5';c.fillText(names[look.job],18,96+row*110)
   for(const [column,grade] of [0,4,5,6].entries()){
    const unit=descriptor(look,grade),profile=performances.performanceOf(unit),pose=poses.restingPose(profile,0,0),x=160+column*145,y=80+row*110
    c.fillStyle='#bfaec5';c.fillText(['普通','','','','传说','神话','棱彩'][grade]+' · '+grade,x-8,y)
    c.save();if(grayscale)c.filter='grayscale(1)'
    if(!sprites.drawCardSprite(c,unit,x,y+10,54,normalHeight(grade),{combat:true,pose}))throw Error('Sprite failed '+look.job+'/'+grade)
    c.restore()
   }
  }
  save((atlasReady?'normal':'fallback-before')+'-tiers'+(grayscale?'-grayscale':''),board)
 }
 for(const look of art.HIGH_TIER_PROTOTYPES){
  for(const grayscale of [false,true]){
   const board=make(1056,270),c=board.getContext('2d');c.fillStyle='#211c2b';c.fillRect(0,0,board.width,board.height);c.fillStyle='#efdfc3';c.font='16px system-ui'
   c.fillText(names[look.job]+' · 原战场52px · 动作使用既有权威contact'+(grayscale?' · Canvas灰度':''),18,25)
   for(const [row,grade] of [5,6].entries()){
    const unit=descriptor(look,grade),profile=performances.performanceOf(unit)
    const samples=[['待机',poses.restingPose(profile,0,0)],['迈步左',poses.walkingPose(profile,0,Math.PI/2)],['迈步右',poses.walkingPose(profile,0,-Math.PI/2)],
     ['受击',poses.restingPose(profile,0,0,.18)],['蓄力',poses.actionPose(profile,profile.windup*.65)],['挥出',poses.actionPose(profile,profile.windup*.9)],
     ['命中',poses.actionPose(profile,profile.windup)],['收势',poses.actionPose(profile,profile.windup+profile.release*.6)]]
    c.font='12px system-ui';c.fillStyle='#ddc8a5';c.fillText(grade===5?'神话':'棱彩',16,90+row*110)
    for(const [column,[label,pose]] of samples.entries()){
     const x=104+column*118,y=48+row*110
     c.fillStyle='#baa9c1';c.fillText(label,x,y)
     c.save();if(grayscale)c.filter='grayscale(1)';sprites.drawCardSprite(c,unit,x,y+12,54,52,{combat:true,pose});c.restore()
     if(!grayscale)stats.push({job:look.job,grade,phase:label,contact:pose.contact || 0,backWeight:pose.backWeight || 0})
    }
   }
   save((atlasReady?'actions-':'fallback-actions-')+look.job+(grayscale?'-grayscale':''),board)
  }
 }
 for(const grayscale of [false,true]){
  const board=make(1000,600),c=board.getContext('2d');c.fillStyle='#211c2b';c.fillRect(0,0,board.width,board.height);c.fillStyle='#efe0c2';c.font='16px system-ui'
  c.fillText('四职业 · 放大关节模型 / 冠、背、甲、主手'+(grayscale?' · Canvas灰度':''),20,26)
  for(const [column,look] of art.HIGH_TIER_PROTOTYPES.entries())for(const [row,grade] of [5,6].entries()){
   const unit=descriptor(look,grade),x=column*245+28,y=row*270+55,profile=performances.performanceOf(unit)
   c.font='13px system-ui';c.fillStyle='#d9c3a5';c.fillText(names[look.job]+' · '+(grade===5?'神话':'棱彩'),x,y)
   c.save();if(grayscale)c.filter='grayscale(1)';sprites.drawCardSprite(c,unit,x+12,y+22,174,205,{combat:true,pose:poses.restingPose(profile,0,0)});c.restore()
  }
  save('large-rigs'+(grayscale?'-grayscale':''),board)
 }
 const fusionFacts=[]
 for(const grayscale of [false,true]){
  const board=make(1100,390),c=board.getContext('2d');c.fillStyle='#211c2b';c.fillRect(0,0,board.width,board.height);c.fillStyle='#eddfc3';c.font='15px system-ui'
  c.fillText('真实既有路线合编成员 · 原战场尺寸 + 主将画布 · 仅读保存的fusionJobs'+(grayscale?' · 灰度':''),18,25)
  for(const [column,input] of fusedUnits.entries()){
   const unit=freeze(copy(input)),before=JSON.stringify(unit),frame=freeze(sprites.getSpriteFrame(unit)),modules=art.highTierFusionModules(frame),profile=performances.performanceOf(unit)
   const x=column*270+18,height=49+Math.min(2,(unit.level || 1)-1)*3+(unit.grade>=4?3:0)
   c.fillStyle='#d7c0a3';c.font='12px system-ui';c.fillText(unit.name+' · '+unit.grade,x,52)
   c.font='9px system-ui';c.fillText((unit.fusionJobs || [unit.jobId]).join('/'),x,71,252)
   c.save();if(grayscale)c.filter='grayscale(1)';sprites.drawCardSprite(c,unit,x+24,87,54,height,{combat:true,pose:poses.restingPose(profile,0,0)});c.restore()
   c.fillStyle='#a9b6bf';c.fillText('模块 '+modules.map(module=>module.job).join(' / '),x,280,250)
   const portrait=make(142,160);if(grayscale)portrait.getContext('2d').filter='grayscale(1)';sprites.drawCardSprite(portrait.getContext('2d'),unit,0,0,142,160)
   c.drawImage(portrait,x+96,90)
   if(JSON.stringify(unit)!==before)throw Error('Fusion artwork mutated saved professions')
   if(!grayscale)fusionFacts.push({id:unit.id,grade:unit.grade,jobs:unit.fusionJobs || [unit.jobId],modules:modules.map(module=>module.job)})
  }
  save('legal-fusions'+(grayscale?'-grayscale':''),board)
 }
 const moduleMatrix=[]
 const secondaryJobs=[['priest','牧师'],['shield','盾卫'],['archer','游侠'],['fire','焰术师'],['assassin','刺客']]
 for(const grade of [5,6])for(const grayscale of [false,true]){
  const board=make(1370,1050),c=board.getContext('2d');c.fillStyle='#211c2b';c.fillRect(0,0,board.width,board.height);c.fillStyle='#ecdec0';c.font='16px system-ui'
  c.fillText('四主职 × 副职模块 · '+(grade===5?'神话':'棱彩')+(grayscale?' · Canvas灰度':''),18,27)
  c.font='12px system-ui';c.fillText('合法职业组合的美术样本，不注入game；左为原战场52px，右为放大模型；同职无副模块。',18,49)
  for(const [column,[secondary,label]] of secondaryJobs.entries()){c.fillStyle='#dbc3a2';c.font='14px system-ui';c.fillText('副职 · '+label,135+column*245,77)}
  for(const [row,look] of art.HIGH_TIER_PROTOTYPES.entries()){
   c.font='13px system-ui';c.fillStyle='#dbc3a2';c.fillText(names[look.job],15,153+row*235)
   for(const [column,[secondary,label]] of secondaryJobs.entries()){
    const jobs=look.job===secondary?[look.job]:[look.job,secondary]
    const unit=freeze({...descriptor(look,grade),fusionJobs:jobs}),before=JSON.stringify(unit),frame=freeze(sprites.getSpriteFrame(unit)),modules=art.highTierFusionModules(frame)
    if(modules.length!==(look.job===secondary?0:1) || modules.some(module=>!jobs.slice(1).includes(module.job)))throw Error('Unexpected fusion module for '+jobs.join('+'))
    const x=120+column*245,y=100+row*235,profile=performances.performanceOf(unit)
    c.fillStyle='#aeb5be';c.font='10px system-ui';c.fillText(look.job===secondary?'同职 · 无副模块':look.job+' + '+secondary,x,y)
    c.save();if(grayscale)c.filter='grayscale(1)'
    sprites.drawCardSprite(c,unit,x+4,y+23,54,52,{combat:true,pose:poses.restingPose(profile,0,0)})
    sprites.drawCardSprite(c,unit,x+72,y+15,142,160,{pose:poses.restingPose(profile,0,0)})
    c.restore();c.fillStyle='#aab8bf';c.fillText(modules.length?'实际模块 '+modules.map(module=>module.job).join('/'):'无副模块',x,y+193)
    if(JSON.stringify(unit)!==before)throw Error('Module matrix mutated fusionJobs')
    if(!grayscale)moduleMatrix.push({primary:look.job,secondary,grade,jobs,modules:modules.map(module=>module.job)})
   }
  }
  save('module-matrix-'+grade+(grayscale?'-grayscale':''),board)
 }
 // Compare the actual rig against the same records without the new overlays.
 const oldRecords=new Map(records);oldRecords.delete(art.HIGH_TIER_ATLAS)
 const coreJobs={blade:'high',pike:'twoPair',cavalry:'straight',fire:'flush',assassin:'four',outrider:'straightFlush',duelist:'five',ward:'flushHouse'}
 for(const [job,role] of Object.entries({...Object.fromEntries(art.HIGH_TIER_PROTOTYPES.map(look=>[look.job,look.role])),...coreJobs})){
  for(const grade of [0,4,5,6]){
   const look={job,role},unit=descriptor(look,grade),frame=freeze(sprites.getSpriteFrame(unit)),profile=performances.performanceOf(unit)
   const pose=freeze(poses.actionPose(profile,profile.windup)),current=make(130,150),old=make(130,150)
   rig.drawArticulatedUniform(current.getContext('2d'),records,frame,20,30,54,normalHeight(grade),{combat:true,pose})
   rig.drawArticulatedUniform(old.getContext('2d'),oldRecords,frame,20,30,54,normalHeight(grade),{combat:true,pose})
   const same=pixelHash(current)===pixelHash(old),upgraded=!!art.highTierVisualForFrame(frame)
   if(!upgraded&&!same)throw Error('Existing art changed for '+job+'/'+grade)
   if(upgraded&&atlasReady&&same)throw Error('Loaded upgrade did not affect '+job+'/'+grade)
   fallback.push({job,grade,upgraded,sameAsFallback:same})
  }
 }
 // A legal committed grade-5 soldier, including all real fused professions.
 const frozen=freeze(copy(earnedSnapshot)),unchanged=JSON.stringify(frozen),frozenRng=frozen.rng
 const battlefieldCanvas=make(1366,900);battlefieldCanvas.style.cssText='width:1366px;height:900px;position:fixed;left:0;top:0;visibility:hidden';document.body.append(battlefieldCanvas)
 const renderer=battlefield.createBattlefield(battlefieldCanvas)
 const originalRandom=Math.random;let withArt,withoutArt,picksWith,picksWithout
 const pick=geometry=>{const rect=battlefieldCanvas.getBoundingClientRect();return geometry.units.map(box=>renderer.pickUnit(rect.left+geometry.left+(box.left+box.right)*.5*geometry.scale,rect.top+geometry.top+(box.top+box.bottom)*.5*geometry.scale,'ally'))}
 try{
  Math.random=()=>{throw Error('A render attempted to roll RNG')}
  renderer.resize();renderer.render(frozen,{time:1,paused:true,reducedMotion:true});withArt=renderer.deploymentGeometry();picksWith=pick(withArt)
  if(newArt)newArt.ready=false
  renderer.render(frozen,{time:1,paused:true,reducedMotion:true});withoutArt=renderer.deploymentGeometry();picksWithout=pick(withoutArt)
  if(JSON.stringify(withArt)!==JSON.stringify(withoutArt) || JSON.stringify(picksWith)!==JSON.stringify(picksWithout))throw Error('Artwork changed field geometry or picking')
  for(const look of art.HIGH_TIER_PROTOTYPES)for(const grade of [0,4,5,6]){
   const unit=descriptor(look,grade),sample=freeze({x:200,y:200,walking:false,pendingDamage:0}),canvas=make(400,300)
   const bound=units.drawUnit(canvas.getContext('2d'),unit,sample,1,0,y=>y,new Map(),0,true,null,1,false,null,null,null,[])
   if(JSON.stringify(bound)!==JSON.stringify({id:unit.id,side:'ally',left:173,right:227,top:200-normalHeight(grade),bottom:203}))throw Error('Original drawUnit hitbox changed '+look.job+'/'+grade)
  }
 }finally{Math.random=originalRandom;if(newArt)newArt.ready=atlasReady;renderer.destroy();battlefieldCanvas.remove()}
 if(JSON.stringify(frozen)!==unchanged || frozen.rng!==frozenRng)throw Error('Drawing changed a frozen legal snapshot')
 subscription.dispose()
 return {atlasReady,images:pngs,phases:stats,fallback,fusionFacts,moduleMatrix,snapshotUnchanged:true,rngUnchanged:true,hitboxUnchanged:true,pickUnitUnchanged:true}
}

try{
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const [resolve,reject]=pending.get(message.id);pending.delete(message.id);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)}
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}))})
 const run=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);return result.result.value}
 const wait=async(expression,count=160)=>{for(let i=0;i<count;i++){if(await run(expression))return;await pause(35)}throw Error('Timeout '+expression)}
 const click=async css=>{await wait('document.querySelector('+JSON.stringify(css)+')?.getClientRects().length && !document.querySelector('+JSON.stringify(css)+').disabled');const point=await run(`(()=>{const e=document.querySelector(${JSON.stringify(css)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`);assert.ok(point.hit,css+' is obscured');for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});await pause(20)}
 const shot=async name=>{const image=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'high-tier-'+name+'.png'),Buffer.from(image.data,'base64'))}
 const saved=()=>run("JSON.parse(localStorage.getItem('joker.legion.demo.v1'))")
 const setup=expression=>run(`(()=>{const s=document.querySelector('.scene-shell').__vueParentComponent.setupState;return (${expression})})()`)
 const openForge=async()=>{if(await run("!!document.querySelector('.scene-close')"))await click('.scene-close');await click('.scene-tools button[data-tool=forge]')}
 await send('Runtime.enable');await send('Page.enable')
 const boot=async(snapshot,width=1366,height=900,reduced=false)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<550})
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]})
  const source='localStorage.clear();'+(snapshot?'localStorage.setItem("joker.legion.demo.v1",'+JSON.stringify(JSON.stringify({...snapshot,handSelection:'manual'}))+')':'')
  const injection=await send('Page.addScriptToEvaluateOnNewDocument',{source});await send('Page.navigate',{url});await wait("!!document.querySelector('.cover-start')");await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier})
  if(snapshot){await click('.deal-resume');await wait("!!document.querySelector('.scene-shell')")}
 }
 const persist=async()=>{
  let prior=[];try{prior=JSON.parse(await readFile(join(output,'high-tier-ui-verification.json'),'utf8')).results || []}catch{}
  const merged=new Map(prior.map(row=>[row.scenario,row]));for(const row of results)merged.set(row.scenario,row)
  await writeFile(join(output,'high-tier-ui-verification.json'),JSON.stringify({url,at:new Date().toISOString(),results:[...merged.values()],errors},null,2)+'\n')
 }
 const scenario=async(name,work)=>{if(!groups.has(name))return;const start=Date.now();try{const detail=await work();results.push({scenario:name,status:'passed',elapsedMs:Date.now()-start,...detail});console.log(JSON.stringify({scenario:name,status:'passed',elapsedMs:Date.now()-start,atlasReady:detail.atlasReady,artifacts:detail.artifacts?.length,cases:detail.records?.length,ending:detail.ending}))}catch(error){results.push({scenario:name,status:'failed',elapsedMs:Date.now()-start,error:String(error.stack || error)});try{await shot(name+'-failure')}catch{}console.error(name+': '+error);process.exitCode=1}await persist()}
 await scenario('art',async()=>{
  await boot(null)
  const legal=restoreGame(mythic.snapshot);assert.ok(forgeUnit(legal,mythic.action.params.leaderId,mythic.action.params.donorId,'ascend'))
  const prism=restoreGame(prismatic.snapshot);assert.ok(forgeUnit(prism,prismatic.action.params.leaderId,prismatic.action.params.donorId,'ascend'))
  const runEvidence=JSON.parse(await readFile(join(output,'build-verification.json'),'utf8')).routes[0]
  const fusedUnits=[legal.allies.find(unit=>unit.id===mythic.action.params.leaderId),prismatic.snapshot.allies.find(unit=>unit.id===prismatic.action.params.leaderId),prism.allies.find(unit=>unit.id===prismatic.action.params.leaderId),runEvidence.finalSnapshot.allies.find(unit=>unit.grade===6)]
  const record=await run('('+browserArtProbe.toString()+')('+JSON.stringify(process.env.LEGION_HIGH_TIER_ALLOW_MISSING==='1')+','+JSON.stringify(snapshotGame(legal))+','+JSON.stringify(fusedUnits)+')')
  for(const image of record.images)await writeFile(join(output,'high-tier-'+image.name+'.png'),Buffer.from(image.data,'base64'))
  const {images,...facts}=record;return {...facts,artifacts:images.map(image=>'output/high-tier-'+image.name+'.png'),acceptance:record.atlasReady?'new art loaded':'baseline fallback only; not new-art acceptance'}
 })
 await scenario('ui',async()=>{
  const records=[]
  const projectionAudit=async()=>{
   await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
   const projection=await setup(`(()=>{const r=s.renderer?.__v_isRef?s.renderer.value:s.renderer;if(!r?.deploymentGeometry)return {available:false};const g=r.deploymentGeometry(),origin=document.querySelector('.battle-canvas').getBoundingClientRect(),panel=document.querySelector('.scene-panel').getBoundingClientRect();const card={left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom};const intersect=a=>Math.max(0,Math.min(a.right,card.right)-Math.max(a.left,card.left))*Math.max(0,Math.min(a.bottom,card.bottom)-Math.max(a.top,card.top));return {available:true,panel:card,viewport:g.viewport,scale:g.scale,units:g.units.map(u=>{const bounds={left:origin.left+g.left+u.left*g.scale,top:origin.top+g.top+u.top*g.scale,right:origin.left+g.left+u.right*g.scale,bottom:origin.top+g.top+u.bottom*g.scale};return {id:u.id,...bounds,overlapArea:intersect(bounds)}}),names:g.names.map(n=>{const bounds={left:origin.left+n.x-n.half,top:origin.top+n.y-n.size,right:origin.left+n.x+n.half,bottom:origin.top+n.y+2};return {id:n.id,text:n.text,...bounds,overlapArea:intersect(bounds)}})}})()`)
   assert.ok(projection.available,'The actual renderer geometry is required for occlusion QA')
   const covered=[...projection.units,...projection.names].filter(box=>box.overlapArea>0)
   assert.deepEqual(covered,[],'Hero card covers actual soldier bodies/names: '+JSON.stringify({panel:projection.panel,covered}))
   return projection
  }
  for(const [width,height] of [[1366,900],[390,844],[360,740],[844,390],[768,1024]])for(const [name,f] of [['mythic',mythic],['prismatic',prismatic]]){
   await boot(f.snapshot,width,height);await openForge();const before=await saved()
   assert.equal(await setup('s.forge('+JSON.stringify(f.action.params.leaderId)+','+JSON.stringify(f.action.params.donorId)+',"ascend")'),true)
   const accepted=await saved(),acceptedAt=Date.now();await wait('!!document.querySelector(".high-tier-reveal[data-high-tier-grade=\\"'+f.expected.grade+'\\"]")')
   const projection=await projectionAudit()
   assert.equal(await run("!!document.querySelector('.forge-header')"),false,'Hero reveal must replace the multi-root CampRoster')
   assert.equal(await run("document.querySelector('.high-tier-portrait').dataset.actualUnitId"),f.action.params.leaderId,'Hero must use the actually retained leader')
   assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'),'Page overflows '+width)
   assert.ok(await run('document.querySelectorAll(".high-tier-key-changes>[data-reveal-stat]").length>0 && document.querySelectorAll(".high-tier-key-changes>[data-reveal-stat]").length<=3'),'Hero reveal must show one to three actual key changes')
   const hero=await run("document.querySelector('.high-tier-reveal').innerText");assert.ok(hero.includes(name==='mythic'?'神话':'棱彩'))
   await wait("(()=>{const e=document.querySelector('.high-tier-commander-model');const c=e?.matches('canvas')?e:e?.querySelector('canvas');if(!c?.width||!c?.height)return false;const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>24)n++;return n>100})()")
   await shot(name+'-'+width+'x'+height)
   if(width===1366 || width===390){await pause(Math.max(0,450-(Date.now()-acceptedAt)));await shot(name+'-'+width+'x'+height+'-actual-cheer')}
   if(width>=1000){
    const gap=await run("(()=>{const panel=document.querySelector('.scene-panel:has(.high-tier-reveal)'),reveal=document.querySelector('.fusion-reveal');return panel.getBoundingClientRect().bottom-reveal.getBoundingClientRect().bottom})()")
    assert.ok(gap>=0&&gap<100,'Desktop reveal retained an empty fixed-height workshop: '+gap)
   }
   await click('.high-tier-details>summary');const detailsProjection=await projectionAudit();await shot(name+'-'+width+'x'+height+'-details')
   assert.deepEqual(await saved(),accepted,'Opening art details changed engine state/RNG')
   await click('.fusion-reveal-controls .key-tab');assert.deepEqual(await saved(),accepted,'2x visual speed changed engine state/RNG')
   await click('.fusion-reveal-controls .key-link');assert.deepEqual(await saved(),accepted,'Skipping hero display changed engine state/RNG')
   await wait("!!document.querySelector('.forge-header')?.getClientRects().length")
   assert.equal(accepted.allies.length+accepted.reserves.length,before.allies.length+before.reserves.length-1)
   records.push({name,width,height,grade:f.expected.grade,wave:accepted.wave,projection,detailsProjection})
  }
  // Reverse the same earned equal-quality materials through the real forge action: the leader stays in reserve.
  await boot(mythic.snapshot,390,844,true);await openForge();const before=await saved()
  assert.equal(await setup('s.forge('+JSON.stringify(mythic.action.params.donorId)+','+JSON.stringify(mythic.action.params.leaderId)+',"ascend")'),true)
  const after=await saved();await wait('!!document.querySelector(".high-tier-reveal[data-high-tier-grade=\\"5\\"]")')
  const reserveProjection=await projectionAudit()
  assert.ok(await run("!!document.querySelector('.high-tier-reveal.motion-off')"),'Reduced motion must reach the new reveal')
  assert.ok(after.reserves.some(unit=>unit.id===mythic.action.params.donorId&&unit.grade===5));assert.equal(after.allies.length,before.allies.length-1)
  assert.ok((await run("document.querySelector('.high-tier-reveal').innerText")).includes('候补'))
  await shot('reserve-mythic-phone-reduced');assert.deepEqual(await saved(),after)
  return {records,reserveProjection,reserveUsesEarnedReverseAscend:true,reducedMotionPreservesSnapshot:true,actualSoldierOcclusionZero:true}
 })
 await scenario('route',async()=>{
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'scripts/check-presentation-ui.mjs')],{cwd:root,env:{...process.env,LEGION_TEST_URL:url,LEGION_UI_SCENARIOS:'journey'},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Full real-ticker journey exit '+code)))})
  const verification=JSON.parse(await readFile(join(output,'presentation-ui-verification.json'),'utf8')),journey=verification.results.find(row=>row.scenario==='journey')
  assert.equal(journey.status,'passed');assert.deepEqual(journey.ending,{phase:'won',wave:12,wavesCleared:12,gate:100,gold:119,kills:164})
  return {source:'scripts/check-presentation-ui.mjs; same-session legal handlers and real ticker',ending:journey.ending}
 })
 assert.deepEqual(errors,[]);await persist()
}finally{ws?.close();chrome?.kill();vite?.kill()}
