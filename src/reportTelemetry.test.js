import test from 'node:test'
import assert from 'node:assert/strict'
import {itemEventGroups,actualEffectText,gateSourceRows,runOutcomeText} from './reportTelemetry.js'

test('wave report groups only measured item events, preserving zero-benefit reasons and exact non-score outcomes',()=>{
  const combat={itemEvents:[
    {index:0,id:'red-echo',triggered:true,effective:false,reason:'全员满血。',effects:{healed:0,gateRepaired:0}},
    {index:1,id:'red-echo',triggered:true,effective:true,reason:'实际恢复。',effects:{healed:12.5,gateRepaired:3}},
    {index:2,id:'heart-engine',triggered:true,effective:true,reason:'实伤。',effects:{damage:22,shieldDamage:4,targets:2}},
    {index:3,id:'heart-engine',triggered:false,effective:false,reason:'未满70。',effects:{damage:0,targets:0}},
    {index:4,id:'third-act',triggered:true,effective:true,reason:'满编转训。',effects:{xpGain:2,starGain:0}},
    {index:5,id:'score-chalk',quantity:0,triggered:false,effective:false,reason:'未持有。',effects:{chips:0}},
  ]}
  const saved=structuredClone(combat),groups=itemEventGroups(combat)
  assert.deepEqual([groups[0].triggers,groups[0].effective],[2,1])
  assert.equal(groups[0].events[0].reason,'全员满血。')
  assert.equal(groups.length,3)
  assert.ok(!groups.some(group=>group.id==='score-chalk'))
  assert.deepEqual(groups[1].effects,{damage:22,shieldDamage:4})
  assert.match(actualEffectText(groups[2].effects),/额外经验 2/)
  assert.equal(actualEffectText({healed:0}),'实际收益 0')
  assert.deepEqual(combat,saved)
})

test('old history never borrows current item events, gate causes or expedition outcome',()=>{
  const old={gate:{damage:20,repaired:5}}
  assert.deepEqual(itemEventGroups(old),[])
  assert.equal(gateSourceRows(old),null)
  assert.equal(runOutcomeText(old),null)
})

test('report displays gross gate causes separately from repairs and identifies the actual final wave',()=>{
  const combat={gate:{damage:25,repaired:7,sources:{bell:11,breach:6,timeout:8,unknown:0}},
    runOutcome:{status:'defeat',wave:8,finalWave:8,clearedWaves:7}}
  assert.deepEqual(gateSourceRows(combat).map(row=>row.amount),[11,6,8])
  assert.equal(runOutcomeText(combat),'第 8 波失守，已守住 7 波。')
  combat.runOutcome={status:'victory',wave:12,finalWave:12,clearedWaves:12}
  assert.match(runOutcomeText(combat),/第 12 波完成远征/)
})
