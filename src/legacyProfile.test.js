import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import * as E from './engine.js'
import {fullLevels,emptyLevels,LEGACY_NODES,initialProfile,payout,settleProfile,purchaseLevel,validProfile,outcomeOf} from './legacyRules.js'
import {applyInheritance,enrollOldRun,energyLimit,supplyFor} from './legacyRun.js'
import {shopActionAvailability,refreshShop,rerollShop} from './fieldShop.js'
import {loadExpedition,saveExpedition} from './expeditionStorage.js'
import {damageUnit} from './combatHealth.js'
import {runBuildStrategy,BUILD_ROUTES} from '../scripts/verify-builds.mjs'

const win={runId:'completed',mode:'standard',phase:'won',difficulty:'standard',wave:12,cleared:12,bosses:2}
for(const [title,changes,expected] of [
  ['标准通关',{},17],
  ['险境通关，倍率先取整再加首次里程碑',{difficulty:'veteran'},23],
  ['先打倒六波首领再漏敌，守波数与首领数分别入账',{phase:'lost',wave:6,cleared:5,bosses:1},3],
  ['普通失败保留进度',{phase:'lost',wave:8,cleared:7,bosses:1},4],
  ['险境失败向下取整',{phase:'lost',wave:10,cleared:9,bosses:1,difficulty:'veteran'},7],
  ['无尽失败，到达十八但未守住',{mode:'endless',phase:'lost',wave:18,cleared:17,bosses:2},12],
  ['无尽十二波归营',{mode:'endless',phase:'retired'},8],
  ['无尽二十四波归营含两个首次里程碑',{mode:'endless',phase:'retired',wave:24,cleared:24,bosses:4},27],
  ['无尽三十波归营含三个首次里程碑',{mode:'endless',phase:'retired',wave:30,cleared:30,bosses:5},38],
  ['第一波归营固定为零',{mode:'endless',phase:'retired',wave:1,cleared:1,bosses:0},0],
])test(title,()=>{
  const result=settleProfile(initialProfile(),{...win,...changes})
  assert.equal(result.receipt.award.total,expected)
  assert.equal(result.profile.lifetimeEarned,expected)
  assert.ok(validProfile(result.profile))
})

test('同局恢复复用原收据，不同局共享首次里程碑与累计收入',()=>{
  const r={...win,mode:'endless',phase:'retired',wave:30,cleared:30,bosses:5}
  const first=settleProfile(initialProfile(),r)
  const duplicate=settleProfile(first.profile,{...r,wave:36,cleared:36,bosses:6})
  assert.equal(duplicate.profile,first.profile);assert.equal(duplicate.receipt,first.receipt)
  const second=settleProfile(first.profile,{...r,runId:'another'})
  assert.equal(second.receipt.award.total,26);assert.deepEqual(second.receipt.award.first,[])
  assert.equal(second.profile.lifetimeEarned,64)
  assert.equal(settleProfile(second.profile,null).profile,second.profile)
})

test('六节点有限价格、旧购买意图、非法节点及余额不足',()=>{
  assert.deepEqual(LEGACY_NODES.map(n=>n.prices),[[3,6,10],[3,6,10],[8],[8],[3,6],[12]])
  let profile=initialProfile()
  for(const id of ['treasury','attack','__proto__'])assert.equal(purchaseLevel(profile,id,0).profile,profile)
  for(let i=0;i<8;i++)profile=settleProfile(profile,{...win,runId:String(i)}).profile
  const earned=profile.lifetimeEarned
  for(const n of LEGACY_NODES){
    for(let lv=0;lv<n.prices.length;lv++){
      const old=profile;profile=purchaseLevel(old,n.id,lv).profile
      assert.equal(profile.balance,old.balance-n.prices[lv])
      assert.equal(purchaseLevel(profile,n.id,lv).profile,profile)
    }
    assert.equal(purchaseLevel(profile,n.id,n.prices.length).profile,profile)
  }
  assert.deepEqual(profile.levels,fullLevels());assert.equal(profile.balance,earned-75)
  assert.ok(validProfile(profile))
})

test('空档创建、损坏或不支持的档案拒绝，旧成绩不追发',()=>{
  const p=initialProfile();assert.ok(validProfile(p))
  for(const bad of [null,{}, {...p,profileVersion:2},{...p,balance:1},{...p,levels:{...p.levels,treasury:4}},
    {...p,lifetimeEarned:1},{...p,milestones:['first-win']},{...p,settledRuns:[{...win,award:{total:999}}]}])assert.ok(!validProfile(bad))
  const old=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false}).finalSnapshot
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
  saveExpedition(storage,old)
  assert.equal(loadExpedition(storage,'standard',{includeResult:true}),null)
  const legacy=E.restoreGame(old);enrollOldRun(legacy)
  assert.equal(outcomeOf(legacy),null);assert.equal(p.balance,0)
  const a=E.createGame({seed:3}),b=E.restoreGame(E.snapshotGame(a))
  enrollOldRun(a);enrollOldRun(b);assert.equal(a.runId,b.runId)
  assert.deepEqual(a.inheritance.levels,emptyLevels());assert.equal(a.gold,8)
})

test('真实新局有独立身份，满级只应用一次，读档不消费当前档案',()=>{
  const options={seed:4},oldRun=E.createPlayerRun(options,emptyLevels()),before=E.snapshotGame(oldRun)
  const first=settleProfile(initialProfile(),win).profile
  const upgraded=purchaseLevel(first,'treasury',0).profile
  const richer=E.createPlayerRun(options,upgraded.levels)
  assert.notEqual(richer.runId,oldRun.runId);assert.equal(richer.gold,11)
  assert.deepEqual(E.snapshotGame(oldRun),before)
  const g=E.createPlayerRun(options,fullLevels()),s=E.snapshotGame(g)
  assert.deepEqual([g.gold,g.crystals,g.discards,g.energy,g.maxEnergy,g.maxBaseHp],[17,6,4,18,16,12])
  assert.equal(g.jokers.length,2);assert.ok(g.jokers.some(j=>j.id===supplyFor('4')))
  assert.deepEqual(E.snapshotGame(E.restoreGame(s)),s)
  assert.throws(()=>applyInheritance(g,g.runId,fullLevels()))
  assert.equal(E.restoreGame({...s,inheritance:{...s.inheritance,itemId:'royal-command'}}),null)
  assert.equal(E.restoreGame({...s,inheritance:{...s.inheritance,bossWaves:[6]}}),null)
  assert.ok(!('balance' in s) && !('settledRuns' in s) && !('lifetimeEarned' in s))
  assert.equal(E.createPlayerRun({difficulty:'veteran'},fullLevels()).maxBaseHp,8)
})

test('行军补给派生随机流不推动牌库、货架或敌军的随机流',()=>{
  const items=new Set()
  for(let seed=1;seed<=20;seed++){
    const bare=E.createPlayerRun({seed}),gift=E.createPlayerRun({seed},{...emptyLevels(),supplies:1})
    items.add(gift.inheritance.itemId)
    assert.deepEqual(gift.hand,bare.hand);assert.deepEqual(gift.deck,bare.deck)
    for(const g of [bare,gift]){
      E.selectCard(g,g.hand[0].id);assert.ok(E.discard(g))
      refreshShop(g);E.addUnit(g,'knight','ally');E.beginBattle(g);E.tick(g,1)
    }
    assert.deepEqual(gift.hand,bare.hand);assert.deepEqual(gift.deck,bare.deck)
    assert.deepEqual(gift.shop,bare.shop);assert.deepEqual(gift.enemies,bare.enemies)
    assert.equal(gift.rng,bare.rng);assert.deepEqual(gift.allies,bare.allies)
    for(const g of [bare,gift])while(g.phase==='battle')E.tick(g,.25)
    assert.equal(gift.phase,bare.phase);assert.equal(gift.waveTime,bare.waveTime);assert.equal(gift.baseHp,bare.baseHp)
    assert.deepEqual(gift.shop,bare.shop);assert.deepEqual(gift.stats,bare.stats);assert.equal(gift.rng,bare.rng)
  }
  assert.equal(items.size,3)
})

test('契约只免首次主动刷新，跨波读档不重置，首波军令和换牌按期结束',()=>{
  let g=E.createPlayerRun({seed:4},fullLevels())
  E.addUnit(g,'knight','ally');E.beginBattle(g)
  while(g.phase==='battle')E.tick(g,.25)
  assert.equal(g.phase,'shop');assert.ok(!rerollShop(g));assert.equal(g.inheritance.refreshUsed,false)
  assert.ok(E.chooseReward(g,g.rewards.find(r=>!['energy-reservoir','discard-training','supply','next-discards','free-item'].includes(r.id)).id))
  let balance=g.crystals,gold=g.gold
  assert.equal(shopActionAvailability(g,'reroll').price,0);assert.ok(rerollShop(g))
  assert.equal(g.crystals,balance);assert.equal(g.gold,gold)
  g=E.restoreGame(E.snapshotGame(g));assert.ok(g.inheritance.refreshUsed)
  assert.ok(rerollShop(g));assert.equal(g.crystals,balance-2);assert.equal(g.gold,gold)
  E.nextWave(g);assert.equal(g.wave,2);assert.equal(g.energy,16);assert.equal(energyLimit(g),16)
  assert.equal(g.discards,3);assert.ok(g.inheritance.refreshUsed)
})

test('首领奖来自真实致命伤，非致命、重复攻击和超时不登记',()=>{
  const g=E.createPlayerRun({seed:1});g.wave=6
  const boss=E.addUnit(g,'boss','enemy')
  damageUnit(g,boss,1);assert.deepEqual(g.inheritance.bossWaves,[])
  damageUnit(g,boss,boss.maxHp+1);damageUnit(g,boss,9)
  assert.deepEqual(g.inheritance.bossWaves,[6])
  g.phase='lost';g.stats.wavesCleared=5
  assert.equal(payout(outcomeOf(g),[]).bosses,2)
})

test('无升级与 d0102c4 的九条路线逐波快照和最终 RNG 一致',()=>{
  const reference=JSON.parse(readFileSync(new URL('../docs/balance/legacy-baseline.json',import.meta.url),'utf8'))
  for(const row of reference){
    const base=BUILD_ROUTES[row.seed===4?0:[3,8].includes(row.seed)?2:1]
    // Keep the historical combat-report ID so the byte comparison includes every report field.
    const id=JSON.stringify([String(row.seed),base.doctrine,row.difficulty,...(row.mode==='endless'?['endless']:[])])
    const hash=createHash('sha256')
    const route=runBuildStrategy({...base,...row,runId:id,legacyLevels:emptyLevels(),stopWave:60},{fixtures:false,onBattleEnd:g=>{
      const snapshot=E.snapshotGame(g);delete snapshot.runId;delete snapshot.inheritance
      hash.update(JSON.stringify(snapshot))
    }})
    assert.equal(route.result.phase,row.phase);assert.equal(route.result.wave,row.wave)
    assert.equal(route.finalSnapshot.rng,row.rng);assert.equal(hash.digest('hex'),row.sha,'seed '+row.seed)
  }
})

