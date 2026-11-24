import test from 'node:test'
import assert from 'node:assert/strict'
import * as E from './engine.js'
import {endWave,regroupArmy} from './campaign.js'
import {applyArmyReward,emptyWaveBonuses} from './rewardModifiers.js'
import {WAVE_REWARDS} from './waveRewards.js'

const oldSnapshot=game=>{
  const s=E.snapshotGame(game)
  for(const key of ['economyVersion','crystals','crystalIncomeWave','lastSettlement','finalWaveCleared','rewardState','waveBonuses','printsBudget'])delete s[key]
  delete s.stats.crystalsEarned
  return s
}
const cleared=(wave=1)=>{
  const g=E.createGame({seed:'reward-integration-'+wave});g.wave=wave
  E.addUnit(g,'knight','ally',2);E.beginBattle(g);endWave(g);return g
}
test('every clear pays configured separate crystals exactly once, including the terminal reward shelf',()=>{
  for(const wave of [1,5,6,10,12]){
    const g=cleared(wave),income=wave%5===0?10:5
    assert.equal(g.crystals,income);assert.equal(g.stats.crystalsEarned,income)
    assert.equal(g.lastSettlement.crystals.total,income);assert.equal(g.lastCombatReport.economy.crystals.total,income)
    assert.equal(g.lastSettlement.crystals.bonus,wave%5===0?5:0)
    assert.equal(g.rewards.length,3);assert.equal(g.phase,'shop');assert.equal(E.nextWave(g),false)
    const saved=E.snapshotGame(g);endWave(g);assert.deepEqual(E.snapshotGame(g),saved)
    assert.ok(E.chooseReward(g,g.rewards[0].id));assert.ok(E.nextWave(g))
    assert.equal(g.wave,wave===12?12:wave+1);assert.equal(g.phase,wave===12?'won':'ready')
  }
})
test('stored random shelves restore unchanged without consuming RNG and claimed rewards cannot replay',()=>{
  const g=cleared(5),before=E.snapshotGame(g),restored=E.restoreGame(before)
  assert.ok(restored);assert.deepEqual(restored.rewards,g.rewards);assert.equal(restored.rng,g.rng)
  assert.ok(E.chooseReward(restored,restored.rewards[0].id))
  const claimed=E.snapshotGame(restored),again=E.restoreGame(claimed)
  assert.ok(again);assert.equal(E.chooseReward(again,again.rewards[0].id),false)
  assert.deepEqual(E.snapshotGame(again),claimed)
  for(const mutate of [s=>s.rewards.pop(),s=>s.rewards[1]=s.rewards[0],s=>s.crystals=-1,s=>s.waveBonuses.next.firstScorePercent=9]){
    const s=structuredClone(before);mutate(s);assert.equal(E.restoreGame(s),null)
  }
})
test('permanent army grants retain health ratio, exclude echoes and never replay on restore, regroup or fusion',()=>{
  const g=E.createGame(),a=E.addUnit(g,'knight','ally',1),b=E.addUnit(g,'knight','ally',1)
  a.hp=a.maxHp/2;const original={atk:a.atk,hp:a.maxHp}
  assert.ok(applyArmyReward(g,{attackPercent:.06,attackCap:1}));assert.ok(applyArmyReward(g,{healthPercent:.08,healthCap:2}))
  assert.equal(a.atk,original.atk+Math.round(original.atk*.06));assert.equal(a.hp/a.maxHp,.5)
  const restored=E.restoreGame(E.snapshotGame(g));assert.ok(restored)
  assert.equal(restored.allies[0].maxHp,a.maxHp);assert.deepEqual(restored.allies[0].rewardModifiers,a.rewardModifiers)
  assert.ok(E.forgeUnit(restored,a.id,b.id,'promote'));assert.deepEqual(restored.allies[0].rewardModifiers,{attackPercent:.06,healthPercent:.08})
  const saved=E.snapshotGame(restored);assert.deepEqual(E.snapshotGame(E.restoreGame(saved)),saved)
  const boosted=restored.allies[0].maxHp;regroupArmy(restored)
  assert.ok(restored.allies[0].maxHp>=boosted);assert.equal(restored.allies[0].rewardModifiers.healthPercent,.08)
  const echo={...restored.allies[0],id:'echo',echoUntil:4};restored.allies.push(echo);const echoAtk=echo.atk
  assert.ok(applyArmyReward(restored,{attackPercent:.06,attackCap:1}));assert.equal(echo.atk,echoAtk)
})
test('queued one-wave hands, discards and printing clear on the following wave while permanent capacity survives',()=>{
  const g=cleared();E.chooseReward(g,g.rewards[0].id)
  g.maxDiscards=4;g.maxEnergy=18
  g.waveBonuses.next={...emptyWaveBonuses(),hands:1,discards:2,prints:2,firstScorePercent:.25}
  assert.ok(E.nextWave(g));assert.equal(g.handsLeft,4);assert.equal(g.discards,6);assert.equal(g.printsLeft,6);assert.equal(E.printingCost(g,1),2)
  assert.deepEqual(g.waveBonuses.next,emptyWaveBonuses());assert.ok(E.restoreGame(E.snapshotGame(g)))
  E.beginBattle(g);endWave(g);E.chooseReward(g,g.rewards[0].id);g.waveBonuses.next=emptyWaveBonuses()
  assert.ok(E.nextWave(g));assert.equal(g.handsLeft,3);assert.equal(g.printsLeft,4);assert.equal(g.maxDiscards,4);assert.equal(g.maxEnergy,18)
  assert.equal(g.waveBonuses.active.firstScorePercent,0)
})
test('first-hand reward shares authoritative preview, settlement and trace and is spent only by a legal deploy',()=>{
  const g=E.createGame();E.selectCard(g,g.hand[0].id)
  const plain=E.previewHand(g);g.waveBonuses.active.firstScorePercent=.25
  const preview=E.previewHand(g);assert.equal(preview.score.total,Math.floor(plain.score.total*1.25))
  assert.equal(preview.scoreTrace.finalBonus.amount,preview.score.total-plain.score.total)
  g.energy=0;assert.equal(E.deploy(g),false);assert.equal(g.waveBonuses.active.firstScorePercent,.25)
  g.energy=g.maxEnergy;assert.ok(E.deploy(g));assert.equal(g.lastDeploy.score,preview.score.total)
  assert.equal(g.waveBonuses.active.firstScorePercent,0);assert.ok(E.restoreGame(E.snapshotGame(g)))
  E.selectCard(g,g.hand[0].id);assert.equal(E.previewHand(g).scoreTrace.finalBonus,undefined)
})
test('legacy ready and claimed/unclaimed shops migrate once with five crystals and preserve identities, items and gold',()=>{
  for(const chosen of [null,false,'supply','enlist']){
    const game=E.createGame({seed:'legacy-economy'});E.addUnit(game,'knight','ally',1)
    const old=oldSnapshot(game)
    if(chosen!==null){old.phase='shop';old.wave=2;old.rewards=['repair','power','supply','enlist'].map(id=>({id}));old.rewardChosen=chosen;old.bonusDiscard=chosen==='supply'?1:0}
    const restored=E.restoreGame(old);assert.ok(restored,chosen)
    assert.equal(restored.crystals,5);assert.equal(restored.gold,old.gold);assert.equal(restored.allies[0].id,old.allies[0].id)
    assert.deepEqual(restored.jokers.map(j=>j.id),old.jokers.map(j=>j.id))
    const twice=E.restoreGame(E.snapshotGame(restored));assert.ok(twice);assert.equal(twice.crystals,5)
    if(chosen){assert.equal(E.chooseReward(restored,chosen),false);assert.ok(E.nextWave(restored));if(chosen==='enlist')assert.ok(restored.allies.some(u=>u.pattern==='twoPair'))}
    else if(chosen===false)assert.equal(restored.rewards.length,3)
  }
})
test('a free unique item also offered by the merchant closes its slot and remains resumable',()=>{
  const g=E.createGame({seed:69});E.addUnit(g,'knight','ally',1);E.beginBattle(g);endWave(g)
  const gift=g.rewards.find(row=>row.id==='item-cache')
  assert.equal(gift.payload.itemId,'royal-command');assert.ok(g.shop.includes(gift.payload.itemId))
  const gold=g.gold,crystals=g.crystals;assert.ok(E.chooseReward(g,gift.id))
  assert.equal(g.gold,gold);assert.equal(g.crystals,crystals);assert.ok(g.soldShop.includes(gift.payload.itemId))
  assert.equal(E.buyJoker(g,gift.payload.itemId),false)
  assert.ok(E.restoreGame(E.snapshotGame(g)))
})
