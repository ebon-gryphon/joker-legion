import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const url=process.env.LEGION_TEST_URL || 'http://127.0.0.1:5199'
const folder=new URL('../output/endless/',import.meta.url)
const chrome=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync)
const profile=await mkdtemp(join(tmpdir(),'legion-endless-'))
const browser=spawn(chrome,['--headless=new','--no-first-run','--disable-gpu','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const results=[],errors=[]
let ws
try {
  let port
  for(let i=0;i<100 && !port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
  const list=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()
  ws=new WebSocket(list.find(p=>p.type==='page').webSocketDebuggerUrl)
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
  let serial=0;const pending=new Map()
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(m.error.message)):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)}
  const send=(method,params={})=>new Promise((r,j)=>{pending.set(++serial,[r,j]);ws.send(JSON.stringify({id:serial,method,params}))})
  async function run(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value}
  async function wait(expression){for(let i=0;i<200;i++){if(await run(expression))return;await pause(45)}throw Error('Timeout '+expression+' '+await run('document.body.innerText.slice(-1800)'))}
  async function click(selector){
    const sel=JSON.stringify(selector)
    await wait('document.querySelector('+sel+')?.getClientRects().length && !document.querySelector('+sel+').disabled')
    await run('document.querySelector('+sel+').scrollIntoView({block:"nearest"})')
    const {x,y,hit}=await run('(()=>{let e=document.querySelector('+sel+'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()')
    assert.ok(hit,'covered '+selector)
    for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1})
  }
  async function button(scope,text){
    const sel=JSON.stringify(scope+' button')
    const ok=await run('(()=>{const e=[...document.querySelectorAll('+sel+')].find(e=>e.offsetWidth && !e.disabled && e.innerText.includes('+JSON.stringify(text)+'));if(!e)return false;e.dataset.endlessQa="hit";return true})()')
    assert.ok(ok,scope+' '+text);await click('[data-endless-qa=hit]');await run('document.querySelector("[data-endless-qa=hit]")?.removeAttribute("data-endless-qa")')
  }
  const lens=expr=>'(()=>{const raw=document.querySelector(".scene-shell").__vueParentComponent.setupState.game;const g=raw?.__v_isRef?raw.value:raw;return '+expr+'})()'
  const state=expr=>run(lens('JSON.parse(JSON.stringify(('+expr+') ?? null))'))
  async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(name+'.png',folder),Buffer.from(r.data,'base64'))}
  async function boot(name){
    const snapshot=JSON.parse(await readFile(new URL(name+'.json',folder),'utf8'))
    const key='joker.legion.demo.v1'+(snapshot.mode==='endless'?'.endless':'')
    const source='localStorage.clear();localStorage.setItem('+JSON.stringify(key)+','+JSON.stringify(JSON.stringify({...snapshot,handSelection:'manual'}))+')'
    const inject=await send('Page.addScriptToEvaluateOnNewDocument',{source})
    await send('Page.navigate',{url});await wait('!!document.querySelector(".cover-start")')
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:inject.identifier})
    if(snapshot.mode==='endless'){
      await click('.cover-start');await click('[data-mode=endless]');await wait('document.querySelector("[data-mode=endless]").getAttribute("aria-pressed")==="true"')
      if(name==='endless12')await shot('mode-selection')
      await button('.deal-options','继续第')
    }else await click('.deal-resume')
    await wait('!!document.querySelector(".scene-shell") && !document.querySelector(".joker-table")')
    assert.equal(await state('g.mode'),snapshot.mode);assert.equal(await state('g.wave'),snapshot.wave)
    assert.equal(await state('g.combatLedger.enemyEvents.length'),snapshot.combatLedger.enemyEvents.length)
    return snapshot
  }
  await send('Runtime.enable');await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false})
  await boot('scout')
  await click('.scene-close')
  await click('[data-tool=brief]')
  await wait('document.querySelector(".brief-intel")?.innerText.includes("刺客追击")')
  await shot('scout')
  results.push({case:'scout',intel:await run('document.querySelector(".brief-intel").innerText')})
  for(const name of ['bonus','guard','hunt','split','chant','heal','late-loss','standard12','endless12']){
    const before=await boot(name),start=before.combatLedger.enemyEvents.length
    await button('.field-controls','继续')
    const find='g.combatLedger.enemyEvents.slice('+start+').find(e=>e.kind==='+JSON.stringify(name)+' && '+(name==='split'?'e.amount===2':'(e.amount??1)>0')+')'
    const condition=name==='chant'?'g.enemies.some(e=>e.chanting)':name==='late-loss'?'g.baseHp<'+before.baseHp:name.endsWith('12')?'g.phase!=="battle"':find
    await wait(lens(condition))
    if(await state('g.phase==="battle"'))await button('.field-controls','暂停')
    const event=['bonus','guard','hunt','split','heal'].includes(name)?await state(find):null
    const row={case:name,mode:before.mode,seed:before.seed,wave:before.wave,at:await state('g.waveTime'),beforeLife:before.baseHp,life:await state('g.baseHp'),event,phase:await state('g.phase')}
    if(name==='late-loss'){row.loss=await state('g.lifeEvents.filter(e=>e.kind==="loss").at(-1)');assert.ok(['breach','timeout'].includes(row.loss.source));assert.equal(row.loss.amount,1)}
    if(name==='split'){row.children=await state('g.enemies.filter(e=>e.parentId==='+JSON.stringify(event.actor)+').map(e=>e.id)');assert.deepEqual(row.children,event.children)}
    if(name==='hunt')assert.ok((await run('document.body.innerText')).includes('刺客追击'))
    if(name==='standard12'){assert.equal(row.phase,'won');assert.equal(await state('g.rewards.length+g.shop.length'),0)}
    if(name==='endless12'){assert.equal(row.phase,'shop');assert.equal(await state('g.rewards.length'),3)}
    await shot(name);results.push(row);console.log(row.case,row.phase,row.wave)
    if(name==='endless12'){
      await click('.wave-victory>button');await wait('document.querySelectorAll(".reward-card").length===3');await shot('endless12-rewards')
      await click('.reward-card:not(:disabled)');await wait('document.querySelector(".scene-shell").dataset.desk==="market"');await shot('endless12-shop')
      await click('.field-advance');await wait(lens('g.wave===13 && g.phase==="ready"'));await shot('endless13')
      results.push({case:'endless13',wave:await state('g.wave'),phase:await state('g.phase'),queue:await state('g.schedule')})
    }
  }
  await boot('endless12');await button('.field-controls','继续')
  await wait(lens('g.phase==="shop"'));await click('.retire-run')
  await wait(lens('g.phase==="retired"'));await wait('!!document.querySelector(".result-modal")')
  assert.equal(await state('g.lastCombatReport.runOutcome.status'),'retired')
  await shot('retired')
  results.push({case:'retired',outcome:await state('g.lastCombatReport.runOutcome')})
  assert.deepEqual(errors,[])
  await writeFile(new URL('browser.json',folder),JSON.stringify({viewport:[1366,900],method:'Legal action checkpoints, real play controls and browser ticker',results,errors},null,2)+'\n')
} finally {ws?.close();browser.kill();await new Promise(r=>browser.exitCode===null?browser.once('exit',r):r());await rm(profile,{recursive:true,force:true,maxRetries:4})}
