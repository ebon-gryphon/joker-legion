import test from 'node:test'
import assert from 'node:assert/strict'
import {CARD_CATALOG,getCardDesign} from './cardCatalog.js'
import {JOBS,ROYAL_MARCHES} from './jobs.js'
import {CAMP_AREA,fitFormation} from './formation.js'
import {GRADES,gradeForScore} from './quality.js'
import {workshopPairs} from './forge.js'
import {grantExperience,soldierValue} from './training.js'
import {createGame,addUnit,deploy,previewHand,beginBattle,tick,designateChampion,drillPreview,drill,moveInCamp,restoreGame,snapshotGame,nextWave,forgeUnit,promotionPreview,toggleSoldierLock} from './engine.js'

function soldier(g,face,stars=1) {
  const design=getCardDesign(face)
  return addUnit(g,design.type,'ally',stars,{identity:design})
}
function deal(g,faces) {
  const stock=[...g.hand,...g.deck]
  const pick=faces.map(face=>stock.find(c=>c.suit+c.rank===face))
  assert.ok(pick.every(Boolean))
  const rest=stock.filter(c=>!pick.includes(c))
  g.hand=[...pick,...rest.slice(0,8-pick.length)]
  g.deck=rest.slice(8-pick.length)
  g.selected=pick.map(c=>c.id)
}
test('free camp positions survive reload, combat entry, and invalid drops at every border',()=>{
  const g=createGame(), unit=soldier(g,'♥8')
  const {left,right,top,bottom}=CAMP_AREA
  for (const [x,y] of [[left,top],[left,bottom],[right,top],[right,bottom],[83.5,171.75]]) {
    assert.ok(moveInCamp(g,unit.id,x,y))
    const restored=restoreGame(snapshotGame(g)).allies[0]
    assert.deepEqual([restored.x,restored.y,restored.campSpot],[x,y,{x,y}])
  }
  for (const [x,y] of [[left-.01,210],[right+.01,210],[130,top-.01],[130,bottom+.01],[NaN,210]]) {
    assert.equal(moveInCamp(g,unit.id,x,y),false)
    assert.deepEqual(unit.campSpot,{x:83.5,y:171.75})
  }
  assert.ok(beginBattle(g));tick(g,.04)
  assert.ok(Math.abs(unit.y-171.75)<2)
  assert.ok(restoreGame(snapshotGame(g)))
})
test('the entire friendly deployment area fits beside the hand or above the portrait hand',()=>{
  for (const [w,h,panel] of [[960,594,{left:533,top:255}],[844,390,{left:441,top:95}],[390,844,{left:9,top:510}]]) {
    const view=fitFormation(w,h,panel)
    const x=n=>view.left+n*view.scale, y=n=>view.top+(CAMP_AREA.top+(n-CAMP_AREA.top)*view.depth)*view.scale
    assert.ok(x(CAMP_AREA.left)>=0 && y(CAMP_AREA.top)-75*view.scale>0)
    assert.ok(x(CAMP_AREA.right)<=(panel.left>w*.32?panel.left:w))
    assert.ok(y(CAMP_AREA.bottom)<=(panel.left>w*.32?h:panel.top))
  }
})
test('all printed roles have a playable face and the 52 card identities select their actual profession',()=>{
  assert.equal(Object.keys(JOBS).length,25)
  assert.deepEqual(new Set(CARD_CATALOG.map(c=>c.jobId)),new Set(Object.keys(JOBS)))
  for(const face of CARD_CATALOG) {
    const g=createGame(), unit=soldier(g,face.suit+face.rank)
    assert.equal(unit.jobId,face.jobId)
    assert.equal(getCardDesign(unit).profession,JOBS[unit.jobId])
    assert.ok(unit.atk>0 && unit.period>0 && unit.range>0)
  }
})
test('drag can place a soldier, teach a veteran, transfer the title, or promote without duplicating experience',()=>{
  const g=createGame(); g.gold=20
  const main=soldier(g,'♠5'), donor=soldier(g,'♣8')
  assert.ok(moveInCamp(g,main.id,300,248))
  assert.equal(moveInCamp(g,main.id,700,248),false)
  designateChampion(g,donor.id);grantExperience(g,donor,8)
  assert.equal(drillPreview(g,donor.id,main.id),null)
  assert.ok(toggleSoldierLock(g,donor.id))
  assert.equal(drillPreview(g,donor.id,main.id).kind,'profession')
  assert.ok(drill(g,donor.id,main.id))
  assert.equal(drill(g,donor.id,main.id),false)
  assert.equal(g.champion,null)
  assert.ok(designateChampion(g,main.id))
  assert.deepEqual([main.trainingXp,main.x,main.y,g.champion.slot,g.champion.unitId],[8,300,248,'♠5',main.id])
  const second=soldier(g,'♠2')
  grantExperience(g,second,9)
  const projected=promotionPreview(g,main.id,second.id)
  assert.ok(forgeUnit(g,main.id,second.id,'promote'))
  assert.deepEqual([main.trainingXp,main.level,g.champion.xp,main.atk,main.maxHp],[17,2,17,projected.atk,projected.maxHp])
  const fused=soldier(g,'♦8',2)
  grantExperience(g,fused,3)
  assert.ok(forgeUnit(g,main.id,fused.id,'starblade'))
  assert.equal(main.trainingXp,20)
  assert.equal(main.fusion,'starblade')
  assert.ok(restoreGame(snapshotGame(g)))
  assert.ok(beginBattle(g))
  assert.equal(moveInCamp(g,main.id,260,240),false)
})
test('a champion stays in formation while the next hand recruits independently',()=>{
  const g=createGame(),main=soldier(g,'♠5')
  designateChampion(g,main.id);grantExperience(g,main,16)
  g.phase='shop';g.rewardChosen='power';assert.ok(nextWave(g))
  assert.equal(g.champion.unitId,main.id)
  assert.equal(new Set([...g.hand,...g.deck].map(c=>c.baseFace||c.suit+c.rank)).size,52)
  deal(g,['♠5','♦9','♥9']);assert.ok(deploy(g))
  assert.equal(g.allies.length,2);assert.equal(g.allies[0].trainingXp,16)
  assert.deepEqual(restoreGame(snapshotGame(g)).champion,g.champion)
})
test('designating a champion keeps recruitment open and voluntary training advances its stars',()=>{
  const g=createGame(), lead=soldier(g,'♣8')
  assert.ok(designateChampion(g,lead.id))
  for (let mark=1;mark<=5;mark++) {
    const donor=soldier(g,'♣8')
    const xp=lead.trainingXp+soldierValue(donor)
    assert.ok(drill(g,donor.id,lead.id))
    assert.equal(lead.trainingXp,xp)
    assert.equal(lead.level,mark>=5?3:mark>=2?2:1)
    assert.equal(g.champion.marks,mark)
  }
  g.selected=[g.hand[0].id]
  assert.equal(previewHand(g).actualUnits,1)
  assert.ok(deploy(g));assert.equal(g.allies.length,2)
})

for (const suit of Object.keys(ROYAL_MARCHES)) test(suit+'K scores to activate a distinct royal march once per wave',()=>{
  const g=createGame(), main=soldier(g,'♠3'), escort=soldier(g,'♥3')
  designateChampion(g,main.id);grantExperience(g,main,8);deal(g,[suit+'K'])
  const p=previewHand(g),oldPeriod=escort.period,oldAtk=main.atk
  assert.equal(p.marchSuit,suit);assert.ok(p.combo.some(t=>t.includes(ROYAL_MARCHES[suit].name)))
  assert.ok(deploy(g));assert.ok(g.royalMarch && main.marching);assert.ok(main.atk>=oldAtk*1.5)
  assert.equal(escort.shield,Math.ceil(main.maxHp*(suit==='♠'?.36:.18)))
  assert.equal(!!escort.royalWard,suit==='♥')
  assert.equal(escort.period,oldPeriod*(suit==='♣'?.8:1))
  assert.equal(main.royalStars||0,suit==='♦'?3:0)
  g.selected=[g.hand[0].id];assert.equal(previewHand(g).march,false)
  assert.ok(restoreGame(snapshotGame(g)))
  if(suit==='♥'||suit==='♦') {
    g.schedule=[{at:0,type:'brute'}];beginBattle(g)
    const foe=g.enemies[0]
    Object.assign(foe,{x:308,y:235,hp:5000,maxHp:5000,cooldown:suit==='♥'?0:15,atk:10000})
    Object.assign(main,{x:300,y:235,cooldown:suit==='♥'?10:0})
    Object.assign(escort,{x:120,y:245,cooldown:10})
    tick(g,1/30)
    if(suit==='♥'){assert.equal(main.royalWard,undefined);assert.ok(main.hp>main.maxHp*.29 && main.hp<main.maxHp*.4)}
    else {assert.equal(main.royalStars,2);assert.ok(foe.hp<5000-2*main.atk)}
  }
})
function firstAction(face, types=['brute','brute','brute']) {
  const g=createGame(),u=soldier(g,face)
  g.schedule=types.map(type=>({at:0,type}));beginBattle(g)
  Object.assign(u,{x:345,y:245,cooldown:0})
  for(const [i,e] of g.enemies.entries()) Object.assign(e,{x:355+i*13,y:245,hp:3000,maxHp:3000,speed:0,cooldown:15})
  return {g,u,foes:g.enemies}
}
test('cavalry charges, pikes pierce a lane, swordsmen combo, and assassins pick the rear caster',()=>{
  let {g,u,foes}=firstAction('♠8')
  tick(g,1/30);assert.equal(foes[0].hp,3000-u.atk*3)
  ;({g,u,foes}=firstAction('♠5'))
  foes[2].y=315;tick(g,1/30);assert.ok(foes[1].hp<3000);assert.equal(foes[2].hp,3000)
  ;({g,u,foes}=firstAction('♠9'))
  u.attacks=2;tick(g,1/30);assert.equal(foes[0].hp,3000-u.atk*2)
  ;({g,u,foes}=firstAction('♣8',['brute','warlock']))
  tick(g,1/30);assert.equal(foes[0].hp,3000);assert.equal(foes[1].hp,3000-u.atk*3)
})
test('a current-format fourteen-soldier save retains its grandfathered roster and cannot add bodies',()=>{
  const g=createGame();soldier(g,'♠8')
  while(g.allies.length<14)g.allies.push({...g.allies[0],id:'legacy-'+g.allies.length})
  const snap=snapshotGame(g);delete snap.squadRules
  const loaded=restoreGame(snap);assert.equal(loaded.legacyFieldSize,14)
  loaded.selected=[loaded.hand[0].id];assert.ok(deploy(loaded));assert.equal(loaded.allies.length,14)
  assert.ok(restoreGame(snapshotGame(loaded)))
  loaded.phase='shop';loaded.rewardChosen='power';nextWave(loaded);assert.equal(loaded.legacyFieldSize,14);assert.ok(restoreGame(snapshotGame(loaded)))
})

test('a broad axe hits armored brutes harder and a sabre sweeps a neighbour',()=>{
  const axe=firstAction('♠6')
  tick(axe.g,1/30)
  assert.equal(axe.foes[0].hp,3000-axe.u.atk*1.5)
  const blade=firstAction('♠3')
  tick(blade.g,1/30)
  assert.ok(blade.foes[0].hp<3000 && blade.foes[1].hp<3000)
})

test('all printed professions fuse with different jobs and train with their own, retaining cards and stars',()=>{
  const faces=[...new Map(CARD_CATALOG.map(c=>[c.jobId,c.suit+c.rank])).values()]
  for(const a of faces) for(const b of faces) {
    const g=createGame(),donor=soldier(g,a),receiver=soldier(g,b)
    const same=donor.jobId===receiver.jobId
    assert.equal(drillPreview(g,donor.id,receiver.id).kind,same?'drill':'profession')
    assert.ok(drill(g,donor.id,receiver.id))
    assert.equal(receiver.trainingXp,same?2:0);assert.equal(receiver.level,1);assert.equal(g.handsLeft,3)
    assert.equal(g.allies.length,1);assert.equal(g.allies[0].id,receiver.id)
  }
})
test('locks block all material uses, including stale forge choices, while the receiver and its position remain usable',()=>{
  const g=createGame(),a=soldier(g,'♠5',2),b=soldier(g,'♠2',2),c=soldier(g,'♥5',2);g.gold=20
  assert.ok(workshopPairs(g).promote.some(p=>p.donor===a))
  assert.ok(toggleSoldierLock(g,a.id))
  const before=snapshotGame(g)
  assert.equal(drillPreview(g,a.id,b.id),null);assert.equal(drill(g,a.id,c.id),false)
  assert.equal(forgeUnit(g,b.id,a.id,'promote'),false);assert.equal(forgeUnit(g,c.id,a.id,'paladin'),false)
  assert.ok(Object.values(workshopPairs(g)).flat().every(p=>p.donor.id!==a.id))
  assert.deepEqual(snapshotGame(g),before)
  assert.ok(moveInCamp(g,a.id,250,200));assert.ok(drill(g,b.id,a.id))
  assert.ok(restoreGame(snapshotGame(g)).allies.find(u=>u.id===a.id).locked)
  assert.ok(forgeUnit(g,a.id,c.id,'paladin'));assert.ok(a.locked)
  assert.ok(toggleSoldierLock(g,a.id));const d=soldier(g,'♦9')
  assert.ok(drill(g,a.id,d.id))
})
test('a protected champion remains protected after reload and scoring its signature next wave',()=>{
  const g=createGame(),u=soldier(g,'♠5')
  designateChampion(g,u.id);assert.ok(u.locked)
  const saved=restoreGame(snapshotGame(g))
  saved.phase='shop';saved.rewardChosen='power';nextWave(saved)
  deal(saved,['♠5'])
  assert.ok(deploy(saved));assert.ok(saved.allies[0].locked)
  toggleSoldierLock(saved,saved.allies[0].id);assert.equal(saved.champion.locked,false)
})
test('recruit grade follows final scored chips and mult, including studied hands, escorts and overflow',()=>{
  for(const [i,g] of GRADES.entries()) {
    assert.equal(gradeForScore(g.min),i)
    if(i)assert.equal(gradeForScore(g.min-1),i-1)
  }
  for (const [rank,level,total,grade] of [['2',1,28,0],['8',1,52,1],['8',2,123,1],['8',3,224,2]]) {
    const g=createGame({doctrine:'scarlet'})
    g.handLevels.pair=level;deal(g,['♠'+rank,'♣'+rank])
    const p=previewHand(g);assert.equal(p.score.total,total);assert.equal(p.grade,grade)
    assert.ok(p.recruits.every(u=>u.grade===grade));assert.ok(deploy(g))
    assert.equal(g.lastDeploy.grade,grade)
    for(const u of g.allies)assert.equal(u.grade,grade)
    assert.deepEqual(restoreGame(snapshotGame(g)).allies,g.allies)
  }
  const g=createGame(),plain=soldier(g,'♥3')
  const elite=addUnit(g,'healer','ally',1,{identity:{suit:'♥',rank:'3',grade:4}})
  for(const stat of ['maxHp','atk','heal'])assert.ok(elite[stat]>plain[stat]*1.45)
  while(g.allies.length<5)soldier(g,'♣8')
  deal(g,['♠8','♣8'])
  const p=previewHand(g);assert.equal(p.actualUnits,0)
  assert.ok(p.reserve.every(u=>u.grade===1));assert.ok(deploy(g))
  assert.equal(g.allies.find(u=>u.id===p.trainerId).trainingXp,p.reserve.reduce((total,u)=>total+soldierValue(u),0))
})
test('a cleared battle preserves soldiers and stores closing positions separately through a reload',()=>{
  const g=createGame(),u=soldier(g,'♠5')
  g.schedule=[{at:0,type:'raider'}];beginBattle(g)
  Object.assign(u,{x:470,y:220,atk:2000,cooldown:0})
  Object.assign(g.enemies[0],{x:480,y:220,hp:1,cooldown:2})
  for (let i=0;i<20 && g.phase==='battle';i++) tick(g,.2)
  assert.equal(g.phase,'shop');assert.equal(g.allies.length,1)
  assert.equal(g.lastField[0].appearanceId,'spades-5');assert.equal(g.lastField[0].x,u.x)
  const loaded=restoreGame(snapshotGame(g));assert.deepEqual(loaded.lastField,g.lastField)
  loaded.rewardChosen='power';nextWave(loaded);assert.deepEqual(loaded.lastField,[]);assert.deepEqual(loaded.allies.map(unit=>unit.id),[u.id])
})
