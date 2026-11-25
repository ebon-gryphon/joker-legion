#!/usr/bin/env node
// Isolated Chrome. Run groups with LEGION_UI_SCENARIOS=journey|sizes|quality|boss.
// LEGION_TEST_URL overrides dev5187; LEGION_QUEEN_FIXTURE can name a legally earned pulse fixture.
// This script does not attach to the user's Chrome or root's CDP port.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
import {runBuildStrategy,BUILD_ROUTES,replayBuild} from './verify-builds.mjs'
import {snapshotGame,JOKERS} from '../src/engine.js'
import {deriveDeployFacts} from '../src/presentationFacts.js'

const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'output')
const selected=new Set((process.env.LEGION_UI_SCENARIOS || 'journey,sizes,quality,boss').split(','))
const evidence=JSON.parse(await readFile(join(output,'build-verification.json'),'utf8'))
const fixture=async(relative,folder='build-fixtures')=>JSON.parse(await readFile(join(output,folder,relative+'.json'),'utf8'))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),results=[],errors=[]
await mkdir(output,{recursive:true})
let vite,chrome,ws,url=process.env.LEGION_TEST_URL
if(!url){try{if((await fetch('http://127.0.0.1:5187/')).ok)url='http://127.0.0.1:5187/'}catch{}}
if(!url){url='http://127.0.0.1:5191/';vite=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5191','--strictPort'],{cwd:root,stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await pause(100)}}
const profile=await mkdtemp(join(tmpdir(),'legion-presentation-ui-'))
const binary=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync)
assert.ok(binary,'Chrome required; set LEGION_CHROME_BINARY')
chrome=spawn(binary,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
let send,run,wait,click,shot,saved,read,setup
try {
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()
 ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let id=0;const pending=new Map()
 ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const [r,j]=pending.get(message.id);pending.delete(message.id);message.error?j(Error(JSON.stringify(message.error))):r(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)}
 send=(method,params={})=>new Promise((r,j)=>{pending.set(++id,[r,j]);ws.send(JSON.stringify({id,method,params}))})
 run=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);return response.result.value}
 wait=async(expression,limit=140,delay=40)=>{for(let i=0;i<limit;i++){if(await run(expression))return;await pause(delay)}throw Error('Timeout '+expression+' '+await run('document.body.innerText.slice(-1200)'))}
 click=async(css,{delay=35}={})=>{
  await wait(`document.querySelector(${JSON.stringify(css)})?.getClientRects().length && !document.querySelector(${JSON.stringify(css)}).disabled`)
  const point=await run(`(()=>{const e=document.querySelector(${JSON.stringify(css)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`)
  assert.ok(point.hit,css+' is obscured')
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1})
  if(delay)await pause(delay)
 }
 read=css=>run(`document.querySelector(${JSON.stringify(css)})?.innerText || ''`)
 saved=()=>run("JSON.parse(localStorage.getItem('joker.legion.demo.v1'))")
 setup=expression=>run(`(()=>{const raw=document.querySelector('.scene-shell').__vueParentComponent.setupState;const s=new Proxy(raw,{get(target,key){const value=target[key];return value?.__v_isRef?value.value:value}});return (${expression})})()`)
 shot=async name=>{const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'presentation-'+name+'.png'),Buffer.from(screenshot.data,'base64'))}
 await send('Runtime.enable');await send('Page.enable')
 async function textClick(scope,text){
  const found=await run(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(e=>e.getClientRects().length&&!e.disabled&&e.innerText.includes(${JSON.stringify(text)}));if(!e)return false;e.dataset.presentationQa='click';return true})()`)
  assert.ok(found,'Missing enabled button '+text);await click('[data-presentation-qa="click"]');await run("document.querySelector('[data-presentation-qa]')?.removeAttribute('data-presentation-qa')")
 }
 async function boot(snapshot,width=1366,height=900,{reduced=false}={}) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<550})
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]})
  const source=`localStorage.clear();${snapshot?`localStorage.setItem('joker.legion.demo.v1',${JSON.stringify(JSON.stringify({...snapshot,handSelection:'manual'}))});`:''}`
  const script=await send('Page.addScriptToEvaluateOnNewDocument',{source})
  await send('Page.navigate',{url});await wait("!!document.querySelector('.cover-start')")
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier})
  if(snapshot){await click('.deal-resume');await wait("!!document.querySelector('.scene-shell')")}
 }
 async function desk(name) {
  if(await run(`document.querySelector('.scene-shell')?.dataset.desk===${JSON.stringify(name)}`))return
  if(name==='menu'){await click('.scene-menu-key');return}
  if(name==='report'){await desk('menu');await textClick('.scene-menu','战报与本地历史');return}
  if(await run("!!document.querySelector('.scene-close')"))await click('.scene-close')
  await click('.scene-tools button[data-tool="'+name+'"]')
 }
 async function captureStages(prefix) {
  const wanted=new Set(['quality','muster','order']),seen=[],started=Date.now()
  for(let i=0;i<700;i++) {
    const state=await run("(()=>{const e=document.querySelector('.score-sequence');if(!e)return null;const v=e.__vueParentComponent?.setupState?.state;return {focus:e.dataset.presentationFocus || e.dataset.sequenceFocus || v?.focus,done:e.dataset.complete==='true',revealed:e.dataset.revealedGrade,recruit:!!e.querySelector('.recruit-reveal[data-recruit-grade]'),recipients:!!e.querySelector('.order-recipients[data-order-recipient-count]')}})()")
    if(!state)break
    if(wanted.has(state.focus)) {
      wanted.delete(state.focus);seen.push({...state,elapsed:Date.now()-started})
      const pausable=await run("!!document.querySelector('.sequence-pause[aria-pressed=false]')")
      if(pausable)await click('.sequence-pause',{delay:0})
      await shot(prefix+'-'+state.focus)
      if(pausable)await click('.sequence-pause',{delay:0})
    }
    if(state.done)break
    await pause(5)
  }
  assert.deepEqual([...wanted],[],'Missing real sequence stages: '+prefix)
  await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'")
  return {seen,wallMs:Date.now()-started}
 }
 async function battleUntilShop(prefix) {
  await click('.field-advance');await wait("document.querySelector('.scene-shell')?.dataset.phase==='battle'")
  const control=await run("[...document.querySelectorAll('.field-controls button')].find(e=>e.getAttribute('aria-label')?.includes('1倍速'))?.getAttribute('aria-label')")
  if(control)await click('.field-controls button[aria-label='+JSON.stringify(control)+']')
  await wait("['shop','won','lost'].includes(document.querySelector('.scene-shell')?.dataset.phase)",900,40)
  await shot(prefix+'-actual-wave-end');return saved()
 }
 const budget=game=>({gold:game.gold,crystals:game.crystals,life:game.baseHp,maxLife:game.maxBaseHp,lifeFailed:!!game.lifeFailed,energy:game.energy,hands:game.handsLeft,prints:game.printsLeft})
 async function continueJourney(route,fromAction) {
  const reference=new Map(),unitIds=new Map(),records=[],waves=[]
  replayBuild(route,{onAction:({before,after,action})=>reference.set(action.n,{before,after:snapshotGame(after)})})
  const members=game=>[...game.allies,...game.reserves]
  const signature=unit=>JSON.stringify([unit.appearanceId,unit.grade,unit.level,unit.jobId,unit.fusionJobs || []])
  function mapUnit(id,current,at){
    const expected=members(reference.get(at).before).find(unit=>unit.id===id)
    assert.ok(expected,'Missing baseline material '+id)
    const available=members(current),known=available.find(unit=>unit.id===(unitIds.get(id) || id) && signature(unit)===signature(expected))
    const matches=known?[known]:available.filter(unit=>signature(unit)===signature(expected))
    assert.equal(matches.length,1,'Cannot identify earned forge material '+id+' at '+at)
    unitIds.set(id,matches[0].id);return matches[0].id
  }
  function mapCard(card,current){
    const matches=current.hand.filter(candidate=>candidate.suit+candidate.rank===card.face && (candidate.baseFace || candidate.suit+candidate.rank)===card.slot)
    assert.equal(matches.length,1,'Physical card face/baseFace changed: '+JSON.stringify(card));return matches[0].id
  }
  for(const entry of route.actions.filter(action=>action.n>=fromAction)){
    const before=await saved(),p=entry.params
    assert.equal(before.wave,entry.wave,'Actual UI wave at '+entry.n)
    assert.deepEqual(budget(before),entry.type==='tick'?entry.after:entry.before,'Actual UI budget '+(entry.type==='tick'?'after real ticker ':'before ')+entry.n+' '+entry.type)
    let actualParams=p,after
    if(entry.type==='select'){
      await desk('orders')
      const ids=p.cards.map(card=>mapCard(card,before));actualParams={cards:p.cards.map((card,index)=>({...card,id:ids[index]}))}
      for(const id of before.selected)await setup('s.chooseCard('+JSON.stringify(id)+')')
      for(const id of ids)await setup('s.chooseCard('+JSON.stringify(id)+')')
    }else if(entry.type==='target')await setup('s.target('+JSON.stringify(p.target)+')')
    else if(entry.type==='deploy'){
      await setup('s.doDeploy()');after=await saved()
      assert.equal(after.lastDeploy.key,p.expectedKey,'Actual UI hand key at '+entry.n)
      assert.equal(after.lastDeploy.score,p.expectedScore,'Actual UI score at '+entry.n)
      await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'",160,25)
    }else if(entry.type==='print'){
      const source=mapCard(p.source,before),targets=p.targets.map(card=>mapCard(card,before));actualParams={...p,source:{...p.source,id:source},targets:p.targets.map((card,index)=>({...card,id:targets[index]}))}
      assert.equal(await setup('s.applyPrint('+JSON.stringify(source)+','+JSON.stringify(targets)+')'),true)
    }else if(entry.type==='forge'){
      const leaderId=mapUnit(p.leaderId,before,entry.n),donorId=mapUnit(p.donorId,before,entry.n);actualParams={...p,leaderId,donorId}
      await desk('forge');assert.equal(await setup('s.forge('+JSON.stringify(leaderId)+','+JSON.stringify(donorId)+','+JSON.stringify(p.kind)+')'),true)
      if(p.kind==='ascend')await shot('journey-wave'+entry.wave+'-earned-ascend')
    }else if(entry.type==='formation')await setup('s.changeFormation('+JSON.stringify(p.id)+')')
    else if(entry.type==='reward'){
      if(await run("!!document.querySelector('.wave-victory>button')"))await click('.wave-victory>button')
      await wait('!!document.querySelector('+JSON.stringify('.reward-card[data-reward='+p.id+']')+')');await click('.reward-card[data-reward='+p.id+']')
    }else if(entry.type==='buy'){
      assert.deepEqual(before.shop,p.offers,'Real seeded shop offers at '+entry.n)
      await setup('s.purchase('+JSON.stringify(JOKERS.find(item=>item.id===p.id))+')')
    }else if(entry.type==='research')await setup('s.train('+JSON.stringify(p.key)+')')
    else if(entry.type==='next-wave')await setup('s.advance()')
    else if(entry.type==='battle-start'){
      const result=await battleUntilShop('journey-wave'+entry.wave)
      waves.push({wave:entry.wave,phase:result.phase,gate:result.baseHp,gold:result.gold,kills:result.stats.kills,report:result.lastCombatReport})
      console.log(JSON.stringify({progress:'journey',wave:entry.wave,phase:result.phase,gate:result.baseHp,gold:result.gold}))
      records.push({n:entry.n,wave:entry.wave,type:entry.type,params:actualParams,before:budget(before),after:entry.after,source:'real mouse begin / real requestAnimationFrame ticker'})
      continue
    }else if(entry.type!=='tick')throw Error('Unsupported real UI action '+entry.type)
    after ||= await saved()
    assert.deepEqual(budget(after),entry.after,'Actual UI budget after '+entry.n+' '+entry.type)
    const expectedNew=members(reference.get(entry.n).after).filter(unit=>!members(reference.get(entry.n).before).some(old=>old.id===unit.id))
    const actualNew=members(after).filter(unit=>!members(before).some(old=>old.id===unit.id))
    if(entry.type==='deploy'){
      if(entry.wave===2 && p.expectedKey==='flushFive'){
        const facts=deriveDeployFacts(before,after),referenceStep=reference.get(entry.n)
        const expected=deriveDeployFacts(referenceStep.before,referenceStep.after)
        assert.deepEqual(facts.order,expected.order)
        assert.equal(facts.recruitment.grade,expected.recruitment.grade)
        assert.equal(facts.recruitment.status,expected.recruitment.status)
        assert.deepEqual(facts.orderRecipients.map(u=>[u.name,u.isNew]),expected.orderRecipients.map(u=>[u.name,u.isNew]))
      }
      assert.equal(actualNew.length,expectedNew.length,'Actual recruitment branch at '+entry.n)
      for(let i=0;i<expectedNew.length;i++)unitIds.set(expectedNew[i].id,actualNew[i].id)
    }
    records.push({n:entry.n,wave:entry.wave,type:entry.type,params:actualParams,before:entry.type==='tick'?entry.before:budget(before),after:budget(after),...(entry.type==='deploy'?{scoreTrace:after.lastDeploy.scoreTrace}:{}),...(entry.type==='tick'?{source:'observed real ticker; no scripted tick call'}:{})})
    await writeFile(join(output,'presentation-journey-actions.json'),JSON.stringify({seed:4,method:'Real mouse start and public UI handlers. Every battle advances only by the actual browser ticker.',continuedFromAction:fromAction,actions:records,waves},null,2)+'\n')
  }
  const end=await saved();assert.equal(end.phase,'won');assert.equal(end.stats.wavesCleared,12);assert.equal(end.baseHp,route.finalSnapshot.baseHp)
  await shot('journey-main-12-wave-victory')
  return {ending:{phase:end.phase,wave:end.wave,wavesCleared:end.stats.wavesCleared,gate:end.baseHp,gold:end.gold,kills:end.stats.kills},actionsRecorded:records.length,waves:waves.map(({report,...wave})=>wave)}
 }
 async function scenario(name,task) {
  if(!selected.has(name))return
  const start=Date.now()
  try{const detail=await task();results.push({scenario:name,status:'passed',elapsedMs:Date.now()-start,...detail});console.log(JSON.stringify(results.at(-1)))}
  catch(error){results.push({scenario:name,status:'failed',elapsedMs:Date.now()-start,error:String(error.stack || error)});try{await shot(name+'-failure')}catch{}console.error(name+': '+error);process.exitCode=1}
  await persist()
 }
 async function persist(){
  let previous=[];try{previous=JSON.parse(await readFile(join(output,'presentation-ui-verification.json'),'utf8')).results || []}catch{}
  const merged=new Map(previous.map(row=>[row.scenario,row]));for(const row of results)merged.set(row.scenario,row)
  await writeFile(join(output,'presentation-ui-verification.json'),JSON.stringify({url,results:[...merged.values()],errors},null,2)+'\n')
 }
 await scenario('journey',async()=>{
  await boot(null);await click('.cover-start');await click('[data-actor="ghost"]');await click('[aria-label="固定种子"]');await send('Input.insertText',{text:'4'})
  await click('.intro-start');await wait("!!document.querySelector('.tutorial-coach')");await textClick('.tutorial-coach','结束引导')
  return continueJourney(evidence.routes.find(route=>route.id==='a'),1)
 })
 await scenario('sizes',async()=>{
  const a=await fixture('a-a-before-3520'),records=[]
  for(const [width,height] of [[1366,900],[390,844],[360,740],[844,390],[768,1024]]) {
    await boot(a.snapshot,width,height)
    assert.ok((await read('.score-equation')).includes('3360'))
    await click('.deploy-button',{delay:0});const committed=await saved();const stages=await captureStages('size-'+width+'x'+height)
    assert.equal(committed.lastDeploy.score,3360)
    assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow '+width)
    const reachable=await run("(()=>{const e=document.querySelector('.deploy-button');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")
    assert.ok(reachable,'real action cannot be reached at '+width)
    await shot('size-'+width+'x'+height+'-complete');records.push({width,height,...stages})
  }
  await boot(a.snapshot,390,844);await click('.deploy-button',{delay:0});const accepted=await saved()
  const simulationSpeed=await setup('(s.speed?.value ?? s.speed)')
  await click('.sequence-speed',{delay:0})
  assert.equal(await setup('(s.speed?.value ?? s.speed)'),simulationSpeed,'visual 2x must not change simulation speed')
  assert.equal(await setup('(s.presentationSpeed?.value ?? s.presentationSpeed)'),2)
  await click('.sequence-skip',{delay:0});await wait("document.querySelector('.score-sequence').dataset.complete==='true'");assert.deepEqual(await saved(),accepted)
  await boot(a.snapshot,390,844,{reduced:true});await click('.deploy-button',{delay:0});const reducedAccepted=await saved()
  await wait("document.querySelector('.score-sequence.motion-off')?.dataset.complete==='true'",20,10)
  assert.deepEqual(await saved(),reducedAccepted)
  await shot('reduced-motion-phone')
  return {records,skipAnd2xPreserveSavedSnapshot:true,reducedMotionImmediate:true}
 })
 await scenario('quality',async()=>{
  const records=[]
  for(const name of ['mythic','prismatic']) {
    const f=await fixture(name+'-before','presentation-fixtures');await boot(f.snapshot)
    await desk('forge');const before=await saved()
    // The only private setup call permitted here dispatches the genuine main forge action with earned materials.
    assert.equal(await setup(`s.forge(${JSON.stringify(f.action.params.leaderId)},${JSON.stringify(f.action.params.donorId)},'ascend')`),true)
    const after=await saved(),leader=after.allies.concat(after.reserves).find(unit=>unit.id===f.action.params.leaderId)
    assert.equal(leader.grade,f.expected.grade);assert.equal(after.allies.length+after.reserves.length,before.allies.length+before.reserves.length-1)
    await wait("!!document.querySelector('.fusion-reveal')");await shot(name+'-actual-fusion')
    await click('.fusion-reveal-controls .key-link');assert.deepEqual(await saved(),after)
    records.push({name,grade:leader.grade,wave:after.wave,actualMaterialsConsumed:1})
  }
  return {records}
 })
 await scenario('boss',async()=>{
  let f
  const queenSource=process.env.LEGION_QUEEN_FIXTURE
  if(queenSource){const path=isAbsolute(queenSource)?queenSource:join(root,queenSource);f=JSON.parse(await readFile(path,'utf8'))}
  else {
    const route=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false});let snapshot,actions
    replayBuild(route,{onAction:({after,action})=>{if(action.wave===12&&action.type==='battle-start'){snapshot=snapshotGame(after);actions=route.actions.slice(0,action.n)}}})
    assert.ok(snapshot);f={version:1,snapshot,actions};await writeFile(join(output,'presentation-queen-earned-fixture.json'),JSON.stringify(f,null,2)+'\n')
  }
  const snapshot=f.snapshot || f.game;assert.ok(snapshot && snapshot.wave===12)
  await boot(snapshot)
  if(snapshot.phase==='ready')await click('.field-advance');else await textClick('.field-controls','继续')
  let telegraph=false,interruption=false
  for(let i=0;i<1500;i++) {
    const state=await run("(()=>{const g=JSON.parse(localStorage.getItem('joker.legion.demo.v1'));return {phase:document.querySelector('.scene-shell')?.dataset.phase || g.phase,warning:document.querySelector('.boss-warning')?.innerText || g.bossTelegraph,cue:document.querySelector('.payoff-button')?.innerText || '',logs:g.logs.map(row=>row.text)}})()")
    if(state.warning&&!telegraph){telegraph=true;await shot('queen-actual-telegraph')}
    if((state.cue.includes('王庭震荡实际被打断') || state.logs.some(text=>text.includes('王庭震荡被打断')))&&!interruption){
      interruption=true
      if(state.phase==='battle'){
        // Freeze the genuine ticker through its normal UI while photographing the actual event.
        await textClick('.field-controls','暂停')
        if(await run("document.querySelector('.payoff-button')?.innerText.includes('王庭震荡实际被打断')"))await click('.payoff-button')
        await shot('queen-actual-interrupt')
        if(await run("!!document.querySelector('.scene-close')"))await click('.scene-close')
        await textClick('.field-controls','继续')
      }else await shot('queen-actual-interrupt')
    }
    if(['won','lost'].includes(state.phase))break
    await pause(25)
  }
  const end=await saved();assert.ok(['won','lost'].includes(end.phase));assert.ok(telegraph,'No genuine queen warning observed')
  if(process.env.LEGION_QUEEN_REQUIRE_INTERRUPT==='1' || queenSource?.includes('queen-pulse'))assert.ok(interruption,'No genuine interruption observed; do not manufacture it')
  await shot('queen-actual-'+end.phase)
  return {telegraphObserved:telegraph,interruptionObserved:interruption,actualEnding:end.phase,gate:end.baseHp,source:'legal actions / real ticker'}
 })
 assert.deepEqual(errors,[])
 await persist()
}finally{ws?.close();chrome?.kill();vite?.kill()}
