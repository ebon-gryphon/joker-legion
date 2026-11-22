import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addUnit, forgeUnit, beginBattle, snapshotGame, restoreGame } from './engine.js'
import { unitStep } from './combatActions.js'
import { DETACHMENTS } from './recruitment.js'

function soldier(g,pattern) {
  const face=DETACHMENTS[pattern].members[0]
  return addUnit(g,face.type,'ally',1,{identity:{...face,pattern}})
}
function inheritedBattle(pattern) {
  const g=createGame(), hero=soldier(g,pattern==='high'?'pair':'high'), donor=soldier(g,pattern)
  g.gold=50;assert.ok(forgeUnit(g,hero.id,donor.id,'profession'))
  const friend=soldier(g,'pair')
  g.schedule=['brute','brute','warlock'].map(type=>({at:0,type}));assert.ok(beginBattle(g))
  Object.assign(hero,{x:300,y:240,atk:100,heal:80,hp:500,maxHp:800,cooldown:0,attacks:2,shield:0,lessons:[]})
  Object.assign(friend,{x:295,y:235,hp:10,maxHp:1000,cooldown:100})
  for(let i=0;i<g.enemies.length;i++) Object.assign(g.enemies[i],{x:330+i*20,y:240,hp:10000,maxHp:10000,cooldown:100,speed:0})
  const control=restoreGame(snapshotGame(g));assert.ok(control)
  delete control.allies[0].fusionJobs
  return {g,hero,friend,control,plain:control.allies[0]}
}

test('all twelve inherited professions execute their actual attack, healing, targeting or defense ability',()=>{
  for(const pattern of Object.keys(DETACHMENTS)) {
    const {g,hero,friend,control,plain}=inheritedBattle(pattern)
    if(['three','straight','four'].includes(pattern)) hero.attacks=plain.attacks=0
    if(pattern==='flushFive') g.enemies[0].hp=control.enemies[0].hp=4000
    if(pattern==='four') g.enemies[2].x=control.enemies[2].x=340
    unitStep(g,hero,1/30);unitStep(control,plain,1/30)
    const enemies=g.enemies, ordinary=control.enemies
    if(pattern==='high') {
      assert.ok(enemies[0].hp<ordinary[0].hp)
      assert.ok(enemies[1].hp<ordinary[1].hp)
      assert.ok(friend.hp>10)
    }
    if(pattern==='pair') assert.ok(friend.hp>control.allies[1].hp)
    if(pattern==='twoPair' || pattern==='flush') assert.ok(enemies[1].hp<ordinary[1].hp)
    if(pattern==='three') {assert.ok(hero.range>=275);assert.ok(enemies[0].hp<ordinary[0].hp)}
    if(pattern==='straight') assert.ok(enemies[0].hp<ordinary[0].hp)
    if(pattern==='fullHouse') assert.ok(hero.shield>plain.shield)
    if(pattern==='four') {assert.ok(enemies[0].hp>ordinary[0].hp);assert.ok(enemies[2].hp<ordinary[2].hp)}
    if(pattern==='straightFlush' || pattern==='five' || pattern==='flushFive') assert.ok(enemies[0].hp<ordinary[0].hp)
    if(pattern==='flushHouse') {assert.ok(friend.hp>10);assert.ok(friend.shield>control.allies[1].shield)}
  }
})

test('a healing main soldier uses its inherited weapon on the same turn without losing healing or double-counting damage',()=>{
  const {g,hero,friend}=inheritedBattle('high')
  unitStep(g,hero,1/30)
  assert.ok(friend.hp>10)
  assert.ok(g.stats.damage>0)
  assert.equal(g.waveReport.healer.damage,g.stats.damage)
  assert.equal(hero.attacks,3)
})

test('several inherited legacy fusion skills share three actions and each release once',()=>{
  const {g,hero}=inheritedBattle('twoPair')
  hero.fusion='warden';hero.fusionSkills=['warden','paladin'];hero.skillCharge=1;hero.level=3
  unitStep(g,hero,1/30)
  assert.equal(hero.skillCharge,2);assert.deepEqual(g.fusionUses,{})
  hero.cooldown=0
  unitStep(g,hero,1/30)
  assert.equal(hero.skillCharge,0)
  assert.deepEqual(g.fusionUses,{warden:1,paladin:1})
  assert.ok(g.allies.some(u=>u.shield===20+hero.heal))
})
