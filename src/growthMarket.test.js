import {claimTestReward, setTestRewardShelf, claimAvailableReward} from './rewardFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, deploy, previewHand, beginBattle, chooseReward, nextWave, addUnit, drill,
  drillPreview, fieldReserve, forgeUnit, designateChampion, buyJoker, sellJoker, rerollShop, snapshotGame, restoreGame } from './engine.js'
import { endWave } from './campaign.js'
import { unitStep } from './combatActions.js'
import { copies } from './gameState.js'
import { JOKER_BY_ID } from './campaignRules.js'
import { workshopPairs, mergePreview } from './forge.js'
import { LESSONS, veteranLevel, grantExperience } from './training.js'
import { DETACHMENTS } from './recruitment.js'

const saved = g => restoreGame(snapshotGame(g))
const add = (g,id,quantity=1) => g.jokers.push({...JOKER_BY_ID[id], quantity, triggers:0, flash:0})
function soldier(g,pattern,grade=0,level=1) {
  const face = DETACHMENTS[pattern].members[0]
  return addUnit(g,face.type,'ally',level,{identity:{...face,pattern,grade,source:'card'}})
}

test('a direct drop promotes equal legendary grades first, across jobs, stars and champion locks',()=>{
  const g=createGame(), leader=soldier(g,'pair',4), a=soldier(g,'high',4,2), b=soldier(g,'straight',4), c=soldier(g,'four',4)
  g.gold=0;designateChampion(g,leader.id)
  const pair=workshopPairs(g).ascend.find(p=>p.leader===leader && p.donor===a)
  assert.ok(pair);assert.equal(drillPreview(g,leader.id,a.id),null)
  assert.equal(drillPreview(g,a.id,leader.id).kind,'ascend')
  const expected=mergePreview(g,leader.id,a.id,'ascend')
  assert.ok(drill(g,a.id,leader.id));assert.equal(leader.grade,5)
  assert.equal(leader.level,2);assert.equal(leader.atk,expected.atk)
  assert.ok(forgeUnit(g,b.id,c.id,'ascend'));assert.ok(drill(g,b.id,leader.id))
  assert.deepEqual([g.allies.length,g.gold,leader.grade,g.champion.grade,g.fusions],[1,0,6,6,3])
  assert.deepEqual(new Set(leader.lessons),new Set(['blade','cavalry','assassin']))
  assert.equal(drill(g,b.id,leader.id),false)
  const copy=saved(g);assert.deepEqual(copy.allies,g.allies)
  const patient=soldier(copy,'high')
  beginBattle(copy);const healer=copy.allies[0];patient.x=healer.x+1;patient.y=healer.y;patient.hp-=15;healer.cooldown=0
  unitStep(copy,healer,0);const shield=Math.ceil(healer.maxHp*.2)
  assert.equal(patient.shield,shield);healer.cooldown=0;patient.hp-=5;unitStep(copy,healer,0)
  assert.equal(patient.shield,shield)
})
test('a full camp banks a revealed legend, reloads it and allows fusion or deployment without taking a sixth field slot',()=>{
  const g=createGame({seed:104});const leader=soldier(g,'high',4)
  for(let i=0;i<4;i++) soldier(g,'pair')
  g.selected=[g.hand[0].id];assert.ok(deploy(g));assert.equal(g.allies.length,5)
  assert.equal(g.lastDeploy.waiting,true);assert.equal(g.reserves.length,1)
  const copy=saved(g),[waiting]=copy.reserves
  assert.equal(fieldReserve(copy,waiting.id),false)
  assert.ok(forgeUnit(copy,leader.id,waiting.id,'ascend'))
  assert.deepEqual([copy.reserves.length,copy.allies.length,copy.allies[0].grade],[0,5,5])
  assert.ok(saved(copy))
  assert.ok(drill(g,g.allies[4].id,g.allies[2].id))
  assert.ok(fieldReserve(g,g.reserves[0].id));assert.equal(g.allies.at(-1).grade,4)
  assert.equal(g.reserves.length,0)
})
test('different professions transfer distinct lessons, XP tiers and trained abilities survive a second donor',()=>{
  const g=createGame();g.gold=20;const lead=soldier(g,'high'), priest=soldier(g,'pair'), cavalry=soldier(g,'straight');grantExperience(g,priest,7)
  add(g,'drill-badge',2);add(g,'training-whistle',2)
  const p=drillPreview(g,priest.id,lead.id);assert.equal(p.kind,'profession');assert.equal(p.cost,5)
  assert.equal(copies(g,'training-whistle'),2)
  assert.ok(drill(g,priest.id,lead.id));assert.equal(copies(g,'training-whistle'),2)
  assert.deepEqual([lead.trainingXp,veteranLevel(lead.trainingXp),lead.lessons],[7,2,['priest']])
  assert.ok(drill(g,lead.id,cavalry.id));assert.equal(copies(g,'training-whistle'),2)
  assert.deepEqual(cavalry.lessons,['priest','blade']);assert.ok(saved(g))
  beginBattle(g);const foe=g.enemies[0];Object.assign(foe,{x:cavalry.x+7,y:cavalry.y,hp:999,maxHp:999})
  cavalry.hp-=70;cavalry.attacks=2;cavalry.cooldown=0
  const hp=cavalry.hp;unitStep(g,cavalry,0);assert.ok(cavalry.hp>hp)
  assert.ok(cavalry.fusionJobs.includes('priest'))
  endWave(g);const after=g.allies[0];assert.equal(after.trainingXp,cavalry.trainingXp+1)
  assert.deepEqual(saved(g).allies[0].lessons,cavalry.lessons)
})
test('sold offers keep positions, a second purchase is atomic, stacks and quantities survive reload and single-copy sale',()=>{
  let g=createGame();g.phase='shop';assert.ok(claimTestReward(g,'power'));g.crystals=200
  for (const id of ['red-echo','third-act','blood-pact','crossfire','score-chalk']) add(g,id)
  g.shop=['score-chalk','score-ticket','ward-pin']
  const offers=g.shop.slice()
  assert.ok(buyJoker(g,offers[0]));assert.deepEqual(g.shop,offers);assert.equal(copies(g,'score-chalk'),2)
  const before=snapshotGame(g);assert.equal(buyJoker(g,offers[0]),false);assert.deepEqual(snapshotGame(g),before)
  g=saved(g);assert.deepEqual(g.soldShop,['score-chalk']);assert.equal(copies(g,'score-chalk'),2)
  assert.ok(sellJoker(g,'score-chalk'));assert.equal(copies(g,'score-chalk'),1)
  assert.equal(buyJoker(g,offers[0]),false);assert.ok(buyJoker(g,'ward-pin'));assert.equal(g.jokers.length,7)
  assert.ok(rerollShop(g));assert.equal(g.shop.length,3);assert.deepEqual(g.soldShop,[])
  const corrupt=snapshotGame(g);corrupt.jokers[0].quantity=19;assert.equal(restoreGame(corrupt),null)
})
test('stacked scoring, consumable charges, opening shields and wave income are applied to actual actions exactly once',()=>{
  const g=createGame()
  const stock=[...g.hand,...g.deck], pair=['♥2','♦2'].map(face=>stock.find(c=>c.suit+c.rank===face))
  const rest=stock.filter(c=>!pair.includes(c));g.hand=[...pair,...rest.slice(0,6)];g.deck=rest.slice(6);g.selected=pair.map(c=>c.id)
  const base=previewHand(g).score
  for(const id of ['score-chalk','pair-ink','red-thread','score-ticket','ward-pin','gate-rivet','field-pay']) add(g,id,2)
  const hand=previewHand(g);assert.equal(hand.extraChips,4+6+4+10);assert.equal(hand.score.total,(base.chips+24)*base.mult)
  g.energy=0;assert.equal(deploy(g),false);assert.equal(copies(g,'score-ticket'),2)
  g.energy=16;assert.ok(deploy(g));assert.equal(copies(g,'score-ticket'),1);assert.equal(g.lastDeploy.score,hand.score.total)
  const guard=g.allies[0],shield=guard.shield;assert.ok(beginBattle(g));assert.equal(guard.shield,shield+6)
  g.baseHp-=10;let gold=g.gold;endWave(g);assert.equal(g.baseHp,g.maxBaseHp-8);assert.equal(g.gold-gold,12)
  assert.ok(claimTestReward(g,'repair'));assert.ok(nextWave(g));assert.ok(saved(g))
})

test('each life rivet layer restores one on a clear, while full life records zero without inventing a gain',()=>{
  for(const missing of [0,2]) {
    const g=createGame();soldier(g,'high');add(g,'gate-rivet',3);g.schedule=[];beginBattle(g)
    g.baseHp=g.maxBaseHp-missing;endWave(g)
    const event=(g.lifeEvents || []).find(event=>event.kind==='heal' && event.source==='gate-rivet')
    assert.ok(event);assert.equal(event.sourceId,'gate-rivet');assert.equal(event.attempted,3)
    assert.equal(event.amount,missing);assert.equal(g.baseHp,g.maxBaseHp)
    const before=snapshotGame(g);endWave(g);assert.deepEqual(snapshotGame(g),before)
  }
})

test('two waiting legends can fuse on the bench, then take one free spot with their saved quality',()=>{
  const g=createGame(), guard=soldier(g,'high')
  const identity={...DETACHMENTS.pair.members[0],source:'card',grade:4,pattern:'pair'}
  const a=addUnit(g,'healer','ally',1,{identity,reserve:true}), b=addUnit(g,'healer','ally',1,{identity,reserve:true})
  assert.ok(workshopPairs(g).ascend.some(p=>p.leader===a && p.donor===b))
  assert.ok(forgeUnit(g,a.id,b.id,'ascend'))
  assert.deepEqual(g.allies.map(u=>u.id),[guard.id])
  const copy=saved(g);assert.deepEqual(copy.reserves.map(u=>[u.id,u.grade]),[[a.id,5]])
  assert.ok(fieldReserve(copy,a.id));assert.ok(saved(copy))
})

test('each recruit profession survives as a full inherited ability through fusion and saving',()=>{
  const learned=new Set()
  for(const [pattern,profession] of Object.entries(DETACHMENTS)) {
    const g=createGame(),hero=soldier(g,pattern==='high'?'straight':'high'),donor=soldier(g,pattern)
    assert.ok(drill(g,donor.id,hero.id));assert.deepEqual(hero.lessons,[profession.job])
    assert.ok(hero.fusionJobs.includes(profession.job));learned.add(profession.job)
    assert.deepEqual(saved(g).allies[0].fusionJobs,hero.fusionJobs)
  }
  assert.equal(learned.size,12)
})
