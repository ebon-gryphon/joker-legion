// Reversible, isolated Chrome acceptance for material warnings and confirmation.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const E=await import(pathToFileURL(root+'/src/engine.js'))
const {grantExperience}=await import(pathToFileURL(root+'/src/training.js'))
const {getCardDesign}=await import(pathToFileURL(root+'/src/cardCatalog.js'))
const g=E.createGame({seed:'升星材料警告'});g.gold=40
const leader=E.addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'3',pattern:'high',grade:0}})
const donor=E.addUnit(g,'knight','ally',1,{identity:{suit:'♠',rank:'Q',pattern:'high',grade:3}})
grantExperience(g,donor,12,false);donor.lessons=['priest']
assert.ok(E.restoreGame(E.snapshotGame(g)))
const fixture=E.snapshotGame(g),profile=await mkdtemp(join(tmpdir(),'legion-promotion-'))
const binary=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync)
if(!binary)throw Error('请设置 LEGION_CHROME_BINARY。')
const chrome=spawn(binary,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws
await mkdir(join(root,'output'),{recursive:true})
try {
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let id=0;const pending=new Map(),errors=[]
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(JSON.stringify(m.error))):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)}
 const send=(method,params={})=>new Promise((r,j)=>{pending.set(++id,[r,j]);ws.send(JSON.stringify({id,method,params}))})
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value}
 const wait=async expression=>{for(let i=0;i<100;i++){if(await run(expression))return;await pause(80)}throw Error('timeout '+expression+' '+await run('document.body.innerText.slice(0,1500)'))}
 async function click(css) {
  await wait(`document.querySelector(${JSON.stringify(css)})?.getClientRects().length && !document.querySelector(${JSON.stringify(css)}).disabled`)
  const b=await run(`(()=>{const e=document.querySelector(${JSON.stringify(css)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`)
  assert.ok(b.hit,css+' blocked')
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1})
  await pause(100)
 }
 const saved=()=>run("JSON.parse(localStorage.getItem('joker.legion.demo.v1'))")
 const core=value=>({allies:value.allies.map(u=>({id:u.id,level:u.level,grade:u.grade,xp:u.trainingXp,lessons:u.lessons})),gold:value.gold,promotions:value.promotions})
 async function boot(width,height) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<550})
  const script=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('joker.legion.demo.v1',${JSON.stringify(JSON.stringify(fixture))})`})
  await send('Page.navigate',{url:process.env.LEGION_TEST_URL || 'http://127.0.0.1:5188/joker/demo/legion/'})
  await wait("!!document.querySelector('.deal-resume')");await click('.deal-resume');await wait("!!document.querySelector('.scene-shell')")
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier})
  await click('.hand-options');await wait("!!document.querySelector('.quick-promote')")
 }
 async function shot(name) {await writeFile(root+'/output/promotion-'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))}
 await send('Runtime.enable');await send('Page.enable')
 for(const [width,height] of [[1366,900],[390,844],[360,740]]) {
  await boot(width,height)
  const initial=core(await saved())
  assert.equal((await saved()).onboarding,undefined,'old save must not opt into coaching')
  await click('.quick-promote');await wait("!!document.querySelector('.quick-promotion-confirm')")
  assert.deepEqual(core(await saved()),initial,'opening a warning must not consume materials')
  const text=await run("document.querySelector('.quick-promotion-confirm').innerText")
  for(const value of [getCardDesign(leader).name,getCardDesign(donor).name,'常备','卓越','80%','20%','12','祈愈'])assert.ok(text.includes(value),'missing '+value)
  assert.ok(await run("document.querySelector('.command-room').inert"))
  assert.ok(await run("document.activeElement===document.querySelector('.quick-promotion-confirm .secondary-button')"),'cancel should receive focus first')
  await shot(width+'x'+height+'-confirm')
  await click('.quick-promotion-confirm .secondary-button');assert.deepEqual(core(await saved()),initial)
  await click('.quick-promote');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'})
  await wait("!document.querySelector('.quick-promotion-confirm')");assert.deepEqual(core(await saved()),initial)
  await click('.quick-promote')
  // An externally changed material must be reviewed again; the first confirmation is not a spend.
  await run(`document.querySelector('.scene-shell').__vueParentComponent.setupState.game.allies.find(u=>u.id===${JSON.stringify(donor.id)}).grade=2`)
  await click('.quick-promotion-confirm .gold-button')
  assert.ok(await run("document.querySelector('.quick-promotion-confirm').innerText.includes('材料信息已更新')"))
  assert.equal((await saved()).allies.length,2)
  await click('.quick-promotion-confirm .gold-button');await wait("!document.querySelector('.quick-promotion-confirm')")
  const after=await saved()
  assert.equal(after.allies.length,1);assert.equal(after.allies[0].id,leader.id);assert.equal(after.allies[0].level,2)
  assert.equal(after.allies[0].grade,0);assert.equal(after.gold,40);assert.equal(after.promotions,1)
  assert.ok(!after.allies.some(u=>u.id===donor.id))
  await boot(width,height);await click('.open-forge');await wait("!!document.querySelector('.forge-commit .merge-warning')")
  const warning=await run("document.querySelector('.forge-commit .merge-warning').innerText")
  for(const value of ['副兵','品质不会转移','80%','20%',getCardDesign(donor).name,'12'])assert.ok(warning.includes(value))
  assert.equal(await run('document.documentElement.scrollWidth>innerWidth'),false)
  await shot(width+'x'+height+'-workshop')
  await click('.forge-commit>.gold-button');await wait("!!document.querySelector('.forge-receipt')")
  assert.equal((await saved()).allies[0].grade,0)
  await click('.forge-receipt-actions .secondary-button')
  await run("document.querySelector('.scene-shell').__vueParentComponent.setupState.setDesk('brief')")
  await wait("!!document.querySelector('.formation-placement-note')")
  assert.ok((await run("document.querySelector('.formation-placement-note').innerText")).includes('清除手动站位'))
  console.log(JSON.stringify({width,height,warningNamesAndAssets:true,previewDoesNotSpend:true,cancelAndEscapeSafe:true,staleMaterialRequiresReview:true,confirmedExactConsumption:true,mainQualityRetained:true,workshopWarningVisible:true,oldSaveDoesNotEnableGuide:true}))
 }
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({browserErrors:errors}))
} finally {ws?.close();chrome.kill()}
