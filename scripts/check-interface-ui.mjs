import assert from 'node:assert/strict'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {withBrowser} from './ui-browser.mjs'
import {BUILD_ROUTES, replayBuild, runBuildStrategy} from './verify-builds.mjs'

const url=process.env.LEGION_TEST_URL || 'http://127.0.0.1:5199'
const root=new URL('../output/ui-review/',import.meta.url)
const fixture=name=>readFile(new URL('../output/endless/'+name+'.json',import.meta.url),'utf8').then(JSON.parse)
const route=runBuildStrategy({...BUILD_ROUTES[0],runId:'interface-review-seed4'},{fixtures:false})
const checkpoints={}
replayBuild(route,{onAction({before,action}) {
  const key=action.params.kind || action.type
  if(!checkpoints[key])checkpoints[key]={before,action}
  if(action.type==='deploy' && action.params.expectedKey==='flushFive')checkpoints.score ??= {before,action}
}})
const rows=[]
for(const [width,height] of [[1366,900],[1920,1080]]) {
  const size=width+'x'+height
  const folder=new URL(size+'/',root)
  await mkdir(folder,{recursive:true})
  await withBrowser(folder,async ({send,run,wait,click,button,state,shot,errors,pause})=>{
    await send('Runtime.enable');await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    async function boot(save) {
      const key='joker.legion.demo.v1'+(save?.mode==='endless'?'.endless':'')
      const source='localStorage.clear();sessionStorage.clear();'+(save?'localStorage.setItem('+JSON.stringify(key)+','+JSON.stringify(JSON.stringify({...save,handSelection:"manual"}))+')':'')
      const install=await send('Page.addScriptToEvaluateOnNewDocument',{source})
      await send('Page.navigate',{url});await wait('!!document.querySelector(".cover-start")')
      await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:install.identifier})
      if(save){await click('.deal-resume');await wait('!document.querySelector(".joker-table")')}
    }
    async function capture(id,label,scope) {
      await wait('!!document.querySelector('+JSON.stringify(scope)+')?.getClientRects().length')
      await run('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))')
      await pause(160)
      const audit=await run('('+inspectLayout.toString()+')('+JSON.stringify(scope)+')')
      assert.equal(audit.pageOverflow,false,id+' horizontal page overflow')
      assert.equal(audit.overflows.length,0,id+' overflowing text '+JSON.stringify(audit.overflows))
      assert.equal(audit.covered.length,0,id+' covered controls '+JSON.stringify(audit.covered))
      assert.equal(audit.undersized.length,0,id+' small type '+JSON.stringify(audit.undersized))
      await shot(id);rows.push({size,id,label,...audit});console.log(size,id,label)
    }
    const escape=async()=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape'})}
    const tool=async id=>{await click('.scene-close');await click('[data-tool='+id+']')}
    await boot()
    await capture('01-cover','封面','.cover-menu')
    await click('.cover-score')
    const volume='.settings-volume input'
    await click(volume);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'})
    assert.ok(await run('Number(document.querySelector(".settings-volume input").value)<100'))
    await capture('02-settings','演出与声音','.settings-modal');await escape()
    await click('.legacy-open');await capture('03-inheritance','军团传承','.legacy-grid');await escape()
    await click('.cover-start');await click('[data-actor=mirror]');await click('[data-mode=endless]')
    await capture('04-casting','军略、难度与每日入口','.casting-stage')
    await click('.daily-record summary');await capture('04b-daily-record','每日成绩与空状态','.daily-record')
    await click('.daily-deal');await wait('!document.querySelector(".joker-table")')
    assert.ok((await state('g.seed')).startsWith('daily-'))
    await capture('05-daily','每日同局开营','.field-head')
    await boot(checkpoints.print.before)
    await tool('press')
    const printing=checkpoints.print.action.params
    const cards=checkpoints.print.before.hand
    const index=id=>cards.findIndex(c=>c.id===id)+1
    await click('.press-hand button:nth-child('+index(printing.source.id)+')')
    for(const card of printing.targets)await click('.press-hand button:nth-child('+index(card.id)+')')
    await capture('06-print','牌匠改印预览','.inline-press')
    const gold=await state('g.gold');await click('.press-pay button')
    assert.equal(await state('g.gold'),checkpoints.print.action.after.gold);assert.ok(await state('g.gold')<gold)
    await boot((checkpoints.score || checkpoints.deploy).before)
    await capture('07-hand','出牌征兵与计分','.hand-section')
    await click('.score-detail-toggle');await capture('08-score','逐项计分明细','.score-details')
    await click('.score-detail-toggle');await click('.deploy-button')
    assert.equal(await state('g.lastDeploy.score'),(checkpoints.score || checkpoints.deploy).action.params.expectedScore)
    await boot(checkpoints.profession.before);await tool('forge')
    await button('.forge-modes','双兵融合');await click('.forge-tile.ready')
    await capture('09-fusion','双兵融合与材料流向','.forge-bench')
    const units=await state('g.allies.length');await click('.forge-commit .key-command')
    assert.equal(await state('g.allies.length'),units-1)
    await boot(checkpoints.promote.before);await tool('forge');await button('.forge-modes','同兵升星');await click('.forge-tile.ready')
    await capture('10-promote','同兵升星与继承预览','.forge-bench')
    await boot(await fixture('scout'));await click('.scene-close')
    await capture('11-deployment','战前部署','.scene-tools')
    await click('[data-tool=brief]');await click('.formation-list button:nth-child(2)')
    await capture('12-intel','军情与阵型','.brief-body')
    await click('.brief-guide-link');await capture('13-enemies','敌军图鉴','#brief-title')
    await click('.scene-menu-key');await button('.menu-actions','玩法指南')
    await capture('14-manual','玩法手册','.help-modal');await escape()
    await button('.menu-actions','军团图鉴');await capture('15-codex','军团图鉴','.codex-modal');await escape()
    await button('.menu-actions','玩法指南');await button('.help-modal','十二种牌型')
    await capture('16-book','牌型图鉴','.poker-modal')
    await boot(await fixture('guard'));await button('.field-controls','继续')
    await wait('document.querySelector(".scene-shell").__vueParentComponent.setupState.game.waveTime>0.25')
    await capture('17-battle','普通交战','.field-head')
    await boot(await fixture('boss-cast'));await capture('18-boss','首领技能预警','.field-head')
    await boot(checkpoints.reward.before)
    await capture('19-report','守波战报','.wave-victory');await click('.wave-victory .field-report>summary');await click('.soldier-contributions>summary');await capture('19b-ledger','逐名贡献','.personal-report')
    await click('.wave-victory>button');await capture('20-reward','免费三选一','.reward-grid')
    await click('.reward-card:not(:disabled)');await capture('21-market','蓝晶货架','.field-market')
    const balance=await state('g.crystals')
    await click('.purchase-button:enabled')
    assert.ok(await state('g.crystals')<balance);assert.ok((await state('g.soldShop')).length)
    const spent=await state('g.crystals')
    if(await run('!document.querySelector(".market-reroll button").disabled')){
      await click('.market-reroll button');assert.ok(await state('g.crystals')<spent)
    }
    await click('.scene-menu-key');await button('.menu-actions','战报与本地历史');await capture('21b-history','本地战报与历史选择','.battle-history-tools')
    await boot(route.finalSnapshot);await wait('!!document.querySelector(".legacy-result strong")')
    await capture('22-result','胜利、军团成果与红水晶','.result-modal')
    assert.equal(await state('g.rng'),route.finalSnapshot.rng)
    await button('.result-modal','再开一局');await click('.legacy-open')
    await click('[data-legacy-node=treasury]');await wait('document.querySelector("[data-legacy-node=treasury]").dataset.level==="1"')
    await capture('23-upgrade','购买后的传承节点','.legacy-grid')
    assert.deepEqual(errors,[])
  })
}
await writeFile(new URL('inspection.json',root),JSON.stringify(rows,null,2))
await writeFile(new URL('index.html',root),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>小丑军团 · 界面验收</title><style>body{background:#211b20;color:#eee1d2;font:16px system-ui;margin:4vw}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}a{color:inherit;text-decoration:none}img{display:block;width:100%;margin-bottom:4px}h2{border-bottom:1px solid #78545e;padding-bottom:12px}</style><h1>小丑军团 · 界面验收</h1>'+['1366x900','1920x1080'].map(size=>'<h2>'+size+'</h2><main>'+rows.filter(r=>r.size===size).map(r=>'<a href="'+size+'/'+r.id+'.png"><img loading="lazy" src="'+size+'/'+r.id+'.png" alt="'+r.label+'">'+r.label+'</a>').join('')+'</main>').join('')+'</html>')

function inspectLayout(scope) {
  const box=document.querySelector(scope)
  const leaves=[...box.querySelectorAll('b,strong,span,small,button,p,summary')].filter(e=>e.getClientRects().length&&!e.children.length&&e.textContent.trim())
  const overflows=leaves.filter(e=>e.clientWidth && e.scrollWidth>e.clientWidth+2 && getComputedStyle(e).overflowX==='hidden').map(e=>e.textContent.slice(0,40))
  const sizes=leaves.map(e=>parseFloat(getComputedStyle(e).fontSize))
  const undersized=leaves.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).map(e=>[e.closest('[class]')?.className,e.tagName,e.textContent.slice(0,22)])
  const covered=[]
  let checked=0
  for(const e of box.querySelectorAll('button,select,input,summary')){
    if(!e.checkVisibility() || e.closest('[inert]') || e.disabled)continue
    const rect=e.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2
    if(!rect.width || !rect.height || x<0 || x>=innerWidth || y<0 || y>=innerHeight)continue
    // Offscreen content in a scrollport remains accessible by scrolling that port.
    let clipped=false
    for(let parent=e.parentElement;parent;parent=parent.parentElement){
      const css=getComputedStyle(parent),r=parent.getBoundingClientRect()
      if((css.overflowX!=='visible' && (x<r.left || x>=r.right)) || (css.overflowY!=='visible' && (y<r.top || y>=r.bottom))){clipped=true;break}
    }
    if(clipped)continue
    checked++
    if(!e.contains(document.elementFromPoint(x,y)))covered.push(e.getAttribute('aria-label') || e.textContent.trim().slice(0,32))
  }
  return {undersized,checked,covered,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,overflows,smallestText:sizes.length?Math.min(...sizes):null}
}
