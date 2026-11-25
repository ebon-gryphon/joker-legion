import test from 'node:test'
import assert from 'node:assert/strict'
import {createGame,addUnit,deploy,snapshotGame,restoreGame,JOKERS,beginBattle} from './engine.js'
import {planHand} from './handPlan.js'
import {combatSummary,finishCombatStats,validCombatStats,validOrderScoreTrace} from './combatStats.js'
import {healUnit} from './combatHealth.js'
import {loadCombatHistory,combatHistoryKey} from './combatHistory.js'
import {grantExperience} from './training.js'

function own(g,id,quantity=1) {
  const item=g.jokers.find(j=>j.id===id)
  if(item) item.quantity=quantity
  else g.jokers.push({...JOKERS.find(j=>j.id===id),quantity,triggers:0,flash:0})
}
function deal(g,faces) {
  const stock=[...g.hand,...g.deck]
  const cards=faces.map(face=>stock.find(c=>c.suit+c.rank===face))
  assert.ok(cards.every(Boolean))
  const other=stock.filter(c=>!cards.includes(c))
  g.hand=[...cards,...other.slice(0,8-cards.length)];g.deck=other.slice(8-cards.length);g.selected=cards.map(c=>c.id)
}
function add(g,type='knight',rank='3') {
  return addUnit(g,type,'ally',1,{identity:{suit:type==='healer'?'♥':'♠',rank}})
}
const actual=(g,id)=>g.lastDeploy.scoreTrace.items.find(item=>item.id===id).actual

test('accepted orders persist a compact authoritative score, item quantities, energy and actual recruit branch',()=>{
  const g=createGame({seed:'score-telemetry'})
  own(g,'score-chalk',2);own(g,'pair-ink')
  deal(g,['♠2','♦2'])
  const planned=planHand(g,g.selected,true),energy=g.energy
  assert.ok(deploy(g))
  const order=g.combatLedger.orders[0]
  assert.equal(order.score,planned.score.total)
  assert.equal(order.scoreTrace.finalScore,order.score)
  assert.equal(order.scoreTrace.chipsBeforeMult*order.scoreTrace.mult,order.score)
  assert.deepEqual(order.scoreTrace.order.bonus,planned.bonus)
  assert.equal(order.energyLeft,energy-planned.cost)
  assert.deepEqual(actual(g,'score-chalk').effects,{chips:4})
  assert.deepEqual(actual(g,'pair-ink').effects,{chips:3})
  assert.equal(order.recruitment.status,'fielded')
  assert.equal(order.recruitment.grade,g.allies[0].grade)
  assert.equal(order.recruitment.recruitId,g.allies[0].id)
  assert.ok(validOrderScoreTrace(g.lastDeploy.scoreTrace,true));assert.ok(validOrderScoreTrace(order.scoreTrace))
  const reloaded=restoreGame(snapshotGame(g));assert.ok(reloaded)
  assert.deepEqual(reloaded.combatLedger.orders, g.combatLedger.orders)
  assert.equal(reloaded.combatLedger.itemEvents.length,6)
  assert.equal(reloaded.combatLedger.itemEvents.find(event=>event.id==='score-chalk').quantity,2)
  assert.equal(reloaded.combatLedger.itemEvents.find(event=>event.id==='heart-engine').quantity,0)
})

test('condition matches distinguish zero effective healing, real shield gain and unscored red-card non-triggers',()=>{
  const g=createGame({seed:'healing-zero'})
  add(g);own(g,'red-echo');own(g,'heart-engine')
  deal(g,['♥2','♠2'])
  assert.ok(deploy(g))
  assert.equal(actual(g,'iron-banner').triggered,true)
  assert.equal(actual(g,'iron-banner').effects.shield,24)
  assert.equal(actual(g,'iron-banner').effects.healed,0)
  assert.equal(actual(g,'red-echo').triggered,true)
  assert.equal(actual(g,'red-echo').effective,false)
  assert.equal(actual(g,'red-echo').effects.healed,0)
  assert.equal(actual(g,'heart-engine').triggered,false)
  assert.equal(g.healedCharge,0)
  deal(g,['♠3','♦3','♥A']);assert.ok(deploy(g))
  assert.equal(actual(g,'red-echo').triggered,false)
  assert.match(actual(g,'red-echo').reason,/没有红心参与计分/)
})

test('wounded allies and missing player life report actual red-echo benefits, while a reserved legend receives no banner shield',()=>{
  const g=createGame({seed:'healing-real'}),a=add(g)
  own(g,'red-echo');a.hp-=30;g.baseHp=g.maxBaseHp-2;const life=g.baseHp
  deal(g,['♥2','♥3','♥4','♥5','♥6']);assert.ok(deploy(g))
  assert.equal(actual(g,'red-echo').effects.healed,30)
  assert.equal(actual(g,'red-echo').effects.lifeHealed,1);assert.equal(actual(g,'red-echo').effects.gateRepaired,undefined)
  assert.equal(g.baseHp,life+1);assert.ok(g.lifeEvents.some(row=>row.kind==='heal'&&row.source==='red-echo'&&row.amount===1))
  const full=createGame({seed:'reserve-benefits'})
  for(let i=0;i<5;i++) add(full,'knight',String(i+2))
  own(full,'score-chalk',400);deal(full,['♠2','♦2']);assert.ok(deploy(full))
  const event=actual(full,'iron-banner'),recruit=full.combatLedger.orders[0].recruitment
  assert.equal(recruit.status,'reserve');assert.equal(recruit.grade,4)
  assert.equal(recruit.recipientId,null);assert.equal(recruit.recruitId,full.reserves[0].id)
  assert.equal(event.triggered,true);assert.equal(event.effective,false)
  assert.deepEqual(event.effects,{shield:0,healed:0,targets:0})
  assert.equal(full.lastDeploy.scoreTrace.recruit.receiver,null)
})

test('the global third play records real stars or capped overflow XP rather than an advertised extra soldier',()=>{
  const g=createGame({seed:'third-stars',doctrine:'arcane'});g.stats.deploys=2
  deal(g,['♠2']);assert.ok(deploy(g))
  assert.equal(actual(g,'third-act').effects.starGain,1)
  assert.equal(actual(g,'third-act').effective,true)
  assert.equal(g.allies[0].level,2)
  const full=createGame({seed:'ordinary-training',doctrine:'arcane'});full.stats.deploys=2
  for(let i=0;i<5;i++) {const u=add(full,'knight',String(i+2));grantExperience(full,u,999,false)}
  deal(full,['♠2']);assert.ok(deploy(full))
  const recruit=full.combatLedger.orders[0].recruitment
  assert.equal(recruit.status,'training');assert.equal(recruit.xpGain,0)
  assert.ok(recruit.plannedXp>0);assert.ok(recruit.recipientId)
  assert.equal(actual(full,'third-act').triggered,true)
  assert.equal(actual(full,'third-act').effective,false)
  assert.deepEqual(actual(full,'third-act').effects,{starGain:0,xpGain:0})
  assert.equal(full.lastDeploy.scoreTrace.recruit.actualCount,0)
  assert.equal(full.lastDeploy.scoreTrace.recruit.xp,0)
})

test('real Red Echo orders spend only the first qualifying two-scoring-heart life heal while retaining later friendly healing',()=>{
  const g=createGame({seed:'life-echo-orders'}),ally=add(g)
  own(g,'red-echo');g.baseHp=g.maxBaseHp-2;const before=g.baseHp
  ally.hp-=30;deal(g,['♥2','♥3','♠4','♣5','♦6']);assert.ok(deploy(g))
  assert.equal(actual(g,'red-echo').effects.lifeHealed,1);assert.equal(g.baseHp,before+1)
  assert.equal(actual(g,'red-echo').effects.healed,30)
  ally.hp-=10;deal(g,['♥7','♥8','♠9','♣10','♦J']);assert.ok(deploy(g))
  assert.equal(actual(g,'red-echo').effects.lifeHealed,0);assert.equal(g.baseHp,before+1)
  assert.equal(actual(g,'red-echo').effects.healed,10)
  const unscored=createGame({seed:'only-scored-hearts'});own(unscored,'red-echo');unscored.baseHp--
  deal(unscored,['♥2','♥3']);assert.ok(deploy(unscored))
  assert.equal(unscored.lastDeploy.scoreTrace.scoringCards.length,1);assert.equal(actual(unscored,'red-echo').effects.lifeHealed,0)
  assert.equal(unscored.lifeItemState.redEchoUsed,false)
})

test('Holy Grail combat procs retain actual hit losses and phase, without being attached to an unrelated order',()=>{
  const g=createGame({seed:'heart-proc'}),a=add(g),b=add(g,'healer','2')
  own(g,'heart-engine');g.schedule=[{at:0,type:'raider'},{at:0,type:'raider'}];assert.ok(beginBattle(g))
  g.enemies[0].hp=7;g.enemies[1].hp=100;g.healedCharge=60;a.hp-=20
  healUnit(g,a,15,0,b)
  const event=g.combatLedger.itemEvents.at(-1)
  assert.equal(event.id,'heart-engine');assert.equal(event.phase,'battle');assert.equal(event.orderId,null)
  assert.equal(event.effects.damage,22);assert.equal(event.effects.targets,2)
  assert.equal(event.triggered,true);assert.equal(event.effective,true)
  assert.equal(combatSummary(g).systems.find(row=>row.id==='heart-engine').damage,22)
})

test('corrupted optional score metadata is discarded without erasing valid counters, history or expedition progress',()=>{
  const g=createGame({seed:'bad-trace'});deal(g,['♠2']);assert.ok(deploy(g))
  const saved=snapshotGame(g);saved.lastDeploy.scoreTrace.steps='corrupt'
  saved.combatLedger.orders[0].scoreTrace.finalScore++
  const restored=restoreGame(saved);assert.ok(restored)
  assert.equal(restored.lastDeploy.scoreTrace,undefined)
  assert.equal(restored.combatLedger.orders[0].scoreTrace,undefined)
  assert.equal(restored.combatLedger.partial,false)
  assert.equal(restored.combatLedger.orders.length,1)
  assert.equal(restored.stats.deploys,g.stats.deploys)
  assert.ok(validCombatStats(restored))
  finishCombatStats(g,'cleared');const summary=combatSummary(g)
  const bad=structuredClone(summary);bad.orders[0].scoreTrace.items='bad'
  const store={getItem:key=>key===combatHistoryKey?JSON.stringify([bad]):null}
  const history=loadCombatHistory(store)
  assert.equal(history.length,1);assert.equal(history[0].orders[0].scoreTrace,undefined)
  const malformed=snapshotGame(g);malformed.lastDeploy.scoreTrace.items=[null]
  const safe=restoreGame(malformed);assert.ok(safe);assert.equal(safe.lastDeploy.scoreTrace,undefined)
})
