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
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(m.error.message)):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
    else if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error')errors.push(m.params.args.map(arg=>arg.description ?? arg.value).join(' '))}
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
  async function verifyBackground(name){
    const measured=await run(`(async()=>{
      const resource=performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname.endsWith('/battlefield.png'))
      if(!resource)throw Error('Missing battlefield request')
      const bytes=await (await fetch(resource.name)).arrayBuffer()
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')
      const image=new Image();image.src=resource.name;await image.decode()
      const canvas=document.querySelector('.battle-canvas'),w=canvas.width,h=canvas.height
      const reference=document.createElement('canvas');reference.width=w;reference.height=h
      const c=reference.getContext('2d');c.imageSmoothingEnabled=false
      const scale=Math.max(w/image.width,h/image.height),dw=image.width*scale,dh=image.height*scale
      c.drawImage(image,Math.round((w-dw)*.14),Math.round((h-dh)*.48),dw,dh)
      const display=canvas.getContext('2d'),drawImage=display.drawImage
      // Capture one real background pass before soldiers and aura overlays cover it.
      const painted=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{delete display.drawImage;reject(Error('No battlefield paint'))},3000)
        display.drawImage=function(source,...args){
          const result=drawImage.call(this,source,...args)
          if(source?.currentSrc===image.currentSrc){
            clearTimeout(timer);delete this.drawImage;resolve(this.getImageData(0,0,w,h).data)
          }
          return result
        }
      })
      const a=c.getImageData(0,0,w,h).data,b=display.getImageData(0,0,w,h).data
      let backgroundSamples=0,backgroundMatches=0
      const hits=[0,0,0,0],samples=[0,0,0,0],light=[0,0],count=[0,0],edgeHits=[0,0,0,0],edges=[0,0,0,0]
      for(let y=6;y<h;y+=17)for(let x=5;x<w;x+=17){
        const zone=Number(x>w/2)+2*Number(y>h/2),k=4*(y*w+x)
        samples[zone]++;backgroundSamples++
        if([0,1,2].every(ch=>Math.abs(a[k+ch]-painted[k+ch])<=1))backgroundMatches++
        const matches=[0,1,2].every(ch=>Math.abs(a[k+ch]-b[k+ch])<=1)
        if(matches)hits[zone]++
        // The outer sky and near foreground remain visible even when the hostile formation fills a quadrant.
        if(y<h*.09 || y>h*.94){edges[zone]++;if(matches)edgeHits[zone]++}
        if(y>h*.54 && y<h*.82 && (x<w*.25 || x>w*.75)){
          const side=Number(x>w*.75);light[side]+=.2126*b[k]+.7152*b[k+1]+.0722*b[k+2];count[side]++
        }
      }
      return {digest,backgroundMatch:backgroundMatches/backgroundSamples,source:[image.width,image.height],edgeMatch:edgeHits.map((n,i)=>n/edges[i]),match:hits.map((n,i)=>n/samples[i]),luminance:light.map((n,i)=>n/count[i])}
    })()`)
    assert.equal(measured.digest,'2afeffe53f76841bfbd9dd65ff2fdabc0669dc0ce7ba22f20d8d01918be661c7')
    assert.deepEqual(measured.source,[1536,804]);assert.ok(measured.backgroundMatch===1 && measured.match.reduce((a,b)=>a+b)/4>.60,name+' background '+JSON.stringify(measured))
    assert.ok(measured.luminance[0]>measured.luminance[1],name+' faction contrast')
    results.push({case:'background-'+name,...measured});await shot('open-'+name)
  }
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
  await click('.scene-close');await verifyBackground('deployment')
  const picked=await run(`(()=>{const vm=document.querySelector('.scene-shell').__vueParentComponent.setupState,c=document.querySelector('.battle-canvas'),b=c.getBoundingClientRect(),r=vm.renderer.deploymentGeometry();return r.names.map(n=>vm.renderer.pickUnit(b.left+n.x,b.top+n.y-n.size/2,'ally')===n.id)})()`)
  assert.ok(picked.length && picked.every(Boolean))
  const drag=await run(`(()=>{
    const vm=document.querySelector('.scene-shell').__vueParentComponent.setupState
    const c=document.querySelector('.battle-canvas'),b=c.getBoundingClientRect(),r=vm.renderer.deploymentGeometry()
    const from=r.names.find(n=>document.elementFromPoint(b.left+n.x,b.top+n.y-n.size/2)===c)
    if(!from)return null
    for(const x of [390,145,290,70])for(const y of [320,255,195]){
      const tx=b.left+r.left+x*r.scale,ty=b.top+r.top+(r.laneStart+(y-192)*r.laneScale)*r.scale
      if(document.elementFromPoint(tx,ty)===c && !vm.renderer.pickUnit(tx,ty,'ally') && Math.hypot(tx-b.left-from.x,ty-b.top-from.y)>50)
        return {id:from.id,sx:b.left+from.x,sy:b.top+from.y-from.size/2,tx,ty,x,y}
    }
  })()`)
  assert.ok(drag,'unobstructed deployment destination')
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:drag.sx,y:drag.sy,button:'left',buttons:1,clickCount:1})
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.tx,y:drag.ty,buttons:1})
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:drag.tx,y:drag.ty,button:'left',clickCount:1})
  const spot=await state('g.allies.find(a=>a.id==='+JSON.stringify(drag.id)+').campSpot')
  assert.ok(spot && Math.hypot(spot.x-drag.x,spot.y-drag.y)<2,'real deployment drop')
  results.push({case:'deployment-controls',names:picked.length,moved:drag.id,spot})

  await click('[data-tool=brief]')
  await wait('document.querySelector(".brief-intel")?.innerText.includes("刺客追击")')
  await shot('scout')
  results.push({case:'scout',intel:await run('document.querySelector(".brief-intel").innerText')})
  const opening=await boot('opening')
  assert.equal(opening.enemies.length,opening.schedule.length)
  assert.equal(opening.waveTime,0)
  assert.equal(new Set(opening.enemies.map(e=>e.x+'/'+e.y)).size,opening.schedule.length)
  await verifyBackground('elite-opening')
  results.push({case:'opening-field',wave:opening.wave,initial:opening.enemies.length,queued:opening.schedule.length-opening.spawnIndex})
  for(const name of ['boss-cast','late-field']){
    await boot(name)
    assert.ok(await state(name==='boss-cast'?'g.bossTelegraph?.remaining>0':'g.wave>=30 && g.enemies.some(e=>e.chanting)'))
    await verifyBackground(name)
  }
  for(const name of ['bonus','guard','hunt','split','chant','heal','bell','timeout','late-loss','standard12','endless12']){
    const before=await boot(name),start=before.combatLedger.enemyEvents.length
    await button('.field-controls','继续')
    const find='g.combatLedger.enemyEvents.slice('+start+').find(e=>e.kind==='+JSON.stringify(name)+' && '+(name==='split'?'e.amount===2':'(e.amount??1)>0')+')'
    const condition=name==='bell'?'g.lifeEvents.some(e=>e.kind==="bell-summon")':name==='timeout'?'g.waveTimeout!=null':name==='chant'?'g.enemies.some(e=>e.chanting)':name==='late-loss'?'g.lifeEvents.slice('+before.lifeEvents.length+').some(e=>e.source==="breach" && e.unitType==="brood" && e.amount===1)':name.endsWith('12')?'g.phase!=="battle"':find
    await wait(lens(condition))
    if(await state('g.phase==="battle"'))await button('.field-controls','暂停')
    const event=['bonus','guard','hunt','split','heal'].includes(name)?await state(find):null
    const row={case:name,mode:before.mode,seed:before.seed,wave:before.wave,at:await state('g.waveTime'),beforeLife:before.baseHp,life:await state('g.baseHp'),event,phase:await state('g.phase')}
    if(name==='bell'){
      row.summon=await state('g.lifeEvents.find(e=>e.kind==="bell-summon")')
      assert.equal(row.summon.unitType,'raider');assert.equal(row.summon.count,1)
    }
    if(name==='timeout'){
      row.timeout=await state('g.waveTimeout')
      assert.ok(row.timeout.count>0 && row.timeout.processed>0)
    }
    if(name==='late-loss'){
      row.loss=await state('g.lifeEvents.slice('+before.lifeEvents.length+').find(e=>e.source==="breach" && e.unitType==="brood")')
      assert.equal(row.loss.amount,1)
    }
    if(name==='chant')await verifyBackground('combat')
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
  const reference=await boot('standard12')
  await button('.field-controls','继续');await wait(lens('g.phase==="won"'))
  const expected=await state('({...g,effects:[]})')
  await boot('standard12');await click('.scene-menu-key');await click('.presentation-switch')
  await click('.scene-close');await click('.field-controls [aria-label*="倍速"]')
  await button('.field-controls','继续');await wait(lens('g.phase==="won"'))
  assert.deepEqual(await state('({...g,effects:[]})'),expected)
  results.push({case:'presentation-off-fast-battle',seed:reference.seed,identical:true,rng:expected.rng})
  assert.deepEqual(errors,[])
  await writeFile(new URL('browser.json',folder),JSON.stringify({viewport:[1366,900],method:'Legal action checkpoints, real play controls and browser ticker',results,errors},null,2)+'\n')
} finally {ws?.close();browser.kill();await new Promise(r=>browser.exitCode===null?browser.once('exit',r):r());await rm(profile,{recursive:true,force:true,maxRetries:4})}
