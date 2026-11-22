import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, beginBattle, selectCard, previewHand, deploy, tick, snapshotGame, restoreGame, nextWave, chooseReward } from './engine.js'
import { activeWagon, hasConvoy } from './convoy.js'

function camp() {
  const game = createGame({ seed: 3 })
  fixtureCompany(game, 'knight')
  return game
}
function advanceTo(game, seconds) {
  while (game.phase === 'battle' && game.waveTime < seconds) tick(game, .1)
}

test('the best eligible cart pays automatically and exactly once across save and reload', () => {
  for (const [score,time,id,bonus] of [[39,8,null,0],[40,3,'scout',3],[99,3,'scout',3],[100,8,'payroll',7]]) {
    let g=camp()
    g.preparedScore=score
    const purse=g.gold
    selectCard(g,g.hand[0].id)
    assert.ok(beginBattle(g));assert.deepEqual(g.selected,[])
    advanceTo(g,1)
    g=restoreGame(snapshotGame(g))
    if (id==='payroll') {advanceTo(g,6);assert.equal(g.convoyTaken,null)}
    advanceTo(g,time)
    assert.equal(g.convoyTaken,id);assert.equal(g.gold,purse+bonus)
    assert.equal(deploy(g),false)
    g=restoreGame(snapshotGame(g))
    advanceTo(g,12)
    assert.equal(g.gold,purse+bonus)
    advanceTo(g,120)
    assert.equal(g.phase,'shop')
    assert.equal(g.gold,purse+bonus+10)
    assert.ok(chooseReward(g,'supply'));assert.ok(nextWave(g))
    assert.equal(g.convoyTaken,null);assert.equal(g.preparedScore,0)
  }
})

test('low scores still issue normal orders, arrivals use exclusive simulation windows, old waves stay playable', () => {
  const g = camp()
  selectCard(g,g.hand[0].id)
  const score = previewHand(g).score.total
  assert.ok(deploy(g));assert.equal(g.preparedScore,score)
  beginBattle(g)
  for (const [time, expected] of [[1.99,null],[2,'scout'],[6.99,'scout'],[7,'payroll'],[15,null]]) {
    g.waveTime = time
    assert.equal(activeWagon(g)?.id ?? null, expected)
  }
  g.waveTime = 4
  selectCard(g, g.hand[0].id)
  const gold = g.gold
  assert.equal(previewHand(g).canDeploy,false)
  assert.equal(deploy(g),false); assert.equal(g.gold,gold)
  assert.ok(!g.schedule.some(s => s.convoyGuard))
  const old = snapshotGame(camp())
  delete old.convoyTaken
  old.schedule = old.schedule.filter(s => !s.convoyGuard)
  const restored = restoreGame(old)
  assert.ok(restored); assert.equal(hasConvoy(restored), true)
  assert.equal(restoreGame({ ...old, convoyTaken:'fake' }), null)
})
