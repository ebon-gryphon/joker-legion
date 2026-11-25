#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join,resolve } from 'node:path'
import * as E from '../src/engine.js'
import { rankOf } from '../src/orders.js'
import { workshopPairs } from '../src/forge.js'
import { printingCost } from '../src/deck.js'
import {shopActionAvailability} from '../src/fieldShop.js'

export const BUILD_ROUTES=[
  {id:'a',seed:4,doctrine:'iron',name:'改印同花五条 · 粉笔与墨水'},
  {id:'b',seed:1,doctrine:'arcane',name:'第三幕 · 连续出牌与满编集训'},
  {id:'c',seed:3,doctrine:'escape',name:'治疗转伤害 · 红心回响与荆棘圣杯'},
]
const root=fileURLToPath(new URL('../',import.meta.url))
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
const face=card=>card.suit+card.rank
const cardFact=card=>({id:card.id,face:face(card),slot:card.baseFace || face(card)})
const budget=g=>({gold:g.gold,crystals:g.crystals,life:g.baseHp,maxLife:g.maxBaseHp,lifeFailed:!!g.lifeFailed,energy:g.energy,hands:g.handsLeft,prints:g.printsLeft})
const sumSystem=(report,id,key)=>report?.systems?.find(row=>row.id===id)?.[key] || 0
const selectedFaces=g=>g.selected.map(id=>cardFact(g.hand.find(card=>card.id===id)))
const rankGroups=cards=>{
  const groups=new Map()
  for(const card of cards){if(!groups.has(card.rank))groups.set(card.rank,[]);groups.get(card.rank).push(card)}
  return [...groups.values()]
}

export function runBuildStrategy(route,{fixtures=true}={}) {
  const game=E.createGame({seed:route.seed,doctrine:route.doctrine,difficulty:route.difficulty || 'standard'})
  const log={id:route.id,name:route.name,seed:route.seed,doctrine:route.doctrine,difficulty:game.difficulty,economyVersion:game.economyVersion,
    actions:[],turns:[],waves:[],fixtures:[],milestones:{},result:null}
  let capturedCConversion=false,checkpoint=0
  const capture=(id,label,snapshot=E.snapshotGame(game))=>{
    if(!fixtures || log.fixtures.some(item=>item.id===id))return
    assert.ok(E.restoreGame(snapshot),'Fixture must be a legitimate resumable snapshot: '+id)
    log.fixtures.push({id,label,afterAction:log.actions.length,snapshot:clone(snapshot)})
  }
  function act(type,params,perform) {
    const entry={n:log.actions.length+1,wave:game.wave,phase:game.phase,time:game.time,type,params:clone(params),before:budget(game)}
    const result=perform();assert.notEqual(result,false,route.id+' illegal '+type+' '+JSON.stringify(params))
    entry.after=budget(game);log.actions.push(entry);return result
  }
  function select(ids) {
    const cards=ids.map(id=>game.hand.find(card=>card.id===id));assert.ok(cards.every(Boolean))
    act('select',{cards:cards.map(cardFact)},()=>{
      for(const id of game.selected.slice())assert.ok(E.selectCard(game,id))
      for(const id of ids)assert.ok(E.selectCard(game,id))
      return true
    })
  }
  function deployIds(ids,label='') {
    select(ids)
    const beforePlan=E.previewHand(game)
    if(!beforePlan.canDeploy)return false
    const target=game.allies.some(unit=>unit.type==='knight')?'knight':beforePlan.target
    if(target!==game.orderTarget)act('target',{target},()=>E.setOrderTarget(game,target))
    const plan=E.previewHand(game),before=E.snapshotGame(game)
    if(route.id==='a' && game.wave===2 && plan.key==='flushFive')capture('a-before-3520','合法第二波同花五条出牌前（旧fixture ID保留，分数以实际记录为准）',before)
    if(route.id==='a' && plan.waiting)capture('a-before-legendary-reserve','合法满编传说候补出牌前',before)
    const params={cards:selectedFaces(game),target:plan.target,expectedKey:plan.key,expectedScore:plan.score.total,label}
    act('deploy',params,()=>E.deploy(game))
    const last=game.lastDeploy
    log.turns.push({afterAction:log.actions.length,wave:game.wave,ordinal:game.stats.deploys,cards:params.cards,target:plan.target,
      orderId:last.id,key:last.key,score:last.score,grade:last.captainGrade,scoreTrace:clone(last.scoreTrace),
      actualItemEvents:clone(game.combatLedger.itemEvents.filter(event=>event.orderId===last.id)),
      recruitment:clone(game.combatLedger.orders.at(-1)?.recruitment)})
    if(route.id==='a' && game.wave===2 && last.key==='flushFive' && !log.milestones.highHand)
      log.milestones.highHand={afterAction:log.actions.length,score:last.score,grade:last.captainGrade,key:last.key,printCost:14}
    if(route.id==='b' && last.count===0 && !last.waiting && last.trainingXp>0 && !log.milestones.firstTraining) {
      log.milestones.firstTraining={afterAction:log.actions.length,ordinal:game.stats.deploys,wave:game.wave,xp:last.trainingXp,recipient:clone(last.scoreTrace.recruit.receiver),score:last.score}
      capture('b-before-first-training','合法满编集训的出牌前',before)
      const fixture=log.fixtures.find(item=>item.id==='b-before-first-training');if(fixture)fixture.afterAction=log.actions.length-1
    }
    if(route.id==='b' && last.count===0 && !last.waiting && last.scoreTrace.items.some(item=>item.id==='third-act' && item.actual?.triggered && item.actual.effects.xpGain>0))
      log.milestones.thirdActTraining ||= {afterAction:log.actions.length,ordinal:game.stats.deploys,wave:game.wave,xp:last.trainingXp}
    if(route.id==='c' && last.scoreTrace.items.some(item=>item.id==='red-echo' && item.actual?.triggered) && !log.milestones.firstRedEcho) {
      const actual=last.scoreTrace.items.find(item=>item.id==='red-echo').actual
      log.milestones.firstRedEcho={afterAction:log.actions.length,wave:game.wave,actual:clone(actual)}
      capture('c-before-red-echo','合法持有回响的计分红心出牌前',before)
      const fixture=log.fixtures.find(item=>item.id==='c-before-red-echo');if(fixture)fixture.afterAction=log.actions.length-1
    }
    return true
  }
  function print(source,targets) {
    const params={source:cardFact(source),targets:targets.map(cardFact),price:printingCost(game,targets.length)}
    act('print',params,()=>E.printCards(game,source.id,targets.map(card=>card.id)))
  }
  function pairIds({allowPrint=false}={}) {
    const groups=rankGroups(game.hand).filter(cards=>cards.length>=2).sort((a,b)=>rankOf(b[0])-rankOf(a[0]))
    if(groups.length)return groups[0].slice(0,2).map(card=>card.id)
    if(!allowPrint || !game.printsLeft || game.gold<printingCost(game,1))return null
    const source=game.hand.filter(card=>card.suit==='♥').sort((a,b)=>rankOf(b)-rankOf(a))[0] || game.hand.slice().sort((a,b)=>rankOf(b)-rankOf(a))[0]
    const target=game.hand.find(card=>face(card)!==face(source));if(!target)return null
    print(source,[target]);return [source.id,target.id]
  }
  function improveArmy() {
    if(route.id==='a' && game.wave===1 || route.id==='b' && !log.milestones.thirdActTraining)return
    const pairs=workshopPairs(game)
    const ascending=pairs.ascend[0]
    const promoting=pairs.promote[0]
    const combining=game.allies.length>=3 && game.gold>=5?pairs.profession.slice().sort((a,b)=>
      (b.leader.atk+b.leader.heal)-(a.leader.atk+a.leader.heal) || a.leader.id.localeCompare(b.leader.id))[0]:null
    const pair=ascending || promoting || combining,kind=ascending?'ascend':promoting?'promote':'profession'
    if(pair)act('forge',{leaderId:pair.leader.id,donorId:pair.donor.id,kind,leader:pair.leader.name,donor:pair.donor.name},()=>E.forgeUnit(game,pair.leader.id,pair.donor.id,kind))
  }
  function royalPrintIds() {
    if(game.gold<14 || game.printsLeft<4)return null
    const source=game.hand.slice().sort((a,b)=>rankOf(b)-rankOf(a))[0]
    const copies=game.hand.filter(card=>face(card)===face(source)),needed=5-copies.length
    if(needed<=0)return copies.slice(0,5).map(card=>card.id)
    const targets=game.hand.filter(card=>face(card)!==face(source)).sort((a,b)=>rankOf(a)-rankOf(b)).slice(0,needed)
    if(targets.length!==needed || needed>game.printsLeft || printingCost(game,needed)>game.gold)return null
    print(source,targets);return [...copies,...targets].map(card=>card.id)
  }
  function camp() {
    const formation=game.wave>=3?([6,12].includes(game.wave)?'spread':'hunt'):'guard'
    if(game.formation!==formation)act('formation',{id:formation},()=>E.setFormation(game,formation))
    for(let hand=0;hand<3 && game.handsLeft>0;hand++) {
      let ids
      if(route.id==='a' && game.wave===1) ids=hand===0?[game.hand.slice().sort((a,b)=>rankOf(b)-rankOf(a))[0].id]:hand===1?pairIds():null
      else if(route.id==='a' && game.wave>=2 && hand===0)ids=royalPrintIds()
      else if(!game.allies.length)ids=[game.hand.slice().sort((a,b)=>rankOf(b)-rankOf(a))[0].id]
      else if(route.id==='c' && (hand===1 || game.wave>1))ids=pairIds({allowPrint:true})
      else if(route.id==='b' && hand===1)ids=pairIds()
      ids ||= E.recommendHand(game)
      if(!ids || !deployIds(ids))break
      improveArmy()
    }
    if(!game.allies.length)throw Error('No legally recruited soldier can enter battle')
    act('battle-start',{},()=>E.beginBattle(game))
    // Combat skills are legal player actions too; neither changes the deck or grants resources.
    if(route.id==='b' && game.allies.length<5 && !game.trickUsed) {
      const target=game.allies.slice().sort((a,b)=>(b.atk+b.heal)-(a.atk+a.heal))[0]
      act('trick',{targetId:target.id,actor:'mirror'},()=>E.useTrick(game,target.id))
    }
    if(route.id==='c' && !game.trickUsed) {
      const target=game.allies.slice().sort((a,b)=>(b.atk+b.heal)-(a.atk+a.heal))[0]
      act('trick',{targetId:target.id,actor:'escape'},()=>E.useTrick(game,target.id))
    }
  }
  function shop() {
    const offered=game.rewards.filter(item=>E.rewardAvailability(game,item.id).available)
    const reward=(offered.find(item=>game.baseHp<=3 && item.id==='repair') || offered.find(item=>item.effect?.kind==='buildPassive') || offered.find(item=>item.id==='supply') || offered[0])?.id
    assert.ok(reward,'A genuine random offer must be available')
    act('reward',{id:reward,offers:game.rewards.map(item=>item.id)},()=>E.chooseReward(game,reward))
    const wants=route.id==='a'?['score-chalk','pair-ink']:route.id==='c'?['red-echo','healer-brooch']:['iron-banner']
    const rounds=route.id==='c'?3:1
    for(let round=0;round<rounds;round++) {
      for(const id of game.shop.slice()) {
        if(wants.includes(id) && shopActionAvailability(game,'buy',id).available)
          act('buy',{id,offers:game.shop.slice()},()=>E.buyJoker(game,id))
      }
      if(round+1<rounds && game.crystals>=7 && shopActionAvailability(game,'reroll').available && wants.some(id=>!game.jokers.some(item=>item.id===id)))
        act('reroll',{offersBefore:game.shop.slice()},()=>E.rerollShop(game))
      else break
    }
    const key=route.id==='a'?(game.wave===1?'pair':game.discoveredHands.includes('flushFive')?'flushFive':'pair'):route.id==='c'?'pair':game.lastDeploy.key
    const printReserve=route.id==='a' && game.wave===1?14:0
    if(game.gold>=5+printReserve && game.handLevels[key]<3 && (!['five','flushHouse','flushFive'].includes(key) || game.discoveredHands.includes(key)))
      act('research',{key},()=>E.trainOrder(game,key))
    act('next-wave',{},()=>E.nextWave(game))
  }
  for(let guard=0;guard<100 && !['won','lost'].includes(game.phase);guard++) {
    if(game.phase==='ready')camp()
    if(game.phase==='battle') {
      let ticks=0
      const wave=game.wave,before=budget(game),beforeAction=log.actions.length
      while(game.phase==='battle' && ticks<1000) {
        const captureNext=route.id==='c' && !capturedCConversion
        const beforeTick=captureNext?E.snapshotGame(game):null
        const damageBefore=captureNext?sumSystem(game.combatLedger,'heart-engine','damage'):0
        E.tick(game,.25);ticks++
        if(captureNext && sumSystem(game.combatLedger,'heart-engine','damage')>damageBefore) {
          capturedCConversion=true
          // This fixture belongs after the prefix ticks, so its replay cursor is explicit.
          capture('c-before-heart-conversion','合法战斗中首次圣杯实际伤害前',beforeTick)
          const fixture=log.fixtures.find(item=>item.id==='c-before-heart-conversion')
          if(fixture)fixture.tickOffset={afterAction:beforeAction,ticks:ticks-1,dt:.25}
        }
      }
      assert.ok(ticks<1000,'Battle must reach an actual engine ending')
      log.actions.push({n:log.actions.length+1,wave,phase:'battle',type:'tick',params:{count:ticks,dt:.25},before,after:budget(game)})
      const report=clone(game.lastCombatReport)
      log.waves.push({afterAction:log.actions.length,wave,phase:game.phase,hp:game.baseHp,life:game.baseHp,maxLife:game.maxBaseHp,report,itemEvents:clone(report?.itemEvents || []),
        heartEngineDamage:sumSystem(report,'heart-engine','damage'),redEchoHealing:sumSystem(report,'red-echo','healed')})
      checkpoint++
    }
    if(game.phase==='shop')shop()
  }
  assert.ok(['won','lost'].includes(game.phase),'Route must play until an actual win or loss')
  log.result={phase:game.phase,wave:game.wave,wavesCleared:game.stats.wavesCleared,gate:game.baseHp,kills:game.stats.kills,gold:game.gold,crystals:game.crystals,
    life:game.baseHp,maxLife:game.maxBaseHp,lifeFailed:!!game.lifeFailed,buildPassives:clone(game.buildPassives),
    heartEngineDamage:log.waves.reduce((sum,wave)=>sum+wave.heartEngineDamage,0),redEchoHealing:log.waves.reduce((sum,wave)=>sum+wave.redEchoHealing,0),wavesRecorded:checkpoint}
  log.finalSnapshot=E.snapshotGame(game)
  return log
}

export function replayBuild(log,{onAction,onTick}={}) {
  const game=E.createGame({seed:log.seed,doctrine:log.doctrine,difficulty:log.difficulty})
  for(const entry of log.actions) {
    const before=onAction?E.snapshotGame(game):null
    assert.equal(game.wave,entry.wave,'Replay wave at action '+entry.n)
    const p=entry.params;let result
    if(entry.type==='select') {
      for(const card of p.cards)assert.equal(face(game.hand.find(item=>item.id===card.id)),card.face,'Replay physical card identity')
      for(const id of game.selected.slice())assert.ok(E.selectCard(game,id))
      for(const card of p.cards)assert.ok(E.selectCard(game,card.id));result=true
    } else if(entry.type==='target')result=E.setOrderTarget(game,p.target)
    else if(entry.type==='print') {
      assert.equal(face(game.hand.find(card=>card.id===p.source.id)),p.source.face)
      for(const target of p.targets)assert.equal(face(game.hand.find(card=>card.id===target.id)),target.face)
      result=E.printCards(game,p.source.id,p.targets.map(card=>card.id))
    } else if(entry.type==='deploy') {
      assert.equal(E.previewHand(game).score.total,p.expectedScore);assert.equal(E.previewHand(game).key,p.expectedKey);result=E.deploy(game)
    } else if(entry.type==='forge')result=E.forgeUnit(game,p.leaderId,p.donorId,p.kind)
    else if(entry.type==='formation')result=E.setFormation(game,p.id)
    else if(entry.type==='battle-start')result=E.beginBattle(game)
    else if(entry.type==='trick')result=E.useTrick(game,p.targetId,p.step)
    else if(entry.type==='reward'){if(p.offers)assert.deepEqual(game.rewards.map(item=>item.id),p.offers);result=E.chooseReward(game,p.id)}
    else if(entry.type==='buy'){assert.deepEqual(game.shop,p.offers);result=E.buyJoker(game,p.id)}
    else if(entry.type==='sell')result=E.sellJoker(game,p.id)
    else if(entry.type==='reroll'){assert.deepEqual(game.shop,p.offersBefore);result=E.rerollShop(game)}
    else if(entry.type==='research')result=E.trainOrder(game,p.key)
    else if(entry.type==='next-wave')result=E.nextWave(game)
    else if(entry.type==='tick'){for(let i=0;i<p.count;i++){E.tick(game,p.dt);onTick?.(game)}result=true}
    else throw Error('Unknown action '+entry.type)
    assert.notEqual(result,false,'Replay rejected action '+entry.n+' '+entry.type)
    assert.deepEqual(budget(game),entry.after,'Replay budget at action '+entry.n)
    onAction?.({before,after:game,action:entry})
  }
  assert.deepEqual(E.snapshotGame(game),log.finalSnapshot,'Replay final run differs')
  return game
}

export async function writeBuildVerification() {
  const routes=BUILD_ROUTES.map(route=>runBuildStrategy(route))
  for(const route of routes)replayBuild(route)
  const directory=join(root,'output'),fixtureDirectory=join(directory,'build-fixtures')
  await mkdir(fixtureDirectory,{recursive:true})
  for(const route of routes)for(const fixture of route.fixtures) {
    const filename=route.id+'-'+fixture.id+'.json'
    const actions=clone(route.actions.slice(0,fixture.afterAction))
    if(fixture.tickOffset?.ticks) {
      const tick=clone(route.actions[fixture.afterAction])
      assert.equal(tick.type,'tick')
      tick.params.count=fixture.tickOffset.ticks;tick.after=budget(fixture.snapshot);actions.push(tick)
    }
    const fixtureDocument={version:1,route:route.id,label:fixture.label,seed:route.seed,doctrine:route.doctrine,difficulty:route.difficulty,actions,snapshot:fixture.snapshot}
    replayBuild({...route,actions,finalSnapshot:fixture.snapshot})
    await writeFile(join(fixtureDirectory,filename),JSON.stringify(fixtureDocument,null,2)+'\n')
    fixture.path='output/build-fixtures/'+filename;delete fixture.snapshot
  }
  const output={version:1,createdAt:new Date().toISOString(),method:'Only public engine actions; seeded cards and weighted reward offers, earned gold/crystals, real shops, legal printing and actual combat until win/loss. Every offer and both currency budgets are replayed action by action.',routes}
  await writeFile(join(directory,'build-verification.json'),JSON.stringify(output,null,2)+'\n')
  for(const route of routes)console.log(JSON.stringify({route:route.id,seed:route.seed,result:route.result,milestones:route.milestones,actions:route.actions.length,fixtures:route.fixtures.map(item=>item.path)}))
  return output
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await writeBuildVerification()
