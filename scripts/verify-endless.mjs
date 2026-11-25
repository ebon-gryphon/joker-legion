import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {runBuildStrategy,replayBuild,BUILD_ROUTES} from './verify-builds.mjs'
import {restoreGame,snapshotGame} from '../src/engine.js'
import {MAX_ENEMIES} from '../src/campaignRules.js'

const output=new URL('../output/endless/',import.meta.url)
await mkdir(output,{recursive:true})
const results=[],fixtures=new Map()
const routes=[{...BUILD_ROUTES[0],mode:'standard'},...BUILD_ROUTES.map(base=>({...base,mode:'endless',stopWave:24})),
  ...[9,7].map(seed=>({...BUILD_ROUTES[1],mode:'endless',seed,difficulty:'veteran',stopWave:50}))]
for(const config of routes){
  const route=runBuildStrategy(config,{fixtures:false})
  const events=route.waves.flatMap(w=>w.report.enemyEvents)
  const lives=route.waves.flatMap(w=>w.report.lifeEvents)
  if(config.mode==='endless'){
    results.push({seed:route.seed,doctrine:config.doctrine,difficulty:route.difficulty,wave:route.result.wave,phase:route.result.phase,
      life:route.result.life,lowest:Math.min(...lives.map(e=>e.after)),cause:lives.findLast(e=>e.failed)?.source || '战后主动结束',
      actions:route.actions.length,behaviors:Object.fromEntries(['guard','hunt','bonus','split','heal'].map(kind=>[kind,events.filter(e=>e.kind===kind && (e.amount??1)>0).length]))})
  }
  const bonusWave=route.waves.find(w=>w.report.enemyEvents.some(e=>e.kind==='bonus' && e.amount>0))?.wave
  let prev
  replayBuild(route,{onAction:({action,before,after})=>{
    if(action.type==='battle-start' && !fixtures.has('scout') && before.wave>=7 && before.allies.some(u=>u.type==='healer'))fixtures.set('scout',before)
    if(action.type==='battle-start')prev=snapshotGame(after)
  },onTick:g=>{
    assert.ok(g.enemies.length<=MAX_ENEMIES)
    const key=config.mode==='standard'?'standard12':'endless12'
    const wantsCombat=g.wave<=12 && (!fixtures.has('heal')||!fixtures.has('hunt')||!fixtures.has('split')||!fixtures.has('guard')||!fixtures.has('chant'))
    const wantsLoss=config.seed===7 && g.wave>=13 && !fixtures.has('late-loss')
    const wantsBonus=g.wave===bonusWave && !fixtures.has('bonus')
    if(!wantsCombat && !wantsBonus && !wantsLoss && !(g.wave===12 && !fixtures.has(key)))return
    const save=(name,condition)=>{if(condition && prev?.phase==='battle' && !fixtures.has(name)) fixtures.set(name,prev)}
    const recent=g.combatLedger.enemyEvents.slice(prev?.combatLedger.enemyEvents.length)
    for(const kind of ['guard','hunt','split','heal','bonus'])save(kind,recent.some(e=>e.kind===kind && (kind==='split'?e.amount===2:kind==='hunt'?g.allies.some(u=>u.id===e.target && u.type==='healer'):(e.amount??1)>0)))
    save('chant',g.enemies.some(e=>e.chanting))
    if(wantsLoss)save('late-loss',g.lifeEvents.some(e=>e.kind==='loss' && ['breach','timeout'].includes(e.source) && e.amount===1))
    save(key,g.wave===12 && (g.phase==='shop' || g.phase==='won'))
    prev=snapshotGame(g)
  }})
  assert.ok(restoreGame(route.finalSnapshot),'restore final '+config.seed)
  console.log(config.mode,route.seed,route.result.wave,route.result.phase)
}
for(const name of ['standard12','endless12','guard','hunt','split','chant','heal','bonus','scout','late-loss']){
  const data=fixtures.get(name)
  assert.ok(data && restoreGame(data),'missing or invalid checkpoint '+name)
  await writeFile(new URL(name+'.json',output),JSON.stringify(data))
}
await writeFile(new URL('routes.json',output),JSON.stringify(results,null,2)+'\n')
