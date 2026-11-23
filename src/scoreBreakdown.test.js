import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame,previewHand,deploy,addUnit,snapshotGame,restoreGame } from './engine.js'
import { planHand } from './handPlan.js'
import { handScore,orderBonus,orderBonusFromScore,scoreCardPoints } from './orders.js'
import { JOKER_BY_ID } from './campaignRules.js'
import { scoreContributionRows,itemTrace,DEMO_ITEM_IDS } from './itemTrace.js'
import { resolveScoreTrace } from './scoreBreakdown.js'
const own=(g,id,quantity=1)=>g.jokers.push({...JOKER_BY_ID[id],quantity,triggers:0,flash:0})
function deal(g,faces) {
  const stock=[...g.hand,...g.deck],picked=faces.map(face=>stock.find(card=>card.suit+card.rank===face))
  assert.ok(picked.every(Boolean));const rest=stock.filter(card=>!picked.includes(card))
  g.hand=[...picked,...rest.slice(0,8-picked.length)];g.deck=rest.slice(8-picked.length);g.selected=picked.map(card=>card.id)
}

test('one authoritative score feeds all order bonuses, including stacked chip items',()=>{
  const g=createGame();own(g,'score-chalk',18);own(g,'pair-ink',18);deal(g,['♥2','♦2'])
  const p=previewHand(g),old=orderBonus(p.key,p.level,p.points)
  assert.equal(p.extraChips,90);assert.deepEqual(p.bonus,orderBonusFromScore(p.key,p.score.total))
  assert.notDeepEqual(p.bonus,old);assert.equal(p.scoreTrace.finalScore,p.score.total)
  assert.equal(p.scoreTrace.order.sourceScore,p.score.total);assert.deepEqual(p.scoreTrace.order.bonus,p.bonus)
  assert.deepEqual(orderBonus('pair',2,18),orderBonusFromScore('pair',handScore('pair',2,18).total))
})

test('every chip contribution uses the same ordered source list and only scoring cards count',()=>{
  const g=createGame();for(const id of ['score-chalk','red-thread','black-wax','court-seal','straight-compass','score-ticket','pair-ink'])own(g,id,2)
  deal(g,['♠J','♥J','♦2']);const p=previewHand(g),trace=p.scoreTrace
  assert.deepEqual(trace.scoringCards.map(card=>card.points),[10,10]);assert.equal(trace.nonScoringCards.length,1)
  assert.equal(trace.nonScoringCards[0].suit,'♦')
  assert.equal(trace.chipBonuses.find(row=>row.id==='red-thread').delta,2)
  assert.equal(trace.chipBonuses.find(row=>row.id==='black-wax').delta,2)
  assert.equal(trace.chipBonuses.find(row=>row.id==='court-seal').delta,8)
  assert.equal(trace.chipBonuses.find(row=>row.id==='score-ticket').delta,10)
  assert.equal(trace.chipBonuses.find(row=>row.id==='pair-ink').delta,6)
  assert.equal(trace.chipBonuses.find(row=>row.id==='straight-compass').delta,0)
  assert.match(trace.chipBonuses.find(row=>row.id==='straight-compass').reason,/不是顺子/)
  assert.equal(trace.chipBonuses.at(-1).runningChips,trace.chipsBeforeMult)
  assert.equal(trace.steps.find(step=>step.kind==='multiply').total,trace.finalScore)
  assert.equal(trace.steps.filter(step=>step.kind==='item').length,6)
})

test('A and court ranks share the engine point function and level chips stay separate from card points',()=>{
  assert.equal(scoreCardPoints({rank:'A'}),11);assert.equal(scoreCardPoints({rank:'K'}),10)
  const g=createGame();g.handLevels.pair=2;deal(g,['♥9','♦9']);const trace=previewHand(g).scoreTrace
  assert.deepEqual([trace.hand.baseChips,trace.hand.levelChips,trace.scoringCards.reduce((n,c)=>n+c.points,0),trace.mult,trace.finalScore],[10,15,18,3,129])
})

test('preview traces are immutable and never roll rarity, consume tickets or change the run',()=>{
  const g=createGame();own(g,'score-ticket',3);deal(g,['♥8','♦8'])
  const before=snapshotGame(g),one=previewHand(g).scoreTrace,two=previewHand(g).scoreTrace
  assert.deepEqual(one,two);assert.deepEqual(snapshotGame(g),before)
  assert.equal(one.quality.rolled,undefined);assert.equal(one.quality.odds.reduce((n,row)=>n+row.chance,0),100)
  assert.ok(Object.isFrozen(one));assert.ok(Object.isFrozen(one.scoringCards[0]))
  assert.throws(()=>{one.scoringCards[0].points=999},TypeError)
  const actual=planHand(g,g.selected,true).scoreTrace;assert.equal(actual.quality.rolled,planHand(g,g.selected,true).captainGrade)
  assert.ok(deploy(g));assert.equal(g.jokers.find(item=>item.id==='score-ticket').quantity,2)
})

test('full-army previews explain legendary reserve uncertainty while actual plans reveal the true branch',()=>{
  const g=createGame({seed:'reserve-trace'});for(let i=0;i<5;i++)addUnit(g,'knight','ally')
  deal(g,['♠2']);const p=previewHand(g),actual=planHand(g,g.selected,true)
  assert.equal(p.scoreTrace.recruit.overflow,true);assert.equal(p.scoreTrace.recruit.actualCount,0)
  assert.match(p.scoreTrace.recruit.legendaryAlternative,/传说/)
  assert.equal(actual.scoreTrace.recruit.legendaryAlternative,null)
  assert.equal(actual.scoreTrace.recruit.reserve,actual.waiting)
})

test('full-army XP previews respect the existing 999 cap without promising planned XP or hiding the legendary alternative',()=>{
  const g=createGame();for(let i=0;i<5;i++)addUnit(g,'knight','ally').trainingXp=999
  deal(g,['♠2']);const p=previewHand(g)
  assert.ok(p.trainingXp>0);assert.equal(p.scoreTrace.recruit.plannedXp,p.trainingXp)
  assert.equal(p.scoreTrace.recruit.xp,0);assert.match(p.scoreTrace.recruit.summary,/999 上限/)
  assert.match(p.scoreTrace.recruit.legendaryAlternative,/传说/)
})

test('six demonstration facts distinguish trigger conditions, global third-play cadence and effective healing',()=>{
  const g=createGame({doctrine:'arcane'});own(g,'iron-banner');own(g,'red-echo');own(g,'heart-engine')
  addUnit(g,'knight','ally');deal(g,['♥8','♦8']);g.stats.deploys=2
  const p=previewHand(g),rows=itemTrace(g,p,{scoring:g.hand.slice(0,2)})
  assert.deepEqual(rows.map(row=>row.id),DEMO_ITEM_IDS)
  assert.equal(rows.find(row=>row.id==='third-act').counter.ordinal,3)
  assert.equal(rows.find(row=>row.id==='third-act').potential.starGain,1)
  assert.match(rows.find(row=>row.id==='iron-banner').reason,/满血/)
  assert.match(rows.find(row=>row.id==='red-echo').reason,/有效治疗为 0/)
  assert.equal(rows.find(row=>row.id==='heart-engine').phase,'combat')
  assert.equal(rows.find(row=>row.id==='heart-engine').counter.threshold,70)
  deal(g,['♠A','♥2']);const high=previewHand(g)
  const noHeart=high.scoreTrace.items.find(row=>row.id==='red-echo');assert.equal(noHeart.eligible,false)
  assert.match(noHeart.reason,/没有红桃参与计分/)
})

test('resolved traces preserve authoritative score and attach measured zero benefits rather than advertised healing',()=>{
  const g=createGame();own(g,'red-echo');deal(g,['♥8','♦8']);const trace=planHand(g,g.selected,true).scoreTrace
  const result=resolveScoreTrace(trace,{recruit:{actualCount:1,summary:'牧师 ×1 入阵。'},items:[{id:'red-echo',triggered:true,effective:false,reason:'全员满血，有效治疗0；城门满耐久。',effects:{healed:0,gateRepaired:0}}]})
  assert.equal(result.finalScore,trace.finalScore);assert.equal(result.recruit.summary,'牧师 ×1 入阵。')
  assert.equal(result.items.find(row=>row.id==='red-echo').actual.effects.healed,0)
  assert.equal(result.items.find(row=>row.id==='red-echo').actual.effective,false)
  assert.ok(Object.isFrozen(result.items));assert.equal(trace.items.find(row=>row.id==='red-echo').actual,null)
  const redStep=result.steps.find(step=>step.itemId==='red-echo')
  assert.equal(redStep.kind,'relic');assert.match(redStep.label,/有效治疗 0/);assert.match(redStep.label,/实际修城 0/)
  assert.equal(redStep.delta,undefined);assert.equal(redStep.total,undefined)
  assert.ok(result.steps.findIndex(step=>step.id==='order')<result.steps.indexOf(redStep))
  assert.ok(restoreGame(snapshotGame(g)))
})

test('actual relic steps preserve engine timing without replaying inactive combat effects or inventing chip deltas',()=>{
  const g=createGame({doctrine:'arcane'});for(const id of ['iron-banner','red-echo','heart-engine'])own(g,id)
  g.stats.deploys=2;deal(g,['♥8','♦8']);const trace=planHand(g,g.selected,true).scoreTrace
  const result=resolveScoreTrace(trace,{items:[
    {id:'third-act',triggered:true,effective:true,reason:'满编额外集训2经验',effects:{starGain:0,xpGain:2}},
    {id:'iron-banner',triggered:true,effective:true,reason:'赋盾24，满血治疗0',effects:{shield:24,healed:0}},
    {id:'red-echo',triggered:true,effective:false,reason:'全员满血',effects:{healed:0,gateRepaired:0}},
    {id:'heart-engine',triggered:false,effective:false,reason:'有效治疗未满70',effects:{damage:0}},
  ]})
  const chain=result.steps.filter(step=>['quality','muster','order'].includes(step.id) || step.kind==='relic')
  assert.deepEqual(chain.map(step=>step.id),['quality','relic-third-act','muster','order','relic-iron-banner','relic-red-echo'])
  assert.ok(chain.filter(step=>['relic','order'].includes(step.kind)).every(step=>step.delta===undefined && step.chips===undefined))
  assert.match(chain[1].label,/额外经验 \+2/)
  const heart=resolveScoreTrace(trace,{items:[{id:'heart-engine',triggered:true,effective:true,reason:'本手实际转化',effects:{damage:23.5,targets:2}}]})
  assert.equal(heart.steps.at(-1).itemId,'heart-engine');assert.match(heart.steps.at(-1).label,/23.5/)
  assert.equal(result.finalScore,trace.finalScore)
})
