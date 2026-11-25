import test from 'node:test'
import assert from 'node:assert/strict'
import {BUILD_ROUTES,runBuildStrategy,replayBuild} from '../scripts/verify-builds.mjs'
import {addUnit,createGame,snapshotGame,restoreGame,tick} from './engine.js'
import {mergePreview,mergeWarning} from './forge.js'
import {waveInfo,developmentWave,endlessScale,ENDLESS} from './endless.js'
import {waveSchedule,makeSchedule} from './waveSchedule.js'
import {enemyPaintOffsets,readableLabels} from './fieldReadability.js'
import {backgroundFrame} from './battlefieldScenery.js'
import {paintRites,paintHostileSignals} from './hostileSignals.js'
import {deriveDeployFacts} from './presentationFacts.js'
import {createPresentationScene} from './presentationScene.js'

const route=(base,options={})=>runBuildStrategy({stopWave:60,...base,mode:'endless'},{fixtures:false,...options})
const losses=w=>w.report.lifeEvents.filter(e=>e.kind==='loss' && e.amount>0)

test('同一公开策略先真实漏怪、守住过渡波，随后才真正失守',()=>{
  const run=route(BUILD_ROUTES[1]),early=run.waves.find(w=>losses(w).length)
  assert.ok(early.wave>12 && early.wave<run.result.wave)
  assert.equal(early.phase,'shop')
  assert.ok(early.life>0)
  assert.ok(run.waves.slice(early.wave, -1).every(w=>w.phase==='shop'))
  assert.equal(run.result.phase,'lost')
  assert.ok(run.waves.at(-1).report.lifeEvents.some(e=>e.failed && ['timeout','breach','boss-breach','boss-timeout'].includes(e.source)))
})

test('鬼手仍养成五名虹晶主将，经历多波压力后失守',()=>{
  let ranks
  const run=route(BUILD_ROUTES[0],{onBattleStart:g=>{ranks=g.allies.map(u=>[u.grade,u.jobId])}})
  assert.equal(ranks.length,5)
  assert.ok(ranks.every(([grade,job])=>grade===6 && job==='sovereign'))
  const first=run.waves.find(w=>losses(w).length)
  assert.ok(first.phase==='shop' && first.wave<run.result.wave && run.result.wave>36)
  assert.equal(run.result.phase,'lost')
})

test('实际分裂生成的幼兽越线扣生命，旧检查点恢复后得到相同战报',()=>{
  let start,checkpoint,original,wave
  const run=route({...BUILD_ROUTES[2],seed:6},{onBattleStart:g=>{start=snapshotGame(g)},onBattleEnd:g=>{
    if(!checkpoint && g.wave>12 && g.lastCombatReport.lifeEvents.some(e=>e.source==='breach' && e.unitType==='brood' && e.amount===1)){
      checkpoint=start;original=g.lastCombatReport;wave=g.wave
    }
  }})
  assert.ok(checkpoint)
  const child=original.lifeEvents.find(e=>e.source==='breach' && e.unitType==='brood' && e.amount===1)
  assert.ok(child)
  assert.ok(original.enemyEvents.some(e=>e.kind==='split' && e.children.includes(child.unitId)))
  const restored=restoreGame(checkpoint)
  while(restored.phase==='battle')tick(restored,.25)
  assert.deepEqual(restored.lastCombatReport,original)
  assert.equal(restored.baseHp,run.waves.find(w=>w.wave===wave).life)
})

test('旧式交战存档保留在场单位，剩余编成在恢复时一次入场，重复读档幂等',()=>{
  let old
  route({...BUILD_ROUTES[1],stopWave:20},{onBattleStart:g=>{if(g.wave===20)old=snapshotGame(g)}})
  delete old.encounterVersion;old.endlessRevision=2
  old.enemies=old.enemies.slice(0,6);old.waveSpawned=old.spawnIndex=6
  old.schedule.forEach((entry,i)=>{entry.at=Math.floor(i/6)*4})
  old.schedule.push(...Array.from({length:12},()=>({type:'brute',at:28})))
  const restored=restoreGame(old)
  assert.ok(restored)
  assert.deepEqual(restored.enemies.slice(0,6),old.enemies)
  assert.equal(restored.enemies.length,waveSchedule(old.seed,20,old.difficulty,'endless').length)
  assert.equal(restored.schedule.length,restored.spawnIndex)
  assert.ok(restored.schedule.every(slot=>slot.at===0))
  const migrated=snapshotGame(restored)
  assert.deepEqual(snapshotGame(restoreGame(migrated)),migrated)
  assert.equal(restoreGame({...migrated,spawnIndex:1}),null)
  assert.equal(restoreGame({...old,encounterVersion:9}),null)
})

test('整波混编与属性曲线只取决于种子和波次，初始军情与实际在场数量一致',()=>{
  for(let wave=13;wave<=80;wave++){
    const g={mode:'endless',seed:4,wave}
    const queue=waveSchedule(4,wave,'standard','endless')
    assert.ok(queue.length>=12 && queue.length<=16)
    assert.ok(queue.every(slot=>slot.at===0))
    assert.equal(waveInfo(g).duration,wave%6===0?60:ENDLESS.normalDuration)
    assert.deepEqual(queue,waveSchedule(4,wave,'veteran','endless'))
    assert.equal(endlessScale(g),endlessScale({...g,baseHp:0,allies:[{atk:90000}]}))
  }
})

test('比例裁切、拥挤分离与关键提示的绘制不修改站位或计时',()=>{
  const frame=backgroundFrame(1366,650,1536,804)
  assert.ok(Math.abs(frame.w/frame.h-1536/804)<1e-10)
  assert.ok(frame.w>=1366 && frame.h>=650)
  const units=['finalBoss','hunter','cantor','splitter'].map((type,i)=>({id:'enemy-'+i,type,hp:1,x:600,y:250}))
  const before=structuredClone(units),offset=enemyPaintOffsets(units)
  assert.deepEqual(offset.get('enemy-0'),{x:0,y:0})
  assert.ok([...offset.values()].some(p=>Math.abs(p.x)+Math.abs(p.y)>0))
  assert.deepEqual(units,before)
  const warning={text:'首领蓄力',x:600,y:220,size:12,priority:'warning'}
  const texts=Array.from({length:20},(_,i)=>({text:'命中',x:600+i*8,y:220,size:10}))
  assert.ok(readableLabels([...texts,warning]).includes(warning))
  assert.ok(readableLabels(texts).length<=5)
  const widths=[]
  const ctx={fillStyle:'',fillRect(x,y,w){if(this.fillStyle==='#97f3b9')widths.push(w)}}
  for(const remaining of [1.5,.75,0]){
    paintRites(ctx,{phase:'battle',enemies:[{...units[2],chanting:true,riteTimer:remaining}]},y=>y,offset)
  }
  assert.deepEqual(widths,[0,20,40])
})

test('同一合法战斗在绘制、关闭、跳过与双倍速下的完整存档及随机状态一致',()=>{
  const run=route({...BUILD_ROUTES[2],stopWave:13})
  let start,facts
  replayBuild(run,{onAction:({action,before,after})=>{
    if(after.wave!==13)return
    if(action.type==='deploy')facts=deriveDeployFacts(before,after)
    if(action.type==='battle-start')start=snapshotGame(after)
  }})
  assert.ok(facts?.orderId)
  const ctx=new Proxy({},{get:(t,k)=>t[k] ?? (()=>{})})
  const finish=(mode,speed)=>{
    const game=restoreGame(start)
    const scene=createPresentationScene({enabled:mode!=='off'})
    assert.ok(scene.accept({...facts,id:facts.orderId},{waveKey:String(game.wave),army:game.allies.map(u=>u.id),immediate:true}))
    scene.stage(facts.orderId,'order')
    if(mode==='skip')scene.skip()
    if(mode==='skip' || mode==='off')assert.equal(scene.get().active,false)
    while(game.phase==='battle'){
      if(mode!=='off'){
        const offsets=enemyPaintOffsets(game.enemies)
        paintHostileSignals(ctx,game,y=>y,[],offsets);paintRites(ctx,game,y=>y,offsets)
      }
      scene.advance(1000/15,{speed})
      tick(game,speed/15)
    }
    return snapshotGame(game)
  }
  const reference=finish('off',1)
  for(const [mode,speed] of [['on',1],['on',2],['skip',2]])assert.deepEqual(finish(mode,speed),reference)
})

test('后段培养继续增长，新职业足额继承，重复材料按永久属性递减',()=>{
  const game=createGame({mode:'endless',seed:4})
  game.wave=40;makeSchedule(game)
  const leader=addUnit(game,'knight','ally',1,{identity:{suit:'♠',rank:'2',pattern:'high'}})
  const donor=addUnit(game,'healer','ally',1,{identity:{suit:'♥',rank:'3',pattern:'pair'}})
  leader.atk=7200
  const warning=()=>mergeWarning(game,leader.id,donor.id,'profession')
  assert.equal(warning().share,1)
  leader.fusionJobs=[leader.jobId,donor.jobId]
  assert.equal(warning().share,.5)
  leader.waveBonus={atk:900};leader.atk+=900
  assert.equal(warning().share,.5)
  assert.ok(mergePreview(game,leader.id,donor.id,'profession').atk>leader.atk)
  assert.ok(developmentWave({...game,wave:80})>developmentWave(game))
  assert.equal(mergeWarning({...game,mode:'standard',wave:12},leader.id,donor.id,'profession').share,1)
})
