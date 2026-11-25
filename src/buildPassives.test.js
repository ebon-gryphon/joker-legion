import test from 'node:test'
import assert from 'node:assert/strict'
import {createGame,addUnit,deploy,previewHand,beginBattle,tick,setOrderTarget,designateChampion,forgeUnit,snapshotGame,restoreGame} from './engine.js'
import {planHand} from './handPlan.js'
import {handScore,scoringHand} from './orders.js'
import {BUILD_PASSIVES,describeBuildPassive,createBuildState,resetBuildWave,validBuildState,validBuildUnitStats,acquireBuildPassive,syncBuildUnitStats,unmodifiedBuildStat,applyBuildPassiveAttack} from './buildPassives.js'
import {healUnit,damageUnit} from './combatHealth.js'
import {grantExperience,advanceChampion} from './training.js'
import {waveChange,lastingStat,restedSoldier} from './standingArmy.js'
import {applyArmyReward} from './rewardModifiers.js'
import {mergePreview} from './forge.js'
import {combatSummary,validOrderScoreTrace} from './combatStats.js'
import {effect} from './gameState.js'
import {DETACHMENTS} from './recruitment.js'
import {JOKER_BY_ID} from './campaignRules.js'

const clone=value=>JSON.parse(JSON.stringify(value))
const own=(game,...ids)=>ids.forEach(id=>assert.ok(acquireBuildPassive(game,id)))
function game(seed='build-passives'){const g=createGame({seed});g.jokers=[];return g}
function deal(g,faces){
 const stock=[...g.hand,...g.deck],used=new Set(),cards=faces.map(face=>{const card=stock.find(card=>card.suit+card.rank===face&&!used.has(card.id));assert.ok(card,'Physical card exists: '+face);used.add(card.id);return card})
 const rest=stock.filter(card=>!used.has(card.id));g.hand=[...cards,...rest.slice(0,8-cards.length)];g.deck=rest.slice(8-cards.length);g.selected=cards.map(card=>card.id)
}
const rawScore=g=>{const {key,points}=scoringHand(g.hand.filter(card=>g.selected.includes(card.id)));return handScore(key,g.handLevels[key],points).total}
const event=(g,id)=>g.buildPassives.events.filter(row=>row.id===id)
function troop(g,type='knight',grade=0){const pattern=type==='healer'?'pair':type==='ranger'?'three':'high';return addUnit(g,type,'ally',1,{identity:{...DETACHMENTS[pattern].members[0],pattern,grade,source:'card'}})}

test('passive descriptions derive percentages, card thresholds and wave limits from the same rule configuration',()=>{
 for(const row of BUILD_PASSIVES){assert.equal(row.description,describeBuildPassive(row.id));assert.ok(!/[{}]/.test(row.description))}
 assert.match(describeBuildPassive('five-card-order',{percent:.4,cards:4,perWave:2}),/前2次成功出 4 张牌.*\+40%/)
 assert.match(describeBuildPassive('light-march',{refund:3,maxCards:1,perWave:4}),/至多 1 张牌返还 3.*至多 4 次/)
 assert.match(describeBuildPassive('spade-law',{shield:27,minScoring:3}),/至少 3 张.*27 护盾/)
 assert.match(describeBuildPassive('diamond-return',{perCard:2,cap:7}),/每张返还 2.*最多 7/)
 assert.match(describeBuildPassive('elite-pact',{percent:.15,minGrade:5}),/神话以上.*\+15%/)
})

test('the twelve unique rules have pure previews; only successful deploy advances the same-wave previous hand',()=>{
 assert.equal(BUILD_PASSIVES.length,12);assert.equal(new Set(BUILD_PASSIVES.map(row=>row.id)).size,12)
 const g=game();own(g,'same-hand','varied-hand');deal(g,['♠2'])
 const before=snapshotGame(g)
 for(let i=0;i<4;i++){assert.equal(previewHand(g).score.total,rawScore(g));assert.deepEqual(snapshotGame(g),before)}
 assert.ok(deploy(g));assert.equal(g.buildPassives.wave.previousHand,'high')
 deal(g,['♣2']);g.waveBonuses.active.firstScorePercent=.25
 const raw=rawScore(g),p=previewHand(g)
 assert.equal(p.score.total,Math.floor(raw*(1+.25+.2)));assert.equal(p.score.rewardPercent,.45)
 assert.ok(p.score.total>raw+Math.floor(raw*.25)+Math.floor(raw*.2),'combine percentages before a single rounding')
 assert.deepEqual(p.scoreTrace.finalBonus.sources.map(row=>row.id),['wave-first-score','same-hand'])
 assert.equal(p.scoreTrace.steps.filter(step=>step.kind==='scoreBonus').length,1)
 assert.ok(deploy(g));assert.equal(g.lastDeploy.score,p.score.total);assert.equal(g.waveBonuses.active.firstScorePercent,0)
 deal(g,['♥4','♦4']);const varied=previewHand(g)
 assert.equal(varied.score.total,Math.floor(rawScore(g)*1.2));assert.equal(varied.scoreTrace.finalBonus.sources[0].id,'varied-hand')
 const pending=snapshotGame(g);g.energy=0;const failed=snapshotGame(g)
 assert.equal(deploy(g),false);assert.deepEqual(snapshotGame(g),failed);assert.equal(g.buildPassives.wave.previousHand,'high')
 g.energy=pending.energy;assert.ok(deploy(g));assert.equal(g.buildPassives.wave.previousHand,'pair')
 assert.equal(event(g,'same-hand').length,1);assert.equal(event(g,'varied-hand').length,1)
 const counts=clone(g.buildPassives.counts);g.wave++;resetBuildWave(g)
 assert.equal(g.buildPassives.wave.previousHand,null);assert.deepEqual(g.buildPassives.counts,counts);assert.deepEqual(g.buildPassives.events,[])
 assert.ok(validBuildState(g.buildPassives))
})

test('same-wave refund sources share the actual cost cap and failed previews never consume opportunities',()=>{
 const g=game();own(g,'light-march','diamond-return');deal(g,['♦2'])
 const before=snapshotGame(g),p=previewHand(g)
 assert.equal(p.buildPlan.light,1);assert.equal(p.buildPlan.diamondRefund,1);assert.deepEqual(snapshotGame(g),before)
 assert.ok(deploy(g));assert.equal(g.energy,16)
 assert.deepEqual(event(g,'light-march').map(row=>row.effects.energyRefund),[1])
 assert.deepEqual(event(g,'diamond-return').map(row=>row.effects.energyRefund),[1])
 delete g.buildPassives.wave.counters.uses
 assert.ok(validBuildState(g.buildPassives));assert.equal(previewHand(g,[g.hand[0].id]).buildPlan.diamond,false)
 deal(g,['♦3']);assert.ok(deploy(g));assert.equal(g.energy,15)
 deal(g,['♦4']);assert.ok(deploy(g));assert.equal(g.energy,13)
 assert.equal(g.buildPassives.wave.counters.lightMarchUses,2);assert.equal(g.buildPassives.wave.counters.diamondReturnUsed,true)
 assert.equal(event(g,'diamond-return').length,1)
})

test('a paid free hand refunds zero, preserves light-march uses, and honestly consumes the first diamond opportunity',()=>{
 const g=game();own(g,'light-march','diamond-return');g.paidHandsLeft=1;deal(g,['♦2'])
 const p=previewHand(g);assert.equal(p.cost,0);assert.equal(p.buildPlan.light,0);assert.equal(p.buildPlan.diamondRefund,0)
 assert.ok(deploy(g));assert.equal(g.energy,16);assert.equal(g.buildPassives.wave.counters.lightMarchUses,0)
 const e=event(g,'diamond-return')[0];assert.equal(e.effects.energyRefund,0);assert.equal(e.effective,false)
 assert.ok(g.lastDeploy.scoreTrace.passives.find(row=>row.id==='diamond-return').actual.reason.includes('0'))
})

test('five-card orders apply once before the captain-only multiplier and respect the real haste floor',()=>{
 const g=game(),captain=troop(g),other=troop(g)
 assert.ok(designateChampion(g,captain.id));assert.ok(setOrderTarget(g,'knight'))
 deal(g,['♠2','♥3','♣4','♦5','♠6']);const base=previewHand(g).bonus
 own(g,'five-card-order','captain-orders');const p=previewHand(g)
 for(const [key,value] of Object.entries(base)){assert.equal(p.bonus[key],Math.round(value*1.25));assert.equal(p.captainBonus[key],Math.round(p.bonus[key]*1.3))}
 const a=clone(captain),b=clone(other);assert.ok(deploy(g))
 assert.equal(captain.atk-a.atk,p.captainBonus.force || 0);assert.equal(other.atk-b.atk,p.bonus.force || 0)
 assert.equal(captain.period,Math.max(.35,a.period*(1-(p.captainBonus.haste || 0)/100)))
 assert.equal(event(g,'captain-orders').length,1);assert.deepEqual(event(g,'captain-orders')[0].targetIds,[captain.id])
 assert.equal(event(g,'five-card-order').length,1)
 deal(g,['♠7','♥8','♣9','♦10','♠J']);assert.equal(previewHand(g).buildPlan.five,false)
})

test('black suits count scoring spades only, and the first qualifying hand shields only actual field iron troops',()=>{
 const g=game(),iron=troop(g),ranger=troop(g,'ranger');own(g,'spade-law')
 deal(g,['♠9','♠10']);assert.equal(previewHand(g).scoringIds.length,1);assert.ok(deploy(g));assert.equal(iron.shield,0)
 deal(g,['♠2','♥2','♣2','♠3','♥3']);assert.ok(deploy(g))
 assert.equal(iron.shield,18);assert.equal(ranger.shield,0)
 const row=event(g,'spade-law')[0];assert.ok(row.targetIds.includes(iron.id));assert.ok(!row.targetIds.includes(ranger.id))
 const total=row.targetIds.length*18;assert.equal(row.effects.shield,total)
 deal(g,['♠4','♥4','♣4','♠5','♥5']);assert.ok(deploy(g));assert.equal(iron.shield,18);assert.equal(event(g,'spade-law').length,1)
})

test('heart-oath buffs current and future healer-regiment healing, caps actual benefit, and resets next wave',()=>{
 const g=game(),priest=troop(g,'healer'),target=troop(g);own(g,'heart-oath')
 deal(g,['♥2','♠2','♣2','♥3','♦3']);assert.ok(deploy(g))
 target.hp=target.maxHp-30;assert.equal(healUnit(g,target,10,0,priest),12)
 assert.equal(event(g,'heart-oath').at(-1).effects.extraHealing,2)
 target.hp=target.maxHp-5;assert.equal(healUnit(g,target,10,0,priest),5)
 assert.equal(event(g,'heart-oath').at(-1).effects.extraHealing,0);assert.equal(event(g,'heart-oath').at(-1).effective,false)
 const future=troop(g,'healer');target.hp=target.maxHp-30;assert.equal(healUnit(g,target,10,0,future),12)
 target.hp=target.maxHp-30;assert.equal(healUnit(g,target,10,0,target),10)
 g.wave++;resetBuildWave(g);target.hp=target.maxHp-30;assert.equal(healUnit(g,target,10,0,future),10)
})

test('club-hunt emits one real extra missile per field ranger and does not claim overkill as damage',()=>{
 const g=game(),ranger=troop(g,'ranger');own(g,'club-hunt')
 deal(g,['♣2','♠2','♥2','♣3','♦3']);assert.ok(deploy(g))
 g.schedule=[{at:0,type:'raider'}];assert.ok(beginBattle(g))
 const target=g.enemies[0];target.x=ranger.x+20;target.y=ranger.y;target.hp=target.maxHp=10000;target.atk=0;target.speed=0;ranger.cooldown=0
 tick(g,.05)
 const arrows=event(g,'club-hunt').filter(row=>row.effects.arrows)
 assert.equal(arrows.length,1);assert.equal(arrows[0].effects.requested,ranger.atk*.6);assert.ok(arrows[0].effects.damage>0)
 assert.ok(g.effects.filter(row=>row.type==='projectile').length>=2)
 for(let i=0;i<60;i++)tick(g,1/30)
 assert.equal(event(g,'club-hunt').filter(row=>row.effects.arrows).length,1)
 const future={...ranger,id:'future-ranger'};target.hp=0
 const empty=applyBuildPassiveAttack(g,future,target,{damageUnit,launchMissile:(state,unit,foe)=>{effect(state,'projectile',unit.x,unit.y,'arrow');return .1}})
 assert.equal(empty.effects.damage,0);assert.equal(empty.effective,false);assert.equal(empty.effects.arrows,1)
 const mirror={...ranger,id:'actual-ranger-echo',echoUntil:g.time+3};target.hp=target.maxHp
 const hooks={damageUnit,launchMissile:(state,unit)=>{effect(state,'projectile',unit.x,unit.y,'arrow');return .1}}
 const mirrored=applyBuildPassiveAttack(g,mirror,target,hooks)
 assert.equal(mirrored.unitId,mirror.id);assert.ok(mirrored.effects.damage>0)
 assert.equal(applyBuildPassiveAttack(g,mirror,target,hooks),null)
})

test('reserve-instructor affects real full-army XP only, respects 999, and leaves legendary reserves unchanged',()=>{
 const g=game('instructor');for(let i=0;i<5;i++)troop(g)
 own(g,'reserve-instructor');deal(g,['♠2'])
 const p=planHand(g,g.selected,true);assert.equal(p.waiting,false);assert.ok(p.buildPlan.baseTrainingXp>0)
 assert.equal(p.trainingXp,Math.floor(p.buildPlan.baseTrainingXp*1.5))
 const trainer=g.allies.find(unit=>unit.id===p.trainerId);trainer.trainingXp=998
 const capped=previewHand(g);assert.equal(capped.scoreTrace.recruit.xp,1)
  assert.equal(capped.scoreTrace.passives.find(row=>row.id==='reserve-instructor').potential.xpGain,0)
 assert.ok(deploy(g));assert.equal(trainer.trainingXp,999)
 assert.equal(event(g,'reserve-instructor').at(-1).effects.xpGain,0)
 g.energy=16;g.handsLeft=2;deal(g,['♦2','♦3','♦4','♦5','♦6'])
 const reserve=planHand(g,g.selected,true);assert.equal(reserve.waiting,true);assert.equal(reserve.trainingXp,0);assert.equal(reserve.buildPlan.instructor,false)
 const count=event(g,'reserve-instructor').length;assert.ok(deploy(g));assert.equal(g.reserves.length,1);assert.equal(event(g,'reserve-instructor').length,count)
})

test('reserve-instructor gives a positive real fifty-percent training gain before the experience cap',()=>{
 const g=game('instructor-positive');for(let i=0;i<5;i++)troop(g)
 own(g,'reserve-instructor');deal(g,['♠2'])
 const p=planHand(g,g.selected,true),trainer=g.allies.find(unit=>unit.id===p.trainerId),before=trainer.trainingXp
 const base=p.buildPlan.baseTrainingXp,expected=Math.floor(base*1.5)
 assert.ok(expected>base);assert.ok(deploy(g));assert.equal(trainer.trainingXp-before,expected)
 const actual=event(g,'reserve-instructor').at(-1)
 assert.equal(actual.effects.xpGain,expected-base);assert.equal(actual.effects.totalXp,expected);assert.equal(actual.effective,true)
})

test('fusion and elite modifiers add on one permanent base independent of acquisition order and never multiply temporary orders',()=>{
 const make=()=>{const g=game('persistent-build'),unit=troop(g,'knight',4);unit.fusionJobs=['blade','priest'];return {g,unit}}
 const a=make(),b=make(),base=lastingStat(a.unit,'atk')
 own(a.g,'fusion-code','elite-pact');own(b.g,'elite-pact','fusion-code')
 assert.equal(a.unit.atk,base+Math.round(base*.22));assert.equal(a.unit.atk,b.unit.atk)
 assert.equal(a.unit.buildPassiveStats.percent,.22)
 assert.equal(acquireBuildPassive(a.g,'fusion-code'),false)
 waveChange(a.unit,()=>{a.unit.atk+=100;a.unit.heal+=20})
 const current=clone(a.unit);for(let i=0;i<5;i++)syncBuildUnitStats(a.g,a.unit)
 assert.deepEqual(a.unit,current);assert.equal(unmodifiedBuildStat(a.unit,'atk'),base)
 grantExperience(a.g,a.unit,20);assert.equal(lastingStat(a.unit,'atk'),unmodifiedBuildStat(a.unit,'atk')+Math.round(unmodifiedBuildStat(a.unit,'atk')*.22))
 const rewardBase=unmodifiedBuildStat(a.unit,'atk');assert.ok(applyArmyReward(a.g,{attackPercent:.06,attackCap:1}))
 assert.equal(unmodifiedBuildStat(a.unit,'atk'),rewardBase+Math.round(rewardBase*.06))
 const rested=restedSoldier(a.unit),restedAtk=rested.atk;syncBuildUnitStats(a.g,rested);assert.equal(rested.atk,restedAtk)
 const loaded=restoreGame(snapshotGame(a.g));assert.ok(loaded);const restored=loaded.allies[0],before=clone(restored)
 syncBuildUnitStats(loaded,restored);assert.deepEqual(restored,before)
})

test('future recruits, profession merges, legacy fusions and promotions each get exactly one eligible modifier',()=>{
 const g=game('future-builds');g.gold=100;own(g,'fusion-code','elite-pact')
 const leader=troop(g,'knight',4),donor=troop(g,'healer',0),expected=mergePreview(g,leader.id,donor.id,'profession')
 assert.equal(leader.buildPassiveStats.percent,.1);assert.equal(expected.buildPassiveStats.percent,.22)
 const before=clone(leader);assert.ok(forgeUnit(g,leader.id,donor.id,'profession'))
 assert.equal(leader.atk,expected.atk);assert.equal(leader.heal,expected.heal);assert.equal(leader.buildPassiveStats.percent,.22)
 assert.ok(leader.atk>before.atk)
 const oldA=addUnit(g,'knight','ally',2),oldB=addUnit(g,'healer','ally',2)
 assert.ok(forgeUnit(g,oldA.id,oldB.id,'paladin'));assert.equal(oldA.buildPassiveStats.percent,.12)
 const captain=troop(g,'knight',4);assert.ok(designateChampion(g,captain.id));g.champion.marks=1
 advanceChampion(g,captain);assert.equal(captain.level,2);assert.equal(captain.buildPassiveStats.percent,.1)
 assert.equal(lastingStat(captain,'atk'),unmodifiedBuildStat(captain,'atk')+Math.round(unmodifiedBuildStat(captain,'atk')*.1))
})

test('combined rounding records no invented permanent gain when a newly acquired percent changes no real attribute',()=>{
 const g=game('passive-rounding'),unit=troop(g,'knight',4);unit.fusionJobs=['blade','priest'];unit.atk=5
 own(g,'elite-pact');assert.equal(unit.atk,6)
 own(g,'fusion-code');assert.equal(unit.atk,6)
 const added=event(g,'fusion-code').at(-1);assert.equal(added.effects.attackGain,0);assert.equal(added.effective,false)
 assert.equal(acquireBuildPassive(g,'toString'),false)
})

test('a real blade-oil training order recalculates the permanent modifier once without leaving a stale saved ledger',()=>{
 const g=game('oil-passive');g.jokers=[{...JOKER_BY_ID['blade-oil']}];own(g,'elite-pact')
 for(let i=0;i<5;i++)troop(g,'knight',4)
 g.selected=[g.hand[0].id];const p=previewHand(g),trainer=g.allies.find(unit=>unit.id===p.trainerId)
 assert.equal(p.waiting,false);assert.ok(trainer);const before=unmodifiedBuildStat(trainer,'atk')
 assert.ok(deploy(g));assert.ok(unmodifiedBuildStat(trainer,'atk')>=before+3)
 assert.ok(g.allies.every(validBuildUnitStats));assert.equal(g.jokers.some(item=>item.id==='blade-oil'),false)
})

test('accepted traces and reports retain real passive events, all sources of one final-score addition and read-only state',()=>{
 const g=game('passive-report');own(g,'same-hand','light-march','diamond-return');deal(g,['♠2']);assert.ok(deploy(g))
 g.waveBonuses.active.firstScorePercent=.25;deal(g,['♦3']);const before=snapshotGame(g),p=previewHand(g)
 assert.deepEqual(snapshotGame(g),before);assert.ok(deploy(g));const trace=g.lastDeploy.scoreTrace
 assert.ok(validOrderScoreTrace(trace,true));assert.equal(trace.finalScore,p.score.total)
 assert.equal(trace.chipsBeforeMult*trace.mult+trace.finalBonus.amount,trace.finalScore)
 assert.equal(trace.finalBonus.sources.length,2);assert.equal(trace.passives.find(row=>row.id==='diamond-return').actual.effects.energyRefund,1)
 const report=combatSummary(g);assert.ok(report.passiveEvents.some(row=>row.id==='same-hand'))
 assert.ok(report.passiveEvents.every(row=>row.orderId===g.lastDeploy.id || row.orderId===g.combatLedger.orders[0].id))
 const loaded=restoreGame(snapshotGame(g));assert.ok(loaded);assert.deepEqual(loaded.buildPassives,g.buildPassives)
})

test('restore rejects a missing permanent-passive ledger without rejecting intact or legacy soldiers without passives',()=>{
 const g=game('required-passive-ledger'),unit=troop(g,'knight',4);own(g,'elite-pact')
 const intact=snapshotGame(g),restored=restoreGame(intact)
 assert.ok(restored);assert.equal(restored.allies[0].atk,unit.atk)
 const missing=clone(intact);delete missing.allies[0].buildPassiveStats
 assert.equal(restoreGame(missing),null)
 const plain=game('legacy-no-passive-ledger'),ordinary=troop(plain,'knight',4),modern=snapshotGame(plain)
 assert.equal(ordinary.buildPassiveStats,undefined);assert.ok(restoreGame(modern))
 const legacy=clone(modern)
 for(const key of ['lifeVersion','lifeFailed','lifeEvents','lifeItemState','buildPassives','legacyLifeHistory'])delete legacy[key]
 legacy.baseHp=legacy.maxBaseHp=100
 const migrated=restoreGame(legacy)
 assert.ok(migrated);assert.equal(migrated.allies[0].atk,ordinary.atk);assert.deepEqual(migrated.buildPassives.ids,[])
})
