// Isolated browser acceptance: run after building the offline demo. Requires Node 22+ and Chrome.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {existsSync} from 'node:fs'
const root=fileURLToPath(new URL('../',import.meta.url)),E=await import(pathToFileURL(root+'/src/engine.js'))
const {initOnboarding}=await import(pathToFileURL(root+'/src/onboarding.js'))
const {endWave}=await import(pathToFileURL(root+'/src/campaign.js'))
const {damageUnit,healUnit,settleDeaths}=await import(pathToFileURL(root+'/src/combatHealth.js'))
const {DETACHMENTS}=await import(pathToFileURL(root+'/src/recruitment.js'))
const {initializeCombatStats}=await import(pathToFileURL(root+'/src/combatStats.js'))
const profile=await mkdtemp(join(tmpdir(),'legion-experience-')),downloads=join(profile,'downloads');await mkdir(downloads)
const chromeBinary=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync)
if(!chromeBinary)throw Error('请通过 LEGION_CHROME_BINARY 指定 Chrome 可执行文件。')
await mkdir(join(root,'output'),{recursive:true})
const chrome=spawn(chromeBinary,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws
try{
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let id=0;const pending=new Map(),errors=[]
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(JSON.stringify(m.error))):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
 const send=(method,params={})=>new Promise((r,j)=>{pending.set(++id,[r,j]);ws.send(JSON.stringify({id,method,params}))})
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
 const wait=async expr=>{for(let i=0;i<100;i++){if(await run(expr))return;await pause(80)}throw Error('timeout '+expr+' '+await run('document.body.innerText.slice(0,1500)'))}
 async function click(css){await wait(`document.querySelector(${JSON.stringify(css)})?.getClientRects().length && !document.querySelector(${JSON.stringify(css)}).disabled`);const b=await run(`(()=>{const e=document.querySelector(${JSON.stringify(css)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`);assert.ok(b.hit,css+' blocked');for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1});await pause(120)}
 async function clickText(scope,text){const selector=await run(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(e=>e.getClientRects().length&&e.innerText.includes(${JSON.stringify(text)}));if(!e)return null;e.dataset.qaClick='target';return '[data-qa-click="target"]'})()`);assert.ok(selector,'missing '+text);await click(selector);await run("document.querySelector('[data-qa-click]')?.removeAttribute('data-qa-click')")}
 const saved=()=>run("JSON.parse(localStorage.getItem('joker.legion.demo.v1'))")
 async function boot(g,width=390,height=844){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<550});let setup;if(g!==undefined)setup=await send('Page.addScriptToEvaluateOnNewDocument',{source:g?`localStorage.setItem('joker.legion.demo.v1',${JSON.stringify(JSON.stringify(E.snapshotGame(g)))})`:"localStorage.clear()"});await send('Page.navigate',{url:process.env.LEGION_TEST_URL || pathToFileURL(join(root,'output/legion-demo.html')).href});await wait("!!document.querySelector('.cover-start')");if(setup)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:setup.identifier});if(g!==null){await click('.deal-resume');await wait("!!document.querySelector('.scene-shell')")}await pause(250)}
 async function shot(name){const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(root+'/output/experience-'+name+'.png',Buffer.from(s.data,'base64'))}
 await send('Runtime.enable');await send('Page.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads})
 // Start through the real cover rather than only exercising the tutorial model.
 await boot(null);await click('.cover-start');await click('.intro-start');await wait("!!document.querySelector('.tutorial-coach')")
 assert.equal((await saved()).onboarding.status,'active')
 assert.equal(await run("!!document.querySelector('.trick-bar')"),false)
 assert.equal(await run("!!document.querySelector('.open-forge')"),false)
 await shot('guide-start-phone')
 // A natural seeded hand with a pair, preserving deck, resources and all rules.
 let g,pair,high
 for(let seed=1;seed<50&&!pair;seed++){g=E.createGame({seed});const byRank=Object.groupBy(g.hand,c=>c.rank);pair=Object.values(byRank).find(a=>a.length>=2)?.slice(0,2);if(pair)high=g.hand.find(c=>!pair.includes(c))}
 initOnboarding(g);await boot(g)
 const card=c=>'.playing-card[title^='+JSON.stringify(c.suit+c.rank+' ·')+']'
 await click(card(high));await click('.deploy-button');await wait("document.querySelector('.tutorial-coach')?.dataset.step==='w1-healer'")
 for(const c of pair)await click(card(c))
 await click('.deploy-button');assert.ok((await saved()).onboarding.done.includes('w1-shield'))
 await clickText('.tutorial-coach','结束引导');assert.equal((await saved()).onboarding.status,'skipped')
 await click('.hand-options');assert.ok(await run("!!document.querySelector('.open-forge')"));assert.ok(await run("!!document.querySelector('.trick-bar')"))
 await boot(undefined);assert.equal((await saved()).onboarding.status,'skipped')
 // An actual completed battle ledger, including a personal kill and effective healing.
 g=E.createGame({seed:'体验战报'});initializeCombatStats(g,{runId:'ui-experience-run'})
 const add=pattern=>{const f=DETACHMENTS[pattern].members[0];return E.addUnit(g,f.type,'ally',1,{identity:{...f,pattern,grade:1,source:'card'}})}
 const a=add('high'),b=add('pair');g.schedule=[{at:0,type:'raider'}];E.beginBattle(g)
 a.hp-=20;healUnit(g,a,12,0,b);damageUnit(g,g.enemies[0],9999,0,a);settleDeaths(g);g.waveTime=8;endWave(g)
 assert.equal(g.baseHp,g.maxBaseHp);assert.ok(E.restoreGame(E.snapshotGame(g)))
 await boot(g,1366,900);await wait("!!document.querySelector('.wave-victory .personal-report')");await pause(2700)
 assert.ok(await run("!!document.querySelector('.wave-victory')"),'report should wait for the player')
 assert.ok((await run("document.querySelector('.personal-report').innerText")).includes((await import(pathToFileURL(root+'/src/cardCatalog.js'))).getCardDesign(a).name))
 await shot('personal-report-desktop')
 await click('.wave-victory>.key-command');await wait("!!document.querySelector('[data-reward=repair]')")
 assert.ok(await run("document.querySelector('[data-reward=repair]').disabled"))
 assert.ok((await run("document.querySelector('[data-reward=repair]').innerText")).includes('城门耐久已满'))
 assert.equal((await saved()).rewardChosen,false)
 await shot('supplies-full-health')
 await click('[data-reward=power]');await wait("!!document.querySelector('.field-market')")
 await click('.scene-menu-key');await clickText('.menu-actions','战报与本地历史')
 assert.ok((await run("document.querySelector('.history-notice').innerText")).includes('已保存 1 波'))
 await clickText('.battle-history-tools','导出本地战报')
 let files=[];for(let i=0;i<80&&!files.some(f=>f.endsWith('.json'));i++){files=await readdir(downloads);await pause(80)}
 const exported=JSON.parse(await readFile(join(downloads,files.find(f=>f.endsWith('.json'))),'utf8'))
 assert.equal(exported.records.length,1);assert.equal(exported.records[0].units.find(r=>r.unitId===a.id).kills,1)
 assert.equal(exported.records[0].units.find(r=>r.unitId===b.id).healed,12)
 await shot('history-export-desktop')
 await boot(undefined,390,844);await click('.scene-menu-key');await clickText('.menu-actions','战报与本地历史')
 assert.ok((await run("document.querySelector('.history-notice').innerText")).includes('已保存 1 波'))
 assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'))
 await shot('personal-report-phone')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({newGameGuide:true,realHighAndPairSteps:true,skipPersists:true,fullHealthRepairDisabled:true,personalNames:true,reportWaitsForPlayer:true,historyPersists:true,jsonDownloadVerified:true,phoneNoOverflow:true,errors}))
}finally{ws?.close();chrome.kill()}
