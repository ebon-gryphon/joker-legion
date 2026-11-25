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
import {lifeUiFixtures} from './life-ui-fixtures.mjs'

const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'output')
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),results=[],errors=[]
const groups=new Set((process.env.LEGION_LIFE_GROUPS || 'branches,sizes,results,journey').split(','))
async function persist(error){
 let previous=[];try{previous=JSON.parse(await readFile(join(output,'life-builds-ui-verification.json'),'utf8')).results || []}catch{}
 const key=row=>row.case || (row.size?'size-'+row.size.join('x'):'journey')
 const merged=new Map(previous.map(row=>[key(row),row]));for(const row of results)merged.set(key(row),row)
 await writeFile(join(output,'life-builds-ui-verification.json'),JSON.stringify({method:'Earned public-action fixtures and a separate same-new-game continuous journey; real browser ticker only.',poolSize:WAVE_REWARDS.length,results:[...merged.values()],errors,...(error?{error:String(error.stack || error)}:{})},null,2)+'\n')
}
await mkdir(output,{recursive:true})
let vite,chrome,ws,url=process.env.LEGION_TEST_URL
if(!url){try{if((await fetch('http://127.0.0.1:5187/')).ok)url='http://127.0.0.1:5187/'}catch{}}
if(!url){url='http://127.0.0.1:5191/';vite=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5191','--strictPort'],{cwd:root,stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await pause(100)}}
const profile=await mkdtemp(join(tmpdir(),'legion-life-build-ui-'))
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
 shot=async name=>{const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'life-build-'+name+'.png'),Buffer.from(screenshot.data,'base64'))}
 await send('Runtime.enable');await send('Page.enable')
 async function textClick(scope,text){
  const found=await run(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(e=>e.getClientRects().length&&!e.disabled&&e.innerText.includes(${JSON.stringify(text)}));if(!e)return false;e.dataset.lifeBuildQa='click';return true})()`)
  assert.ok(found,'Missing enabled button '+text);await click('[data-life-build-qa="click"]');await run("document.querySelector('[data-life-build-qa]')?.removeAttribute('data-life-build-qa')")
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
 const budget=game=>({gold:game.gold,crystals:game.crystals,life:game.baseHp,maxLife:game.maxBaseHp,lifeFailed:!!game.lifeFailed,energy:game.energy,hands:game.handsLeft,prints:game.printsLeft})
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
    else if(entry.type==='next-wave'){await desk('market');await click('.field-advance')}
    else if(entry.type==='battle-start'){
      const result=await battleUntilShop('journey-wave'+entry.wave)
      if(entry.wave===12){assert.equal(result.phase,'won');assert.deepEqual(result.rewards,[]);assert.deepEqual(result.shop,[]);assert.equal(result.lastSettlement,null);assert.equal(result.crystals,before.crystals);assert.equal(result.gold,before.gold);assert.equal(await run("document.querySelectorAll('.reward-card,.field-market').length"),0)}else{assert.equal(result.rewards.length,3,'Every non-terminal cleared wave offers three real rewards');assert.equal(result.phase,'shop');assert.equal(result.crystals-before.crystals,waveCrystalIncome(entry.wave))}
      if([1,5,6,10,12].includes(entry.wave))await shot('journey-wave'+entry.wave+'-cleared-three');
      waves.push({wave:entry.wave,phase:result.phase,life:result.baseHp,maxLife:result.maxBaseHp,gold:result.gold,crystals:result.crystals,kills:result.stats.kills,offers:result.rewards.map(row=>({id:row.id,name:row.name,direction:row.direction,duration:row.duration})),report:result.lastCombatReport})
      console.log(JSON.stringify({progress:'life-build-continuous-journey',wave:entry.wave,phase:result.phase,life:result.baseHp,maxLife:result.maxBaseHp,gold:result.gold}))
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
    await writeFile(join(output,'life-build-journey-actions.json'),JSON.stringify({seed:4,method:'Same browser and same new game from cover start to 12-wave victory; physical reward/buy/next controls and normal main action handlers, every battle uses the real browser ticker. No saved-game replacement.',continuedFromAction:fromAction,actions:records,waves},null,2)+'\n')
  }
  const end=await saved();assert.equal(end.phase,'won');assert.equal(end.stats.wavesCleared,12);assert.equal(end.lifeVersion,1);assert.equal(end.lifeFailed,false);assert.ok(end.baseHp>=0&&end.baseHp<=end.maxBaseHp);assert.equal(end.stats.crystalsEarned,route.finalSnapshot.stats.crystalsEarned);const triggered=Object.entries(end.buildPassives.counts).filter(([,count])=>count>0);assert.ok(triggered.length>=3,'Three distinct acquired passives must actually trigger');assert.equal(await run("document.querySelectorAll('.result-builds [data-build-passive]').length"),end.buildPassives.ids.length);assert.ok((await read('[data-result-life]')).includes(String(end.baseHp)));assert.ok((await read('[data-result-gold]')).includes(String(end.gold)));assert.ok((await read('[data-result-crystals]')).includes(String(end.crystals)))
  await shot('journey-main-12-wave-victory')
  return {ending:{phase:end.phase,wave:end.wave,wavesCleared:end.stats.wavesCleared,gate:end.baseHp,gold:end.gold,crystals:end.crystals,kills:end.stats.kills,life:end.baseHp,maxLife:end.maxBaseHp,buildPassives:end.buildPassives.ids.map(id=>({id,count:end.buildPassives.counts[id]})),triggeredDistinct:triggered.length,crystalsEarned:end.stats.crystalsEarned},actionsRecorded:records.length,waves:waves.map(({report,...wave})=>wave)}
 }


 assert.equal(WAVE_REWARDS.length,36,'The common weighted pool contains 24 rewards and 12 unique builds')
 const route=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false})
 assert.equal(route.result.phase,'won','The legitimate new-life route must reach final victory')
 const fixtures=lifeUiFixtures(),folder=join(output,'life-build-fixtures');await mkdir(folder,{recursive:true})
 for(const [id,fixture] of Object.entries(fixtures))await writeFile(join(folder,id+'.json'),JSON.stringify(fixture,null,2)+'\n')
 const live=()=>setup('JSON.parse(JSON.stringify({phase:s.game.phase,wave:s.game.wave,life:s.game.baseHp,maxLife:s.game.maxBaseHp,failed:s.game.lifeFailed,events:s.game.lifeEvents,enemies:s.game.enemies.map(u=>({id:u.id,type:u.type,summonedBy:u.summonedBy,bellSourceId:u.bellSourceId})),time:s.game.waveTime}))')
 async function verifyLife(game){const text=await read('[data-resource=life]');assert.ok(text.includes('生命'));assert.ok(text.includes(String(game.baseHp)));assert.ok(text.includes(String(game.maxBaseHp)));assert.equal((await read('[data-currency=gold] strong')).trim(),String(game.gold));assert.equal((await read('[data-currency=crystals] strong')).trim(),String(game.crystals))}
 async function pauseBattle(){if(await setup('!s.paused'))await textClick('.field-controls','暂停')}
 async function showLifeReport(){await desk('report');if(await run("!!document.querySelector('.report-life-events')")){await run("document.querySelector('.report-life-events').open=true");await pause(20)}}
 if(groups.has('branches')){
  await boot(fixtures['before-breach'].snapshot);await verifyLife(await saved());await textClick('.field-controls','继续')
  for(let n=0;n<200;n++){if((await live()).life<12)break;await pause(10)}
  await pauseBattle();const loss=await live();assert.ok(loss.life<12);assert.ok(loss.events.some(e=>e.kind==='loss'&&e.source==='breach'&&e.amount===1));assert.equal(loss.failed,false)
  await shot('actual-enemy-breach-hud');await showLifeReport();assert.ok((await read('.report-life')).includes('敌军突破'));await shot('actual-enemy-breach-report')
  results.push({case:'real-breach',status:'passed',prefixActions:fixtures['before-breach'].actions.length,after:loss})
  await boot(fixtures['before-heart-heal'].snapshot);await verifyLife(await saved());await desk('orders')
  const before=await saved();await click('.deploy-button');await wait("document.querySelector('.score-sequence')?.dataset.complete==='true'",160,25)
  const healed=await saved();assert.equal(healed.baseHp,before.baseHp+1);assert.equal(healed.lifeItemState.redEchoUsed,true);assert.equal(healed.lastDeploy.scoreTrace.items.find(item=>item.id==='red-echo').actual.effects.lifeHealed,1)
  await verifyLife(healed);await shot('actual-red-heart-life-heal');await showLifeReport();assert.ok((await read('.report-life')).includes('红心回响'));await shot('actual-red-heart-life-report')
  results.push({case:'real-heart-heal',status:'passed',prefixActions:fixtures['before-heart-heal'].actions.length,before:before.baseHp,after:healed.baseHp,actual:healed.lastDeploy.scoreTrace.items.find(item=>item.id==='red-echo').actual})
  await boot(fixtures['before-bell-summon'].snapshot);assert.ok((await read('.bell-alert')).includes('召唤'));await shot('actual-bell-summon-warning');const bellLife=(await live()).life;await textClick('.field-controls','继续')
  for(let n=0;n<200;n++){if((await live()).events.some(e=>e.kind==='bell-summon'))break;await pause(10)}
  await pauseBattle();const bell=await live(),summon=bell.events.find(e=>e.kind==='bell-summon');assert.ok(summon);assert.equal(bell.life,bellLife);assert.ok(bell.enemies.some(u=>u.id===summon.unitId&&u.type==='raider'&&u.summonedBy==='bellkeeper'))
  await shot('actual-bell-raider-spawn');await showLifeReport();assert.ok((await read('.report-life')).includes('援军'));await shot('actual-bell-life-report')
  results.push({case:'real-bell-reinforcement',status:'passed',prefixActions:fixtures['before-bell-summon'].actions.length,before:bellLife,after:bell.life,event:summon,newEnemy:bell.enemies.find(u=>u.id===summon.unitId)})
  await boot(fixtures['zero-safe'].snapshot);const zero=await saved();assert.equal(zero.baseHp,0);assert.equal(zero.lifeFailed,false);assert.equal(zero.phase,'battle');assert.ok((await read('.player-life-warning')).includes('不能再放入任何敌人'));await shot('zero-life-still-active')
  await textClick('.field-controls','继续');await wait("document.querySelector('.scene-shell')?.dataset.phase==='lost'",300,20);const failed=await saved(),failedEscape=failed.lifeEvents.find(e=>e.kind==='loss'&&e.failed);assert.equal(failed.lifeFailed,true);assert.ok(failedEscape&&failedEscape.before===0&&failedEscape.after===0&&failedEscape.amount===0&&failedEscape.attempted===1);await shot('zero-next-enemy-ends-run');results.push({case:'zero-is-safe',status:'passed',prefixActions:fixtures['zero-safe'].actions.length,life:0,failed:false,phase:zero.phase,nextEnemyFailure:failedEscape})
  await boot(null);await click('.cover-start');await textClick('.deal-options','险境');assert.ok((await read('.deal-options:not(.mode-options)')).includes('8'));await click('[data-actor="ghost"]');await click('.intro-start');await wait("!!document.querySelector('.scene-shell')");if(await run("!!document.querySelector('.tutorial-coach')"))await textClick('.tutorial-coach','结束引导');const veteran=await saved();assert.equal(veteran.difficulty,'veteran');assert.equal(veteran.baseHp,8);assert.equal(veteran.maxBaseHp,8);await verifyLife(veteran);await shot('veteran-eight-life')
  results.push({case:'veteran-eight-life',status:'passed',life:veteran.baseHp,maxLife:veteran.maxBaseHp})
 }
 if(groups.has('sizes'))for(const [width,height] of [[1366,900],[390,844],[360,740],[844,390],[768,1024]]){
  await boot(fixtures['zero-safe'].snapshot,width,height);await verifyLife(await saved());assert.ok((await read('.player-life-warning')).includes('不能再放入任何敌人'));assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'));assert.ok(await run(`(()=>{const strip=document.querySelector('.resource-strip'),r=strip.getBoundingClientRect(),cells=[...strip.children].map(e=>e.getBoundingClientRect());return cells.every((b,i)=>b.left>=r.left-1&&b.right<=r.right+1&&(!i||b.left>=cells[i-1].right-1))})()`),'HUD life, energy and balances must remain separate');await shot('size-'+width+'x'+height+'-zero-life');await showLifeReport();assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'));assert.ok(await run(`(()=>{const strip=document.querySelector('.resource-strip'),r=strip.getBoundingClientRect(),cells=[...strip.children].map(e=>e.getBoundingClientRect());return cells.every((b,i)=>b.left>=r.left-1&&b.right<=r.right+1&&(!i||b.left>=cells[i-1].right-1))})()`),'HUD life, energy and balances must remain separate');await shot('size-'+width+'x'+height+'-life-events');results.push({case:'size-'+width+'x'+height,size:[width,height],status:'passed',lifeWarning:true,events:true,dualBalances:true})
 }

 let beforeFinal
 if(groups.has('results')){replayBuild(route,{onTick:game=>{if(game.wave===12&&game.phase==='battle')beforeFinal=E.snapshotGame(game)}});assert.ok(beforeFinal&&E.restoreGame(beforeFinal));const last=route.actions.at(-1),actions=route.actions.slice(0,-1).concat({...last,params:{...last.params,count:last.params.count-1}});await writeFile(join(folder,'before-direct-victory.json'),JSON.stringify({seed:route.seed,actions,snapshot:beforeFinal,method:'All public actions through the tick before final clearance; browser resumes with the real ticker.'},null,2)+'\n')}
 if(groups.has('results'))for(const [width,height] of [[1366,900],[390,844],[360,740],[844,390],[768,1024]]){
  await boot(beforeFinal,width,height);await textClick('.field-controls','继续');await wait("document.querySelector('.scene-shell')?.dataset.phase==='won'");await wait('!!document.querySelector(".result-modal")')
  assert.equal(await setup('s.game.phase'),'won');assert.equal(await run("document.querySelector('.result-modal').scrollTop"),0)
  const shown=await run(`(()=>{const selectors=['#result-title','[data-result-life]','[data-result-gold]','[data-result-crystals]','.result-ledger>summary'];return selectors.every(css=>{const e=document.querySelector(css),r=e.getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<=innerHeight})})()`)
  assert.ok(shown,'The result opens at the victory title, real balances and build heading');assert.equal(await run("document.querySelectorAll('.result-builds [data-build-passive]').length"),route.result.buildPassives.ids.length)
  assert.equal(await run("document.querySelectorAll('.reward-card,.field-market').length"),0);assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'));await shot('result-'+width+'x'+height+'-top')
  await click('.result-ledger>summary');await click('.result-builds [data-build-passive]:last-child');await shot('result-'+width+'x'+height+'-actual-builds')
  results.push({case:'result-'+width+'x'+height,status:'passed',size:[width,height],legalPrefixActions:route.actions.length,directVictory:true,life:route.result.life,gold:route.result.gold,crystals:route.result.crystals,builds:route.result.buildPassives.ids})
 }
 if(groups.has('journey')){
  await boot(null);await click('.cover-start');await click('[data-actor="ghost"]');await click('[aria-label="固定种子"]');await send('Input.insertText',{text:'4'});await click('.intro-start')
  await wait("!!document.querySelector('.tutorial-coach')");await textClick('.tutorial-coach','结束引导')
  const complete=await continuousJourney(route,1);results.push({case:'journey',journey:{status:'passed',sameNewGame:true,...complete}})
 }
 assert.deepEqual(errors,[]);await persist()
}catch(error){await persist(error);throw error}finally{ws?.close();chrome?.kill();vite?.kill()}
