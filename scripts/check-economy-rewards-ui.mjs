#!/usr/bin/env node
// Public-action prefixes produce every fixture; browser battles use only the real main ticker.
// Run only after economy/reward core is frozen. Uses a fresh isolated Chrome profile.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {runBuildStrategy,BUILD_ROUTES,replayBuild} from './verify-builds.mjs'
import {JOKERS} from '../src/engine.js'
import * as E from '../src/engine.js'
import {WAVE_REWARDS} from '../src/waveRewards.js'
import {shopActionAvailability,sellValue} from '../src/fieldShop.js'
import {waveCrystalIncome} from '../src/economy.js'

const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'output')
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),results=[],errors=[]
const groups=new Set((process.env.LEGION_ECONOMY_GROUPS || 'checkpoints,sizes,opening,journey').split(','))
async function persist(error){
 let previous=[];try{previous=JSON.parse(await readFile(join(output,'economy-rewards-ui-verification.json'),'utf8')).results || []}catch{}
 const key=row=>row.wave?'wave-'+row.wave:row.size?'size-'+row.size.join('x'):row.openingScore?'opening':'journey'
 const merged=new Map(previous.map(row=>[key(row),row]));for(const row of results)merged.set(key(row),row)
 await writeFile(join(output,'economy-rewards-ui-verification.json'),JSON.stringify({method:'Earned public-action fixtures and a separate same-new-game continuous journey; real browser ticker only.',poolSize:WAVE_REWARDS.length,results:[...merged.values()],errors,...(error?{error:String(error.stack || error)}:{})},null,2)+'\n')
}
await mkdir(output,{recursive:true})
let vite,chrome,ws,url=process.env.LEGION_TEST_URL
if(!url){try{if((await fetch('http://127.0.0.1:5187/')).ok)url='http://127.0.0.1:5187/'}catch{}}
if(!url){url='http://127.0.0.1:5191/';vite=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5191','--strictPort'],{cwd:root,stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await pause(100)}}
const profile=await mkdtemp(join(tmpdir(),'legion-economy-ui-'))
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
  await run(`document.querySelector(${JSON.stringify(css)}).scrollIntoView({block:'nearest'})`)
  await wait(`(()=>{const e=document.querySelector(${JSON.stringify(css)});if(!e)return false;const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`)
  const point=await run(`(()=>{const e=document.querySelector(${JSON.stringify(css)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`)
  assert.ok(point.hit,css+' is obscured')
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1})
  if(delay)await pause(delay)
 }
 read=css=>run(`document.querySelector(${JSON.stringify(css)})?.innerText || ''`)
 saved=()=>run("JSON.parse(localStorage.getItem('joker.legion.demo.v1'))")
 setup=expression=>run(`(()=>{const raw=document.querySelector('.scene-shell').__vueParentComponent.setupState;const s=new Proxy(raw,{get(target,key){const value=target[key];return value?.__v_isRef?value.value:value}});return (${expression})})()`)
 shot=async name=>{const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'economy-'+name+'.png'),Buffer.from(screenshot.data,'base64'))}
 await send('Runtime.enable');await send('Page.enable')
 async function textClick(scope,text){
  const found=await run(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(e=>e.getClientRects().length&&!e.disabled&&e.innerText.includes(${JSON.stringify(text)}));if(!e)return false;e.dataset.economyQa='click';return true})()`)
  assert.ok(found,'Missing enabled button '+text);await click('[data-economy-qa="click"]');await run("document.querySelector('[data-economy-qa]')?.removeAttribute('data-economy-qa')")
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

 async function battleUntilShop(prefix) {
  await click('.field-advance');await wait("document.querySelector('.scene-shell')?.dataset.phase==='battle'")
  const control=await run("[...document.querySelectorAll('.field-controls button')].find(e=>e.getAttribute('aria-label')?.includes('1倍速'))?.getAttribute('aria-label')")
  if(control)await click('.field-controls button[aria-label='+JSON.stringify(control)+']')
  await wait("['shop','won','lost'].includes(document.querySelector('.scene-shell')?.dataset.phase)",900,40)
  await shot(prefix+'-actual-wave-end');return saved()
 }
 const budget=game=>({gold:game.gold,crystals:game.crystals,energy:game.energy,hands:game.handsLeft,prints:game.printsLeft})
 async function continuousJourney(route,fromAction=1) {
  const reference=new Map(),unitIds=new Map(),records=[],waves=[]
  replayBuild(route,{onAction:({before,after,action})=>reference.set(action.n,{before,after:E.snapshotGame(after)})})
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
      assert.deepEqual(before.rewards.map(row=>row.id),p.offers,'Real three offers at '+entry.n)
      if(await run("!!document.querySelector('.wave-victory>button')"))await click('.wave-victory>button')
      await wait('!!document.querySelector('+JSON.stringify('.reward-card[data-reward='+p.id+']')+')');assert.equal(before.rewards.length,3);assert.ok(p.offers.includes(p.id));await click('.reward-card[data-reward='+p.id+']');
      await wait("!!document.querySelector('.field-market')");waves.find(row=>row.wave===entry.wave).claimed=p.id;
      if([1,5,6,10,12].includes(entry.wave))await shot('journey-wave'+entry.wave+'-claimed-shop')
    }else if(entry.type==='buy'){
      assert.deepEqual(before.shop,p.offers,'Real seeded shop offers at '+entry.n)
      const item=JOKERS.find(item=>item.id===p.id),status=shopActionAvailability(before,'buy',p.id);assert.equal(status.available,true);
      await click('.purchase-button[aria-label='+JSON.stringify('购买'+item.name+' · '+status.price+' 蓝水晶')+']');waves.find(row=>row.wave===entry.wave).purchases ||= [];waves.find(row=>row.wave===entry.wave).purchases.push(p.id)
    }else if(entry.type==='research')await setup('s.train('+JSON.stringify(p.key)+')')
    else if(entry.type==='next-wave'){await desk('market');if(entry.wave===12)assert.ok((await read('.field-advance')).includes('完成远征'));await click('.field-advance')}
    else if(entry.type==='battle-start'){
      const result=await battleUntilShop('journey-wave'+entry.wave)
      assert.equal(result.rewards.length,3,'Every cleared wave offers three real rewards');assert.equal(result.phase,'shop');
      assert.equal(result.crystals-before.crystals,waveCrystalIncome(entry.wave));
      if([1,5,6,10,12].includes(entry.wave))await shot('journey-wave'+entry.wave+'-cleared-three');
      waves.push({wave:entry.wave,phase:result.phase,gate:result.baseHp,gold:result.gold,crystals:result.crystals,kills:result.stats.kills,offers:result.rewards.map(row=>({id:row.id,name:row.name,direction:row.direction,duration:row.duration})),report:result.lastCombatReport})
      console.log(JSON.stringify({progress:'economy-continuous-journey',wave:entry.wave,phase:result.phase,gate:result.baseHp,gold:result.gold}))
      records.push({n:entry.n,wave:entry.wave,type:entry.type,params:actualParams,before:budget(before),after:entry.after,source:'same new game / real mouse begin / real requestAnimationFrame ticker'})
      continue
    }else if(entry.type!=='tick')throw Error('Unsupported real UI action '+entry.type)
    after ||= await saved()
    assert.deepEqual(budget(after),entry.after,'Actual UI budget after '+entry.n+' '+entry.type)
    const expectedNew=members(reference.get(entry.n).after).filter(unit=>!members(reference.get(entry.n).before).some(old=>old.id===unit.id))
    const actualNew=members(after).filter(unit=>!members(before).some(old=>old.id===unit.id))
    if(entry.type==='deploy'){
      assert.equal(actualNew.length,expectedNew.length,'Actual recruitment branch at '+entry.n)
      for(let i=0;i<expectedNew.length;i++)unitIds.set(expectedNew[i].id,actualNew[i].id)
    }
    records.push({n:entry.n,wave:entry.wave,type:entry.type,params:actualParams,before:entry.type==='tick'?entry.before:budget(before),after:budget(after),...(entry.type==='deploy'?{scoreTrace:after.lastDeploy.scoreTrace}:{}),...(entry.type==='tick'?{source:'observed real ticker; no scripted tick call'}:{})})
    await writeFile(join(output,'economy-journey-actions.json'),JSON.stringify({seed:4,method:'Same browser and same new game from cover start to 12-wave victory; physical reward/buy/next controls and normal main action handlers, every battle uses the real browser ticker. No saved-game replacement.',continuedFromAction:fromAction,actions:records,waves},null,2)+'\n')
  }
  const end=await saved();assert.equal(end.phase,'won');assert.equal(end.stats.wavesCleared,12);assert.equal(end.baseHp,100)
  await shot('journey-main-12-wave-victory')
  return {ending:{phase:end.phase,wave:end.wave,wavesCleared:end.stats.wavesCleared,gate:end.baseHp,gold:end.gold,crystals:end.crystals,kills:end.stats.kills},actionsRecorded:records.length,waves:waves.map(({report,...wave})=>wave)}
 }

 // A complete deterministic replay proves these are earned prefixes, rather than invented soldiers or balances.
 assert.ok(WAVE_REWARDS.length>=24,'The shared reward catalog needs at least 24 genuine definitions')
 const route=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false}),checkpoints=new Map()
 assert.equal(route.result.phase,'won','The legitimate economy route must reach final victory')
 replayBuild(route,{onAction:({before,action})=>{
  if(action.type==='battle-start' && [1,5,6,10,12].includes(action.wave))checkpoints.set(action.wave,{snapshot:before,actions:route.actions.slice(0,action.n-1)})
 }})
 await mkdir(join(output,'economy-fixtures'),{recursive:true})
 for(const [wave,earned] of checkpoints)await writeFile(join(output,'economy-fixtures','before-wave-'+wave+'.json'),JSON.stringify({seed:route.seed,wave,method:'Only public actions; complete legal prefix replayed from a new game',...earned},null,2)+'\n')
 const shops=[]
 const number=async css=>Number(await run(`document.querySelector(${JSON.stringify(css)})?.textContent.trim()`))
 async function verifyHud(game){assert.equal(await number('[data-currency=gold] strong'),game.gold);assert.equal(await number('[data-currency=crystals] strong'),game.crystals)}
 async function supplies(){
  if(await run("!!document.querySelector('.wave-victory>button')"))await click('.wave-victory>button')
  await wait("document.querySelectorAll('.reward-card').length===3")
 }
 async function claimFirst(){
  const game=await saved() // Eligibility comes directly from the core-driven reward button.
  const id=await run("[...document.querySelectorAll('.reward-card')].find(e=>!e.disabled)?.dataset.reward")
  assert.ok(id,'The genuine three offers need an available choice')
  await click('.reward-card[data-reward='+JSON.stringify(id)+']')
  await wait("!!document.querySelector('.field-market')")
  const after=await saved();assert.equal(after.rewardChosen,id);assert.equal(after.rewardState?.claimedId ?? id,id)
  await verifyHud(after);return {id,before:game,after}
 }
 async function verifyThree(game){
  assert.equal(game.rewards.length,3);assert.equal(new Set(game.rewards.map(row=>row.id)).size,3)
  const actual=await run("[...document.querySelectorAll('.reward-card')].map(e=>({id:e.dataset.reward,text:e.innerText,disabled:e.disabled}))")
  assert.equal(actual.length,3)
  for(const offer of game.rewards){const card=actual.find(row=>row.id===offer.id);assert.ok(card && card.text.includes(offer.name));assert.ok(card.text.includes(offer.duration));if(!card.disabled)assert.ok(card.text.includes(offer.description))}
  return actual
 }
 async function shopActions(wave){
  let game=await saved();await verifyHud(game)
  let offers=game.shop.map(id=>JOKERS.find(item=>item.id===id)),buy=offers.find(item=>shopActionAvailability(game,'buy',item.id).available)
  // Selling an owned item is an ordinary user action; it never creates spending currency from gold.
  if(!buy){const owned=game.jokers.find(item=>shopActionAvailability(game,'sell',item.id).available);if(owned){
   await click('.hud-relics button[aria-label^='+JSON.stringify('查看'+owned.name)+']');const before=await saved();await click('.joker-modal .key-price');game=await saved();assert.equal(game.gold,before.gold);assert.equal(game.crystals,before.crystals+sellValue(owned));buy=offers.find(item=>shopActionAvailability(game,'buy',item.id).available)
  }}
  const transactions=[]
  if(buy){
   const before=await saved(),status=shopActionAvailability(before,'buy',buy.id)
   await click('.purchase-button[aria-label='+JSON.stringify('购买'+buy.name+' · '+status.price+' 蓝水晶')+']')
   let after=await saved();assert.equal(after.gold,before.gold);assert.equal(after.crystals,before.crystals-status.price);transactions.push({kind:'buy',id:buy.id,spent:status.price})
   await click('.hud-relics button[aria-label^='+JSON.stringify('查看'+buy.name)+']');const sale=await saved();await click('.joker-modal .key-price');after=await saved();assert.equal(after.gold,sale.gold);assert.equal(after.crystals,sale.crystals+sellValue(buy));transactions.push({kind:'sell',id:buy.id,gained:sellValue(buy)})
  }
  game=await saved();const reroll=shopActionAvailability(game,'reroll')
  if(reroll.available){await click('.market-reroll button');const after=await saved();assert.equal(after.gold,game.gold);assert.equal(after.crystals,game.crystals-reroll.price);transactions.push({kind:'reroll',spent:reroll.price})}
  const unavailable=await run("[...document.querySelectorAll('.purchase-button:disabled')].map(e=>({described:e.getAttribute('aria-describedby'),reason:e.parentElement.querySelector('.market-unavailable')?.innerText || ''}))")
  for(const button of unavailable)assert.ok(button.described && button.reason)
  if(wave===1)assert.ok(transactions.some(row=>row.kind==='buy'),'First-wave reward and legitimate shop purchase must be exercised')
  await verifyHud(await saved());return transactions
 }
 if(groups.has('checkpoints'))for(const [wave,earned] of checkpoints){
  const started=Date.now();await boot(earned.snapshot)
  await verifyHud(await saved());assert.equal((await saved()).wave,wave)
  if(wave===6)assert.ok(earned.snapshot.schedule.some(row=>row.type==='boss'))
  if(wave===12)assert.ok(earned.snapshot.schedule.some(row=>row.type==='finalBoss'))
  await click('.field-advance');await wait("document.querySelector('.scene-shell')?.dataset.phase==='battle'")
  const speed=await run("[...document.querySelectorAll('.field-controls button')].find(e=>e.getAttribute('aria-label')?.includes('1倍速'))?.getAttribute('aria-label')")
  if(speed)await click('.field-controls button[aria-label='+JSON.stringify(speed)+']')
  await wait("['shop','won','lost'].includes(document.querySelector('.scene-shell')?.dataset.phase)",2000,40)
  const cleared=await saved();assert.equal(cleared.phase,'shop');assert.equal(cleared.stats.wavesCleared,wave)
  assert.equal(cleared.crystals-earned.snapshot.crystals,waveCrystalIncome(wave));assert.equal(cleared.lastSettlement.crystals.base,5);assert.equal(cleared.lastSettlement.crystals.bonus,[5,10].includes(wave)?5:0)
  assert.deepEqual(cleared.lastCombatReport.economy,cleared.lastSettlement)
  await verifyHud(cleared)
  assert.ok((await read('.economy-summary')).includes('蓝水晶 +'+waveCrystalIncome(wave)))
  assert.equal(await run("!!document.querySelector('.field-market')"),false)
  await setup('s.setDesk("market")');assert.equal(await run("!!document.querySelector('.field-market')"),false)
  await supplies();const cards=await verifyThree(cleared)
  await shot('wave'+wave+'-actual-three-offers');shops.push(cleared)
  const claimed=await claimFirst(),transactions=await shopActions(wave)
  const after=await saved();assert.equal(after.rewardChosen,claimed.id)
  await shot('wave'+wave+'-actual-shop')
  if(wave===12){assert.equal(after.finalWaveCleared,true);assert.ok((await read('.field-advance')).includes('完成远征'));await click('.field-advance');await wait("document.querySelector('.scene-shell')?.dataset.phase==='won'");const won=await saved();assert.equal(won.wave,12);assert.equal(won.stats.wavesCleared,12);assert.equal(won.crystals,after.crystals);assert.equal(won.gold,after.gold);await shot('wave12-final-victory')}
  results.push({wave,status:'passed',elapsedMs:Date.now()-started,legalPrefixActions:earned.actions.length,crystalsIncome:cleared.lastSettlement.crystals,goldIncome:cleared.lastSettlement.gold,reward:claimed.id,offers:cards,transactions,ending:(await saved()).phase});console.log(JSON.stringify(results.at(-1)))
 }
 if(groups.has('sizes'))for(const [width,height] of [[1366,900],[390,844],[360,740],[844,390],[768,1024]]){
  await boot(shops[0],width,height);await supplies();await verifyThree(await saved());await verifyHud(await saved())
  assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'))
  const before=await saved(),claimed=await claimFirst();assert.equal((await saved()).wave,before.wave)
  await shot('size-'+width+'x'+height);results.push({size:[width,height],status:'passed',threeOffers:true,dualBalances:true,claimed:claimed.id})
 }
 if(groups.has('opening')){
 // A short, fully legal seeded first-wave prefix supplies a real opening-score offer.
 let opening
 for(let seed=1;seed<=48&&!opening;seed++){
  const game=E.createGame({seed:'economy-opening-'+seed,doctrine:'iron'}),actions=[]
  for(let play=0;play<3;play++){
   const ids=E.recommendHand(game);if(!ids?.length)break
   for(const id of ids)assert.ok(E.selectCard(game,id));actions.push({type:'select',ids:[...ids]})
   if(!E.previewHand(game).canDeploy)break
   assert.ok(E.deploy(game));actions.push({type:'deploy',score:game.lastDeploy.score,key:game.lastDeploy.key})
  }
  if(!game.allies.length)continue
  assert.ok(E.beginBattle(game));actions.push({type:'battle-start'})
  let count=0;while(game.phase==='battle'&&count<1000){E.tick(game,.25);count++}actions.push({type:'tick',count,dt:.25})
  if(game.phase==='shop'&&game.rewards.some(row=>row.id==='opening-score'))opening={snapshot:E.snapshotGame(game),actions,seed:game.seed}
 }
 assert.ok(opening,'A real eligible opening-score offer must be found without resource injection')
 assert.ok(E.restoreGame(opening.snapshot));await writeFile(join(output,'economy-fixtures/before-opening-score.json'),JSON.stringify(opening,null,2)+'\n')
 await boot(opening.snapshot);await supplies();await click('.reward-card[data-reward="opening-score"]')
 await wait("!!document.querySelector('.field-market')");assert.equal((await saved()).waveBonuses.next.firstScorePercent,.25)
 await click('.field-advance');await wait("document.querySelector('.scene-shell')?.dataset.phase==='ready'")
 const first=await saved();await setup('s.chooseCard('+JSON.stringify(first.hand[0].id)+')')
 const preview=await setup('({trace:s.preview.scoreTrace,score:s.preview.score.total})')
 assert.ok(preview.trace.finalBonus && preview.trace.finalBonus.percent===.25)
 assert.equal(preview.score,preview.trace.chipsBeforeMult*preview.trace.mult+preview.trace.finalBonus.amount)
 assert.ok((await read('.score-source-summary')).includes('25%'))
 await click('.score-detail-toggle');assert.ok((await read('[data-score-final-bonus]')).includes('独立于牌谱倍率'))
 assert.ok((await read('.score-final-ledger')).includes('＋ '+preview.trace.finalBonus.amount+' 奖励分'))
 await shot('opening-score-real-preview');await click('.deploy-button')
 await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'",160,25)
 const accepted=await saved();assert.equal(accepted.lastDeploy.score,preview.score);assert.equal(accepted.waveBonuses.active.firstScorePercent || 0,0)
 await setup('s.chooseCard('+JSON.stringify(accepted.hand[0].id)+')');assert.equal(await setup('s.preview.scoreTrace.finalBonus || null'),null)
 results.push({openingScore:{status:'passed',seed:opening.seed,percent:25,actualBonus:preview.trace.finalBonus.amount,score:preview.score,consumedOnce:true,legalPrefixActions:opening.actions.length}})
 }
 if(groups.has('journey')){
  await boot(null);await click('.cover-start');await click('[data-actor="ghost"]');await click('[aria-label="固定种子"]');await send('Input.insertText',{text:'4'});await click('.intro-start')
  await wait("!!document.querySelector('.tutorial-coach')");await textClick('.tutorial-coach','结束引导')
  const complete=await continuousJourney(route,1);results.push({journey:{status:'passed',sameNewGame:true,...complete}})
 }
 assert.deepEqual(errors,[]);await persist()
}catch(error){await persist(error);throw error}finally{ws?.close();chrome?.kill();vite?.kill()}
