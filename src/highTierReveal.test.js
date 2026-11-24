import test from 'node:test'
import assert from 'node:assert/strict'
import {highTierRevealView} from './presentationViews.js'
import {getSpriteFrame} from './spriteAtlas.js'
import {createGame,addUnit,forgeUnit,snapshotGame} from './engine.js'
import {deriveAscendFacts} from './presentationFacts.js'

function actualReceipt(grade=5,status='fielded') {
  const actualUnit={id:'earned-leader',type:'knight',side:'ally',appearanceId:'spades-3',suit:'♠',rank:'3',jobId:'pike',
    fusionJobs:['pike','priest','shield'],grade,level:2,atk:87,heal:31,shield:85,period:.638,maxHp:710,hp:700,range:85,speed:63}
  return {recruitment:{kind:'ascend',status,unitId:actualUnit.id,name:'旧显示名',profession:'枪兵',grade,gradeBefore:grade-1,
    actualUnit,before:{atk:29,heal:15,shield:0,period:1.16,maxHp:400},after:{atk:87,heal:31,shield:85,period:.638,maxHp:710}}}
}

test('high-tier reveal derives the actual model, canonical identity and recorded main/inherited professions without mutations',()=>{
  for(const grade of [5,6]) {
    const facts=actualReceipt(grade),saved=JSON.stringify(facts),view=highTierRevealView(facts)
    assert.equal(view.actualUnit,facts.recruitment.actualUnit)
    assert.equal(view.name,'闭盔刀卫');assert.equal(view.primary,'枪兵')
    assert.deepEqual(view.inherited.map(row=>row.name),['随军牧师','盾卫'])
    assert.equal(view.quality,grade===5?'神话':'棱彩')
    assert.deepEqual(getSpriteFrame(view.actualUnit),getSpriteFrame(facts.recruitment.actualUnit))
    assert.equal(JSON.stringify(facts),saved)
  }
})

test('high-tier key changes are limited to three actual observations and the expansion retains all recorded attributes',()=>{
  const facts=actualReceipt(),view=highTierRevealView(facts)
  assert.equal(view.keyChanges.length,3)
  assert.deepEqual(view.keyChanges.map(row=>row.stat),['atk','heal','maxHp'])
  assert.equal(view.rows.find(row=>row.stat==='shield').deltaText,'＋85')
  assert.equal(view.rows.find(row=>row.stat==='period').deltaText,'−0.522秒')
  assert.equal(view.rows.find(row=>row.stat==='hp').before,null)
  assert.equal(view.rows.find(row=>row.stat==='hp').delta,null)
  assert.ok(view.rows.some(row=>row.stat==='range') && view.rows.some(row=>row.stat==='speed'))
  const fresh=actualReceipt();delete fresh.recruitment.before
  const current=highTierRevealView(fresh)
  assert.ok(current.keyChanges.every(row=>row.before===null && row.delta===null && row.deltaText===''))
})

test('concealed high-tier reveal has no model, name, grade, jobs or stat payload; mismatched models are never substituted',()=>{
  const facts=actualReceipt(6)
  for(const options of [{revealed:false},{qualityVisible:false}]) {
    const view=highTierRevealView(facts,options)
    assert.equal(view.revealed,false)
    for(const field of ['actualUnit','name','grade','primary','inherited','rows'])assert.equal(view[field],undefined)
    assert.equal(view.tone,'#b69b78')
  }
  assert.equal(highTierRevealView(facts,{actualUnit:{...facts.recruitment.actualUnit,id:'someone-else'}}).actualUnit,null)
  assert.equal(highTierRevealView(facts,{actualUnit:{...facts.recruitment.actualUnit,grade:4}}).actualUnit,null)
})

test('reserve high-tier facts remain off-field and old receipts stay readable without inventing a model or additional job',()=>{
  const facts=actualReceipt(6,'reserve'),view=highTierRevealView(facts)
  assert.equal(view.status,'reserve');assert.equal(view.destination,'候补席 · 尚未上阵')
  delete facts.recruitment.actualUnit
  const old=highTierRevealView(facts)
  assert.equal(old.actualUnit,null);assert.deepEqual(old.inherited,[])
  assert.equal(old.primary,'枪兵');assert.equal(old.grade,6)
})

test('real quality-fusion snapshots can be read repeatedly without changing the army, save, cheer or clocks',()=>{
  const game=createGame(),leader=addUnit(game,'knight','ally',1,{identity:{suit:'♠',rank:'3',grade:4}}),donor=addUnit(game,'healer','ally',1,{identity:{suit:'♥',rank:'2',grade:4}})
  const before=snapshotGame(game);assert.equal(forgeUnit(game,leader.id,donor.id,'ascend'),true)
  const after=snapshotGame(game),facts=deriveAscendFacts(before,after,leader.id)
  const receipt={...facts,actualUnit:after.allies.find(unit=>unit.id===leader.id)}
  for(let i=0;i<20;i++) {
    const view=highTierRevealView(receipt,{kind:'fusion'})
    assert.equal(view.actualUnit.id,leader.id);assert.equal(view.grade,5);assert.equal(view.keyChanges.length<=3,true)
  }
  assert.deepEqual(snapshotGame(game),after)
})
