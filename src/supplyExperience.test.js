import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addUnit, beginBattle, chooseReward, rewardAvailability, snapshotGame, restoreGame } from './engine.js'
import { endWave } from './campaign.js'

function supplies() {
  const game=createGame({seed:'补给体验'})
  addUnit(game,'knight','ally');beginBattle(game);endWave(game)
  return game
}

test('full-health repair explains why it is unavailable and cannot consume the free supply',()=>{
  const game=supplies(),before=snapshotGame(game)
  assert.equal(game.baseHp,game.maxBaseHp)
  assert.deepEqual(rewardAvailability(game,'repair'),{available:false,reason:'城门耐久已满，无需修复。请选择其他补给。'})
  assert.equal(chooseReward(game,'repair'),false)
  assert.deepEqual(snapshotGame(game),before)
  assert.ok(chooseReward(game,'supply'))
})

test('repair restores only missing gate health, is awarded once, and old full-health supply saves stay usable',()=>{
  const game=supplies();game.baseHp-=7
  assert.ok(rewardAvailability(game,'repair').available)
  assert.ok(chooseReward(game,'repair'));assert.equal(game.baseHp,game.maxBaseHp)
  const after=snapshotGame(game);assert.equal(chooseReward(game,'power'),false);assert.deepEqual(snapshotGame(game),after)
  const legacy=supplies(),saved=snapshotGame(legacy)
  delete saved.lastCombatReport;delete saved.combatStats;delete saved.onboarding
  const restored=restoreGame(saved);assert.ok(restored)
  assert.equal(chooseReward(restored,'repair'),false);assert.ok(chooseReward(restored,'power'))
})
