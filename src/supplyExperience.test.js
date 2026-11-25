import {claimTestReward, setTestRewardShelf, claimAvailableReward} from './rewardFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addUnit, beginBattle, chooseReward, rewardAvailability, snapshotGame, restoreGame } from './engine.js'
import { endWave } from './campaign.js'

function supplies() {
  const game=createGame({seed:'补给体验'})
  addUnit(game,'knight','ally');beginBattle(game);endWave(game)
  setTestRewardShelf(game,['repair','power','supply'])
  return game
}

test('full-health repair explains why it is unavailable and cannot consume the free supply',()=>{
  const game=supplies(),before=snapshotGame(game)
  assert.equal(game.baseHp,game.maxBaseHp)
  assert.equal(rewardAvailability(game,'repair').available,false)
  assert.match(rewardAvailability(game,'repair').reason,/生命.*满/)
  assert.equal(chooseReward(game,'repair'),false)
  assert.deepEqual(snapshotGame(game),before)
  assert.ok(claimTestReward(game,'supply'))
})

test('recovery restores only missing player life, is awarded once, and full-life supply saves stay usable',()=>{
  const game=supplies();game.baseHp-=1
  assert.ok(rewardAvailability(game,'repair').available)
  assert.ok(claimTestReward(game,'repair'));assert.equal(game.baseHp,game.maxBaseHp)
  const after=snapshotGame(game);assert.equal(chooseReward(game,'power'),false);assert.deepEqual(snapshotGame(game),after)
  const legacy=supplies(),saved=snapshotGame(legacy)
  delete saved.lastCombatReport;delete saved.combatStats;delete saved.onboarding
  const restored=restoreGame(saved);assert.ok(restored)
  assert.equal(chooseReward(restored,'repair'),false);assert.ok(claimTestReward(restored,'power'))
})
