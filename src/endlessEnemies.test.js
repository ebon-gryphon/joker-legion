import test from 'node:test'
import assert from 'node:assert/strict'
import * as E from './engine.js'
import {damageUnit,settleDeaths} from './combatHealth.js'
import {unitStep} from './combatActions.js'
import {advanceRite,protector,quarry} from './enemyBehavior.js'
import {endWave} from './campaign.js'
import {initializeCombatStats} from './combatStats.js'
import {makeSchedule,spawnEnemies} from './waveSchedule.js'
import {endlessScale,waveInfo,ENDLESS} from './endless.js'
import {MAX_ENEMIES} from './campaignRules.js'
import {HOSTILE} from './tactics.js'
import {loadExpedition,saveExpedition,storageKey} from './expeditionStorage.js'
import {dailyRecordKey,validDailyRecord,betterDailyRun} from './daily.js'
const game=(mode='standard',wave=1)=>{
  const g=E.createGame({seed:4,mode});g.wave=wave;makeSchedule(g);initializeCombatStats(g);return g
}
const enemy=(g,type,x=500)=>Object.assign(E.addUnit(g,type,'enemy'),{x,y:250})
const ally=(g,type,x=500)=>Object.assign(E.addUnit(g,type,'ally'),{x,y:250})
const rows=(g,kind)=>g.combatLedger.enemyEvents.filter(e=>e.kind===kind)

test('护旗120边界、去重、自身与首领排除、死亡即移除',()=>{
  const g=game(),flag=enemy(g,'banner'),t=enemy(g,'brute',620),boss=enemy(g,'boss')
  assert.equal(protector(g,flag),null);assert.equal(protector(g,boss),null)
  assert.equal(damageUnit(g,t,20),15);assert.equal(rows(g,'guard').at(-1).amount,5)
  t.x+=.01;assert.equal(damageUnit(g,t,20),20);t.x-=.01
  const second=enemy(g,'banner');assert.equal(damageUnit(g,t,20),15)
  flag.hp=0;assert.equal(protector(g,t),second);second.hp=0;assert.equal(protector(g,t),null)
})
test('猎巫刺客按职业选目标并记录实际增伤，过量伤害不冒领',()=>{
  const g=game(),h=enemy(g,'hunter')
  const units=['knight','mage','ranger','healer'].map(type=>ally(g,type))
  for(const u of units.toReversed()){
    assert.equal(quarry(g.allies,h),u)
    h.cooldown=1;unitStep(g,h,0);assert.equal(rows(g,'hunt').at(-1).target,u.id)
    assert.equal(damageUnit(g,u,20,0,h),u.type==='knight'?20:25)
    if(u.type!=='knight'){assert.equal(rows(g,'bonus').at(-1).amount,5);u.hp=1;damageUnit(g,u,20,0,h);assert.equal(rows(g,'bonus').at(-1).amount,0)}
    u.hp=0
  }
  assert.equal(rows(g,'bonus').length,6)
})
for(const room of [1,2])test('真实击杀产生 '+room+' 只可再次交战的子代并遵守容量',()=>{
  const g=game(),mother=enemy(g,'splitter')
  if(room===1)while(g.enemies.length<MAX_ENEMIES)enemy(g,'raider')
  damageUnit(g,mother,mother.hp);settleDeaths(g)
  const children=g.enemies.filter(e=>e.parentId===mother.id)
  assert.equal(children.length,room);assert.deepEqual(rows(g,'split')[0].children,children.map(e=>e.id))
  for(const child of children){
    assert.equal(child.maxHp,Math.round(mother.maxHp*.35));assert.equal(child.atk,Math.round(mother.atk*.35))
    damageUnit(g,child,child.hp);settleDeaths(g)
  }
  assert.equal(rows(g,'split').length,1);assert.equal(rows(g,'kill').length,1+room)
})
test('母体与幼兽各自记录命中、护盾吸收和击倒的来源',()=>{
  const g=game(),u=ally(g,'knight'),mother=enemy(g,'splitter')
  u.shield=10;damageUnit(g,u,20,0,mother);damageUnit(g,mother,mother.hp);settleDeaths(g)
  const child=g.enemies[0];damageUnit(g,u,u.hp,0,child)
  const [first,second]=rows(g,'strike')
  assert.equal(first.actor,mother.id);assert.equal(first.amount,10);assert.equal(first.absorbed,10)
  assert.equal(second.actor,child.id);assert.equal(second.parent,mother.id);assert.ok(second.killed)
})
test('系统移除与超时不触发分裂',()=>{
  const g=game();enemy(g,'splitter').hp=0;settleDeaths(g);assert.equal(rows(g,'split').length,0)
  const t=game();ally(t,'knight');E.beginBattle(t);t.enemies=[];enemy(t,'splitter');t.waveTime=waveInfo(t).duration-.01
  E.tick(t,.1);assert.equal(t.baseHp,11);assert.equal(rows(t,'split').length,0)
})
for(const type of ['banner','hunter','splitter','brood','cantor'])test(type+' 实际越线扣一生命',()=>{
  const g=game(),u=enemy(g,type,56);unitStep(g,u,.01);settleDeaths(g);assert.equal(g.baseHp,11)
  assert.equal(g.lifeEvents.at(-1).source,'breach');assert.equal(g.lifeEvents.at(-1).amount,1);assert.equal(rows(g,'split').length,0)
})
test('祭司蓄力后选择两个最低血量比例的伤员并截断溢出，不治疗自己',()=>{
  const g=game(),c=enemy(g,'cantor');c.hp=1
  const friends=[.99,.97,.12].map(frac=>{const u=enemy(g,'brute');u.hp=u.maxHp*frac;return u})
  advanceRite(g,c,4.49);assert.equal(rows(g,'windup').length,0)
  advanceRite(g,c,.011);assert.ok(c.chanting);assert.equal(rows(g,'heal').length,0)
  advanceRite(g,c,1.5);assert.deepEqual(rows(g,'heal').map(e=>e.target),[friends[2].id,friends[1].id])
  assert.equal(friends[1].hp,friends[1].maxHp);assert.equal(rows(g,'heal')[0].amount,friends[2].maxHp*.08);assert.equal(c.hp,1)
})
test('祭司无伤员零收益，蓄力被击杀不产生治疗',()=>{
  const g=game(),c=enemy(g,'cantor');advanceRite(g,c,4.5);advanceRite(g,c,1.5)
  assert.equal(rows(g,'heal').length,0);assert.equal(rows(g,'no-target')[0].amount,0)
  advanceRite(g,c,3);damageUnit(g,c,c.hp);settleDeaths(g);unitStep(g,c,2)
  assert.equal(rows(g,'interrupt').length,1);assert.equal(rows(g,'heal').length,0)
})
test('标准与无尽前十二波同队列，新敌军按波替换既有名额',()=>{
  for(let wave=1;wave<=12;wave++){
    const types=E.waveSchedule(4,wave).map(e=>e.type)
    assert.deepEqual(E.waveSchedule(4,wave),E.waveSchedule(4,wave,'standard','endless'))
    assert.equal(types.length,[9,11,11,10,13,9,14,15,17,19,20,16][wave-1])
    for(const [type,at] of [['banner',4],['hunter',7],['cantor',9],['splitter',5]])assert.equal(types.includes(type),wave>=at)
  }
})
test('种子支配分批组合，十八和二十四波使用交替首领技能',()=>{
  const plan=(seed,w)=>E.waveSchedule(seed,w,'standard','endless')
  assert.deepEqual(plan(4,19),plan(4,19));assert.notDeepEqual(plan(4,19),plan(15,19))
  assert.equal(plan(4,18)[0].type,'boss');assert.equal(plan(4,24)[0].type,'finalBoss')
  for(let wave=13;wave<90;wave++){
    const g=game('endless',wave);spawnEnemies(g);assert.equal(g.enemies.length,ENDLESS.batchSize)
    g.waveTime=70;spawnEnemies(g);assert.ok(g.enemies.length<=MAX_ENEMIES)
    assert.ok(new Set(g.schedule.map(e=>e.type)).size>=3)
  }
})
test('无尽使用冻结的十二波基线与指数曲线，不加快行动',()=>{
  for(const wave of [13,18,24,49]){
    const g=game('endless',wave),u=enemy(g,'cantor')
    const scale=(1+.22*11)*1.07**(wave-12)
    assert.equal(u.maxHp,Math.round(HOSTILE.cantor.hp*scale));assert.equal(u.atk,Math.round(HOSTILE.cantor.atk*scale))
    assert.equal(u.period,HOSTILE.cantor.period);assert.equal(endlessScale(g),1.07**(wave-12))
  }
})
test('标准终幕直达胜利，无尽终幕上架三项，第十五波额外水晶独立',()=>{
  for(const [mode,wave,payout] of [['standard',12,0],['endless',12,5],['endless',15,10]]){
    const g=game(mode,wave);ally(g,'knight');E.beginBattle(g);g.enemies=[];g.spawnIndex=g.schedule.length
    const before=g.crystals;endWave(g)
    assert.equal(g.crystals-before,payout);assert.equal(g.rewards.length,payout?3:0)
    assert.equal(g.phase,payout?'shop':'won')
    if(payout){assert.ok(E.chooseReward(g,g.rewards[0].id));assert.ok(E.nextWave(g));assert.equal(g.wave,wave+1)}
  }
})
function endlessCamp(wave) {
  const g=game('endless');ally(g,'knight')
  while(g.wave<wave) {
    E.beginBattle(g);g.enemies=[];g.spawnIndex=g.schedule.length;endWave(g)
    E.chooseReward(g,g.rewards[0].id);assert.ok(E.nextWave(g))
  }
  return g
}
test('无尽后期读档保留队列、祭司蓄力、实际战报与 RNG',()=>{
  const g=endlessCamp(19);E.beginBattle(g)
  const caster=enemy(g,'cantor');advanceRite(g,caster,4.5);const save=E.snapshotGame(g),copy=E.restoreGame(save)
  assert.ok(copy);assert.deepEqual(copy.schedule,g.schedule);assert.equal(copy.enemies.at(-1).riteTimer,1.5)
  E.tick(g,.4);E.tick(copy,.4);assert.equal(copy.rng,g.rng);assert.deepEqual(copy.enemies,g.enemies)
  save.combatLedger.enemyEvents[0].kind='bogus';assert.equal(E.restoreGame(save).combatLedger.partial,true)
})
test('两个槽位独立，旧档与旧每日成绩属于标准远征',()=>{
  const kv=new Map(),store={getItem:k=>kv.get(k),setItem:(k,v)=>kv.set(k,v)}
  const standard=E.snapshotGame(game());delete standard.mode;delete standard.combatLedger.mode
  store.setItem(storageKey,JSON.stringify(standard));saveExpedition(store,endlessCamp(24))
  assert.equal(loadExpedition(store).mode,'standard');assert.equal(loadExpedition(store,'endless').wave,24)
  const old={waves:12,gate:8,kills:100},score={...old,mode:'endless',waves:24,reached:25}
  assert.ok(validDailyRecord(old,'standard'));assert.equal(validDailyRecord(old,'endless'),false);assert.ok(validDailyRecord(score,'endless'))
  assert.equal(validDailyRecord(score,'standard'),false);assert.ok(betterDailyRun(score,{...score,reached:24}))
  const args=['daily-2026-11-25','iron','standard'];assert.notEqual(dailyRecordKey(...args),dailyRecordKey(...args,'endless'))
})
