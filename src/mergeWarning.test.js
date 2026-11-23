import test from 'node:test'
import assert from 'node:assert/strict'
import {createGame,addUnit,forgeUnit,snapshotGame,promotionWarning,drillMaterialWarning} from './engine.js'
import {mergeWarning,mergePreview} from './forge.js'
import {grantExperience} from './training.js'
import {getCardDesign} from './cardCatalog.js'

function materials() {
  const game=createGame({seed:'merge-warning'})
  const leader=addUnit(game,'knight','ally',1,{identity:{suit:'♠',rank:'3',pattern:'high',grade:0}})
  const donor=addUnit(game,'knight','ally',1,{identity:{suit:'♠',rank:'Q',pattern:'high',grade:3}})
  return {game,leader,donor}
}

test('promotion warns about the exact consumed soldier, lost base share and retained main identity and quality without mutating rules or saves',()=>{
  const {game,leader,donor}=materials()
  grantExperience(game,donor,12,false);donor.lessons=['priest']
  const before=snapshotGame(game),preview=mergePreview(game,leader.id,donor.id,'promote')
  const warning=promotionWarning(game,leader.id,donor.id)
  assert.deepEqual(snapshotGame(game),before)
  assert.equal(warning.donor.id,donor.id)
  assert.equal(warning.donor.name,getCardDesign(donor).name)
  assert.equal(warning.leader.name,getCardDesign(leader).name)
  assert.equal(warning.share,.8)
  assert.match(warning.identity,/常备品质.*卓越品质不会转移/)
  assert.match(warning.attributes,/80%.*20%/)
  assert.equal(warning.donor.xp,12)
  assert.ok(warning.donor.skills.some(s=>s.includes('祈愈')))
  assert.equal(warning.requiresConfirmation,true)
  assert.equal(warning.highValue,true)
  assert.ok(forgeUnit(game,leader.id,donor.id,'promote'))
  assert.equal(leader.grade,0);assert.equal(leader.appearanceId,before.allies[0].appearanceId)
  for(const [key,value] of Object.entries(preview)) assert.deepEqual(leader[key],value)
})

test('even an untrained ordinary promotion confirms its 20 percent base-attribute loss, with stable material fingerprints',()=>{
  const {game,leader,donor}=materials();donor.grade=0
  const first=mergeWarning(game,leader.id,donor.id)
  assert.equal(first.requiresConfirmation,true)
  assert.equal(first.highValue,false)
  assert.equal(first.fingerprint,mergeWarning(game,leader.id,donor.id).fingerprint)
  grantExperience(game,donor,1,false)
  assert.notEqual(first.fingerprint,mergeWarning(game,leader.id,donor.id).fingerprint)
  assert.equal(first.donor.xp,0)
})

test('experience caps, learned skills and unavailable or locked materials are described from the current legal preview',()=>{
  const {game,leader,donor}=materials()
  grantExperience(game,leader,990,false);grantExperience(game,donor,40,false)
  const warning=promotionWarning(game,leader.id,donor.id)
  assert.equal(warning.lostXp,31)
  donor.locked=true
  assert.equal(promotionWarning(game,leader.id,donor.id),null)
  donor.locked=false;game.phase='battle'
  assert.equal(promotionWarning(game,leader.id,donor.id),null)
  game.phase='ready'
  assert.equal(promotionWarning(game,leader.id,leader.id),null)
  assert.equal(promotionWarning(game,leader.id,'missing'),null)
})

test('bench training warnings distinguish consuming a soldier for experience from star promotion',()=>{
  const {game,leader,donor}=materials()
  const before=snapshotGame(game),warning=drillMaterialWarning(game,donor.id,leader.id)
  assert.equal(warning.kind,'drill')
  assert.equal(warning.donor.id,donor.id)
  assert.match(warning.attributes,/不合入副兵基础属性/)
  assert.match(warning.identity,/品质不会转移/)
  assert.deepEqual(snapshotGame(game),before)
})
