// Development-mode DOM/canvas acceptance. Use a fresh isolated Chrome profile; Node 22+ required.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {existsSync} from 'node:fs'
const root=fileURLToPath(new URL('../',import.meta.url)), E=await import(pathToFileURL(root+'/src/engine.js')),{DETACHMENTS}=await import(pathToFileURL(root+'/src/recruitment.js'))
const profile=await mkdtemp(join(tmpdir(),'legion-deployment-'))
const chromeBinary=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync)
if(!chromeBinary)throw Error('请通过 LEGION_CHROME_BINARY 指定 Chrome 可执行文件。')
const chrome=spawn(chromeBinary,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws
try{
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let id=0;const pending=new Map(),errors=[]
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(JSON.stringify(m.error))):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
 const send=(method,params={})=>new Promise((r,j)=>{pending.set(++id,[r,j]);ws.send(JSON.stringify({id,method,params}))})
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
 const wait=async expr=>{for(let i=0;i<100;i++){if(await run(expr))return;await pause(80)}throw Error('timeout '+expr+' '+JSON.stringify(await run("({body:document.body.innerText.slice(0,1600),url:location.href,ls:localStorage.getItem('joker.legion.demo.v1')?.slice(0,200)})"))+' '+JSON.stringify(errors))}
 const click=async css=>{await wait(`!!document.querySelector(${JSON.stringify(css)})`);await run(`document.querySelector(${JSON.stringify(css)}).click()`);await pause(150)}
 await send('Runtime.enable');await send('Page.enable')
 const game=E.createGame({seed:'部署区身份验收'});game.gold=60
 for(const [i,pattern] of ['high','pair','straight','three','flush'].entries()){const f=DETACHMENTS[pattern].members[0];const u=E.addUnit(game,f.type,'ally',1,{identity:{...f,pattern,grade:i,source:'card'}});u.x=[75,180,290,390,470][i];u.y=[155,210,245,300,345][i]}
 if(process.env.TUTORIAL_WAVE){game.wave=Number(process.env.TUTORIAL_WAVE);game.schedule=E.waveSchedule(game.seed,game.wave);(await import(pathToFileURL(root+'/src/onboarding.js'))).initOnboarding(game)}
 const fixture=E.snapshotGame(game)
 const setup=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('joker.legion.demo.v1',${JSON.stringify(JSON.stringify(fixture))});localStorage.setItem('joker.legion.preferences.v1','{}')`})
 for(const [width,height] of (process.env.TUTORIAL_WAVE?[[390,844],[844,390]]:[[390,844],[360,740],[844,390],[768,1024]])){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<550})
  await send('Page.navigate',{url:process.env.LEGION_TEST_URL || 'http://127.0.0.1:5173/'});await wait("!!document.querySelector('.deal-resume')");await click('.deal-resume');await wait("!!document.querySelector('.scene-shell')");await pause(300)
  console.log(JSON.stringify({width,height,keys:await run("Object.keys(document.querySelector('.scene-shell').__vueParentComponent.setupState).filter(k=>/renderer|game|desk/.test(k))")}))
  for(const mode of ['orders','field']){
   if(mode==='field')await click('.scene-close')
   await pause(350)
   const geometry=await run(`(()=>{const vm=document.querySelector('.scene-shell').__vueParentComponent.setupState;const canvas=document.querySelector('.battle-canvas'),b=canvas.getBoundingClientRect();const r=vm.renderer.deploymentGeometry();const controls=[...document.querySelectorAll('.field-head,.battle-topline,.scene-tools,.trick-bar,.scene-action,.scene-panel,.tutorial-field-dock,.camp-notification-slot,.field-pick-hint,.wagon-aside')].filter(e=>e.getClientRects().length).map(e=>({class:e.className,...e.getBoundingClientRect().toJSON()}));return {r,controls,overflow:document.documentElement.scrollWidth>innerWidth}})()`)
   await writeFile(root+'/output/legion-deployment-'+(process.env.TUTORIAL_WAVE?'tutorial-w'+process.env.TUTORIAL_WAVE+'-':'')+width+'x'+height+'-'+mode+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))
   const intersect=(a,b)=>a.left<b.right-.1&&a.right>b.left+.1&&a.top<b.bottom-.1&&a.bottom>b.top+.1
   assert.equal(geometry.overflow,false)
   const r=geometry.r;assert.equal(r.units.length,5);assert.equal(r.names.length,5)
   for(const u of r.units){const b={left:r.left+u.left*r.scale,right:r.left+u.right*r.scale,top:r.top+u.top*r.scale,bottom:r.top+u.bottom*r.scale};for(const control of geometry.controls)assert.equal(intersect(b,control),false,JSON.stringify({width,height,mode,unit:u.id,b,control}))}
   for(const n of r.names){const b={left:n.x-n.half,right:n.x+n.half,top:n.y-n.size,bottom:n.y+2};for(const control of geometry.controls)assert.equal(intersect(b,control),false,JSON.stringify({width,height,mode,name:n,b,control}));const result=await run(`(()=>{const c=document.querySelector('.battle-canvas'),vm=document.querySelector('.scene-shell').__vueParentComponent.setupState;return {element:c===document.elementFromPoint(${n.x},${n.y-n.size/2}),picked:vm.renderer.pickUnit(${n.x},${n.y-n.size/2},'ally')}})()`);assert.equal(result.element,true,JSON.stringify({n,result,geometry}));assert.equal(result.picked,n.id,JSON.stringify({n,result,geometry}))}
   const point=await run(`(()=>{const vm=document.querySelector('.scene-shell').__vueParentComponent.setupState;const x=${r.left}+263*${r.scale},y=${r.top}+(${r.laneStart}+(250-192)*${r.laneScale})*${r.scale};return vm.renderer.campPoint(x,y)})()`);assert.ok(Math.abs(point.x-263)<1&&Math.abs(point.y-250)<1)
   console.log(JSON.stringify({width,height,mode,scale:r.scale,viewport:r.viewport,names:r.names.map(n=>n.text),fiveBodiesAndNamesClear:true,allNameHitTests:true}))
   if(mode==='field'){const buttons=await run("[...document.querySelectorAll('.scene-tools button,.tutorial-field-dock button')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return {text:e.innerText,hit:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}})");for(const button of buttons)assert.ok(button.hit,JSON.stringify({width,height,button}));const before=JSON.stringify([r.scale,r.left,r.top,r.laneStart,r.laneScale,r.viewport]);await run("document.querySelector('.scene-shell').__vueParentComponent.setupState.toast=null");await pause(120);const after=await run("(()=>{const r=document.querySelector('.scene-shell').__vueParentComponent.setupState.renderer.deploymentGeometry();return JSON.stringify([r.scale,r.left,r.top,r.laneStart,r.laneScale,r.viewport])})()");assert.equal(after,before,'notification disappearing must not move troops');const n=r.names[0];for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:n.x,y:n.y-n.size/2,button:'left',clickCount:1});await wait("!!document.querySelector('.soldier-sheet h3')");assert.equal(await run("document.querySelector('.soldier-sheet h3').textContent"),n.text);if(process.env.TUTORIAL_WAVE==='1')assert.equal(await run("!!document.querySelector('.soldier-sheet footer')"),false)}
  }
 }
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:setup.identifier});assert.deepEqual(errors,[])
}finally{ws?.close();chrome.kill()}
