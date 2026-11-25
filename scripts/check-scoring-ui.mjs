// Real mouse acceptance in isolated Chrome; fixtures are earned and replayed by verify-builds.mjs.
import {previewHand,restoreGame} from '../src/engine.js'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const evidence=JSON.parse(await readFile(join(root,'output/build-verification.json'),'utf8'))
const fixture=async name=>JSON.parse(await readFile(join(root,'output/build-fixtures',name+'.json'),'utf8'))
const profile=await mkdtemp(join(tmpdir(),'legion-scoring-'))
const binary=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync)
assert.ok(binary,'Chrome required; set LEGION_CHROME_BINARY')
const chrome=spawn(binary,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws
const results=[]
try {
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let id=0;const pending=new Map(),errors=[]
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(JSON.stringify(m.error))):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)}
 const send=(method,params={})=>new Promise((r,j)=>{pending.set(++id,[r,j]);ws.send(JSON.stringify({id,method,params}))})
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value}
 const wait=async(expr,limit=120)=>{for(let i=0;i<limit;i++){if(await run(expr))return;await pause(80)}throw Error('timeout '+expr+' '+await run('document.body.innerText.slice(-2000)'))}
 async function click(css,{delay=45}={}) {
  await wait(`document.querySelector(${JSON.stringify(css)})?.getClientRects().length && !document.querySelector(${JSON.stringify(css)}).disabled`)
  const b=await run(`(()=>{const e=document.querySelector(${JSON.stringify(css)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return {x,y,hit:e.contains(h),obstacle:h?.className,width:innerWidth,height:innerHeight}})()`)
  if(!b.hit)await shot('blocked-control')
  assert.ok(b.hit,css+' blocked '+JSON.stringify(b))
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1})
  await pause(delay)
 }
 async function textClick(scope,text){const css=await run(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(e=>e.getClientRects().length&&e.innerText.includes(${JSON.stringify(text)}));if(!e)return null;e.dataset.qaClick='yes';return '[data-qa-click="yes"]'})()`);assert.ok(css,'Missing button '+text);await click(css);await run("document.querySelector('[data-qa-click]')?.removeAttribute('data-qa-click')")}
 const saved=()=>run("JSON.parse(localStorage.getItem('joker.legion.demo.v1'))")
 async function boot(snapshot,width=1366,height=900) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<550})
  const source=snapshot?`localStorage.clear();localStorage.setItem('joker.legion.demo.v1',${JSON.stringify(JSON.stringify({...snapshot,handSelection:'manual'}))})`:'localStorage.clear()'
  const setup=await send('Page.addScriptToEvaluateOnNewDocument',{source})
  await send('Page.navigate',{url:process.env.LEGION_TEST_URL || pathToFileURL(join(root,'output/legion-demo.html')).href})
  await wait("!!document.querySelector('.cover-start')");await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:setup.identifier})
  if(snapshot){await click('.deal-resume');await wait("!document.querySelector('.deal-scrim')")}
 }
 async function shot(name){const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(root,'output/scoring-'+name+'.png'),Buffer.from(s.data,'base64'))}
 const card=face=>'.playing-card[title^='+JSON.stringify(face+' ·')+']'
 const read=css=>run(`document.querySelector(${JSON.stringify(css)})?.innerText || ''`)
 const economy=g=>({deploys:g.stats.deploys,energy:g.energy,gold:g.gold,hands:g.handsLeft,allies:g.allies.map(u=>[u.id,u.xp,u.grade,u.level]),reserves:g.reserves.map(u=>u.id),items:g.jokers.map(j=>[j.id,j.quantity])})
 await mkdir(join(root,'output'),{recursive:true});await send('Runtime.enable');await send('Page.enable')
 // New game, fixed seed, three consecutive real hands, then a complete real-ticker battle.
 await boot(null);await click('.cover-start')
 await run("(()=>{const e=document.querySelector('[aria-label=固定种子]');e.focus();e.value='4';e.dispatchEvent(new Event('input',{bubbles:true}));e.blur()})()")
 await click('.intro-start');await wait("!!document.querySelector('.tutorial-coach')")
 assert.equal(String((await saved()).seed),'4')
 await textClick('.tutorial-coach','结束引导')
 const first=evidence.routes.find(r=>r.id==='a').actions.filter(a=>a.wave===1&&a.type==='deploy')
 const started=Date.now()
 for(let i=0;i<first.length;i++) {
  for(const c of first[i].params.cards)await click(card(c.face),{delay:15})
  assert.ok((await read('.hand-score-panel')).includes(String(first[i].params.expectedScore)))
  const old=await saved();await click('.deploy-button',{delay:10});await wait("!!document.querySelector('.score-sequence')")
  const committed=await saved();assert.equal(committed.stats.deploys,old.stats.deploys+1)
  if(i===0){
   await click('.sequence-speed',{delay:5});assert.ok((await read('.sequence-speed')).includes('2'))
   await click('.sequence-skip',{delay:5});assert.deepEqual(economy(await saved()),economy(committed));assert.equal(await run("document.querySelector('.score-sequence').dataset.complete"),'true')
   const next=card(first[1].params.cards[0].face)
   await click(next,{delay:5});await click(next,{delay:5})
   assert.equal(await run("document.querySelector('.score-sequence').dataset.complete"),'true','cancelling a new selection must not replay the previous hand')
  }
  assert.equal(committed.lastDeploy.score,first[i].params.expectedScore)
 }
 const threeHandMs=Date.now()-started
 assert.equal((await saved()).stats.deploys,3)
 await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'")
 await shot('three-hands-desktop')
 // A reload must not replay the saved receipt or consume a fourth hand.
 await send('Page.reload');await wait("!!document.querySelector('.deal-resume')");await click('.deal-resume')
 assert.equal(await run("!!document.querySelector('.score-sequence')"),false)
 assert.equal((await saved()).stats.deploys,3)
 await click('.field-advance');await wait("document.querySelector('.scene-shell').dataset.phase==='battle'")
 await click('button[aria-label="当前1倍速，点击切换"]')
 await wait("document.querySelector('.scene-shell').dataset.phase==='shop'",500)
 const completed=await saved();assert.equal(completed.stats.wavesCleared,1)
 assert.ok(completed.lastCombatReport.ended);assert.ok(completed.lastCombatReport.totals.damage>0)
 await shot('real-wave-report')
 results.push({scenario:'fixed-seed new game, three hands, skip, reload, full first battle',threeHandMs,score:completed.lastDeploy.score,gate:completed.baseHp,duration:completed.lastCombatReport.battleDuration})
 // A legally reached high hand: identical visible formula and committed score at desktop and phone.
 const a=await fixture('a-a-before-3520')
 const high=previewHand(restoreGame(a.snapshot)).scoreTrace
 assert.equal(high.finalScore,3360)
 for(const [width,height] of [[1366,900],[390,844],[360,740],[844,390],[768,1024]]) {
  await boot(a.snapshot,width,height)
  assert.equal(await run("document.querySelector('.hand-score-panel').dataset.hand"),'flushFive')
  assert.equal(await run("!!document.querySelector('.toast-note')"),false,'restored selected hand stays clear of a resume notice')
  assert.ok((await read('.score-equation')).includes(String(high.finalScore)))
  await click('.score-detail-toggle')
  assert.ok((await read('.score-final-ledger')).includes(String(high.chipsBeforeMult)+' 筹码'))
  for(const item of high.chipBonuses)assert.ok((await read('[data-score-item='+item.id+']')).includes(item.label))
  assert.ok((await read('.score-order-source')).includes(String(high.finalScore)))
  assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'))
  await shot('high-preview-'+width)
  await click('.deploy-button',{delay:5});await wait("!!document.querySelector('.score-sequence')")
  const committed=await saved();assert.equal(committed.lastDeploy.score,high.finalScore);assert.equal(committed.lastDeploy.captainGrade,4)
  await click('.sequence-skip',{delay:5});assert.deepEqual(economy(await saved()),economy(committed))
  await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'")
  assert.ok((await read('.score-sequence')).includes(String(high.finalScore)))
  await shot('high-receipt-'+width)
  results.push({scenario:'seed 4 flush-five preview and actual settlement',width,height,grade:committed.lastDeploy.captainGrade,score:committed.lastDeploy.score})
 }
 // Full-board XP and actual zero healing are read from legal snapshots, not invented armies.
 const b=await fixture('b-b-before-first-training');await boot(b.snapshot,390,844)
 assert.ok((await read('[data-score-outcome]')).includes('经验'))
 const before=await saved();await click('.deploy-button');await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'")
 const trained=await saved();assert.equal(trained.allies.length,before.allies.length);assert.equal(trained.lastDeploy.count,0)
 assert.ok(trained.lastDeploy.trainingXp>0);assert.ok(trained.lastDeploy.scoreTrace.recruit.receiver.name)
 await shot('full-board-xp-phone')
 results.push({scenario:'full-board real XP',xp:trained.lastDeploy.trainingXp,recipient:trained.lastDeploy.scoreTrace.recruit.receiver.name,army:trained.allies.length})
 const reserve=await fixture('a-a-before-legendary-reserve');await boot(reserve.snapshot,390,844)
 assert.ok((await read('[data-score-outcome]')).includes('候补'))
 const reserveBefore=await saved();await click('.deploy-button');await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'")
 const reserveAfter=await saved();assert.equal(reserveAfter.allies.length,reserveBefore.allies.length)
 assert.equal(reserveAfter.reserves.length,reserveBefore.reserves.length+1)
 assert.equal(reserveAfter.lastDeploy.scoreTrace.recruit.reserve,true)
 assert.equal(reserveAfter.lastDeploy.scoreTrace.recruit.xp,0)
 await shot('full-board-legendary-reserve-phone')
 results.push({scenario:'full-board legend really enters reserve',army:reserveAfter.allies.length,reserves:reserveAfter.reserves.length,score:reserveAfter.lastDeploy.score})
 const c=await fixture('c-c-before-red-echo');await boot(c.snapshot,390,844)
 await click('.deploy-button');await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'")
 const red=(await saved()).lastDeploy.scoreTrace.items.find(item=>item.id==='red-echo').actual
 assert.equal(red.triggered,true);assert.equal(red.effects.healed,0)
 await click('.sequence-breakdown>summary')
 assert.ok((await read('[data-score-item=red-echo]')).includes('0'))
 await shot('zero-effective-heal-phone')
 results.push({scenario:'triggered with zero effective healing',actual:red})
 // Resume a legal in-flight battle immediately before a real healing-to-damage conversion.
 const heart=await fixture('c-c-before-heart-conversion');await boot(heart.snapshot,390,844)
 await textClick('.field-controls','继续')
 await wait("JSON.parse(localStorage.getItem('joker.legion.demo.v1')).combatLedger.itemEvents.some(e=>e.id==='heart-engine' && e.effects.damage>0)")
 const pulse=(await saved()).combatLedger.itemEvents.find(e=>e.id==='heart-engine' && e.effects.damage>0)
 assert.equal(pulse.phase,'battle');assert.equal(pulse.orderId,null)
 await shot('actual-heart-conversion-phone')
 results.push({scenario:'real ticker healing-to-damage conversion',actual:pulse.effects})
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await boot(b.snapshot,390,844);await click('.deploy-button',{delay:5})
 assert.equal(await run("document.querySelector('.score-sequence')?.dataset.complete"),'true')
 assert.equal((await saved()).stats.deploys,b.snapshot.stats.deploys+1)
 results.push({scenario:'reduced motion settles visually at once without replay'})
 assert.deepEqual(errors,[])
 await writeFile(join(root,'output/scoring-ui-verification.json'),JSON.stringify({results,errors},null,2)+'\n')
 console.log(JSON.stringify({results,errors}))
} finally {ws?.close();chrome.kill()}
