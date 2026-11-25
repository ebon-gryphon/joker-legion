import assert from 'node:assert/strict'
import * as E from '../src/engine.js'

/** Only public actions are recorded and replayed; snapshots contain no injected resources or soldiers. */
export function lifeUiFixtures(){
 const seed='life-ui-1',doctrine='scarlet',difficulty='standard',game=E.createGame({seed,doctrine,difficulty}),actions=[],fixtures={}
 const copy=v=>JSON.parse(JSON.stringify(v)),snapshot=()=>E.snapshotGame(game)
 function act(type,params={}){const result=apply(game,{type,params});assert.notEqual(result,false,`Illegal life fixture action ${type}`);actions.push({type,params:copy(params)});return result}
 function capture(id){fixtures[id]={id,seed,doctrine,difficulty,method:'Complete public-action prefix, replay verified from a fresh game; no state injection.',actions:copy(actions),snapshot:snapshot()}}
 function ticksUntil(predicate,{captureBefore,limit=2500}={}){
  let count=0
  while(game.phase==='battle'&&!predicate(game)&&count<limit){
   const before=snapshot(),beforeActions=copy(actions);act('tick',{count:1,dt:1/30});count++
   if(predicate(game)&&captureBefore){fixtures[captureBefore]={id:captureBefore,seed,doctrine,difficulty,method:'Complete public-action prefix, replay verified from a fresh game; next event occurs under the real ticker.',actions:beforeActions,snapshot:before}}
  }
  assert.ok(count<limit,'Life fixture battle must resolve')
 }
 const rank=c=>({A:1,J:11,Q:12,K:13}[c.rank]||Number(c.rank))
 const low=game.hand.slice().sort((a,b)=>rank(a)-rank(b))[0]
 act('select',{ids:[low.id]});act('deploy');act('battle-start')
 ticksUntil(g=>g.lifeEvents.some(e=>e.kind==='loss'),{captureBefore:'before-breach'})
 assert.equal(game.baseHp,11);assert.equal(game.lifeFailed,false)
 ticksUntil(g=>g.phase!=='battle')
 assert.equal(game.phase,'shop');assert.equal(game.baseHp,3)
 const first=game.rewards.find(row=>row.id==='varied-hand') || game.rewards.find(row=>!['repair','gate-max'].includes(row.id)&&E.rewardAvailability(game,row.id).available)
 act('reward',{id:first.id});act('next-wave');capture('wave2-weak-ready')
 const source=game.hand.find(card=>card.suit==='♥'),target=game.hand.find(card=>card.id!==source?.id)
 assert.ok(source&&target);act('print',{sourceId:source.id,targetIds:[target.id]});act('select',{ids:[source.id,target.id]});capture('before-heart-heal')
 const before=game.baseHp;act('deploy');assert.equal(game.baseHp-before,1)
 assert.equal(game.lastDeploy.scoreTrace.items.find(item=>item.id==='red-echo').actual.effects.lifeHealed,1)
 capture('after-heart-heal')
 for(let p=0;p<2;p++){const ids=E.recommendHand(game);act('select',{ids});act('deploy')}
 act('battle-start');ticksUntil(g=>g.phase!=='battle');assert.equal(game.phase,'shop')
 act('reward',{id:game.rewards.find(row=>E.rewardAvailability(game,row.id).available).id});act('next-wave');act('battle-start')
 ticksUntil(g=>g.lifeEvents.some(e=>e.kind==='bell-summon'),{captureBefore:'before-bell-summon'})
 const event=game.lifeEvents.find(e=>e.kind==='bell-summon');assert.ok(game.enemies.some(unit=>unit.id===event.unitId&&unit.summonedBy==='bellkeeper'))
 capture('after-bell-summon')
 // A different legal branch deliberately enters wave 2 with the surviving first recruit only.
 const weak=fixtures['wave2-weak-ready'],zero=E.restoreGame(weak.snapshot),zeroActions=copy(weak.actions)
 assert.ok(E.beginBattle(zero));zeroActions.push({type:'battle-start',params:{}})
 while(zero.phase==='battle'&&zero.baseHp>0){E.tick(zero,1/30);zeroActions.push({type:'tick',params:{count:1,dt:1/30}})}
 assert.equal(zero.baseHp,0);assert.equal(zero.lifeFailed,false)
 fixtures['zero-safe']={id:'zero-safe',seed,doctrine,difficulty,method:weak.method,actions:zeroActions,snapshot:E.snapshotGame(zero)}
 for(const fixture of Object.values(fixtures)){
  const replay=E.createGame({seed:fixture.seed,doctrine:fixture.doctrine,difficulty:fixture.difficulty})
  for(const action of fixture.actions)assert.notEqual(apply(replay,action),false,'Public-action replay '+fixture.id)
  assert.deepEqual(E.snapshotGame(replay),fixture.snapshot,'Earned snapshot '+fixture.id)
  assert.ok(E.restoreGame(fixture.snapshot),'Resumable earned snapshot '+fixture.id)
 }
 return fixtures
}
function apply(game,{type,params:p={}}){
 if(type==='select'){for(const id of game.selected.slice())assert.ok(E.selectCard(game,id));for(const id of p.ids)assert.ok(E.selectCard(game,id));return true}
 if(type==='deploy')return E.deploy(game)
 if(type==='battle-start')return E.beginBattle(game)
 if(type==='tick'){for(let n=0;n<p.count;n++)E.tick(game,p.dt);return true}
 if(type==='reward')return E.chooseReward(game,p.id)
 if(type==='next-wave')return E.nextWave(game)
 if(type==='print')return E.printCards(game,p.sourceId,p.targetIds)
 throw Error('Unsupported life fixture action '+type)
}
