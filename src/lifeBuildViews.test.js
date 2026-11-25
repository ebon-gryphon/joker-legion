import test from 'node:test'
import assert from 'node:assert/strict'
import {lifeEventRows} from './lifeReportViews.js'
import {buildPassiveRows} from './buildDisplay.js'
import {actualEffectText} from './reportTelemetry.js'

test('new-life display preserves each measured zero escape, healing, max and end event without summing tracing entries twice',()=>{
 const report={wave:2,lifeVersion:1,lifeEvents:[
  {id:'old-wave',wave:1,kind:'loss',source:'breach',before:12,after:11,amount:1,at:1},
  {id:'zero',wave:2,kind:'loss',source:'breach',before:1,after:0,amount:1,at:2},
  {id:'heal',wave:2,kind:'heal',source:'red-echo',before:0,after:1,amount:1,at:3},
  {id:'max',wave:2,kind:'max',source:'life-expansion',before:1,after:1,amount:2,maxBefore:12,maxAfter:14,at:4},
  {id:'again',wave:2,kind:'loss',source:'timeout',before:0,after:0,amount:0,attempted:1,failed:true,at:5},
  {id:'trace',wave:2,kind:'bell-timeout',source:'bellkeeper',before:0,after:0,amount:0,bellSourceId:'real-bell',at:5},
  {id:'end',wave:2,kind:'end',source:'wave-clear',before:0,after:0,amount:0,maxAfter:14,at:6}]}
 const original=JSON.stringify(report),rows=lifeEventRows(report)
 assert.equal(rows.length,6);assert.equal(rows[0].warning,'不能再放入任何敌人')
 assert.match(rows[1].change,/实际恢复 1/);assert.equal(rows[2].change,'上限 12 → 14')
 assert.match(rows[3].change,/0 → 0 · 远征结束/);assert.equal(rows[4].change,'追溯事件，不另计生命')
 assert.equal(rows[5].change,'生命 0 / 14');assert.equal(JSON.stringify(report),original)
})

test('old gate records never become new-life events and old repair amounts remain explicitly old-system',()=>{
 assert.equal(lifeEventRows({wave:1,gate:{start:100,end:90},lifeEvents:[]}),null)
 assert.equal(lifeEventRows(null),null)
 assert.equal(actualEffectText({gateRepaired:3}),'旧制修复 3')
 assert.equal(actualEffectText({lifeHealed:1}),'生命恢复 1')
})

test('build display uses only acquired unique passives and real counters, never guessing missing counts or a second stack',()=>{
 const state={ids:['same-hand','elite-pact','same-hand','unknown'],counts:{'same-hand':3}},original=JSON.stringify(state)
 const rows=buildPassiveRows(state)
 assert.deepEqual(rows.map(row=>row.id),['same-hand','elite-pact'])
 assert.equal(rows[0].name,'连奏');assert.equal(rows[0].count,3);assert.equal(rows[1].count,null)
 assert.deepEqual(buildPassiveRows(undefined),[]);assert.equal(JSON.stringify(state),original)
 assert.equal(actualEffectText({scorePercent:.2,finalScore:120}),'最终分加成 20% · 本手最终分 120')
})

test('actual passive effects preserve temporary order scope and small interval gains without reporting zero',()=>{
 const effects={attackGain:4,healGain:2,healthGain:6,periodReduction:.052,extraHealing:3}
 assert.equal(actualEffectText(effects),'实际攻击增加 4 · 实际治疗力增加 2 · 实际生命上限增加 6 · 实际行动间隔缩短 0.052 秒 · 其中额外有效治疗 3')
 assert.equal(actualEffectText({periodReduction:.002}),'实际行动间隔缩短 0.002 秒')
})

test('life reward and blocked-bell sources use player-visible names without changing the recorded amounts',()=>{
 const rows=lifeEventRows({wave:1,lifeVersion:1,lifeEvents:[{wave:1,kind:'max',source:'reward',sourceId:'gate-masonry',amount:2,maxBefore:12,maxAfter:14},{wave:1,kind:'bell-blocked',source:'bellkeeper',amount:0,reason:'enemy-capacity'}]})
 assert.equal(rows[0].sourceLabel,'生命上限提升');assert.equal(rows[1].reason,'敌军在场数量已达上限，本次未加入援军。')
})
