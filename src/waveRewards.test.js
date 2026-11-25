import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from './campaign.js'
import { addUnit } from './campArmy.js'
import { JOKERS } from './campaignRules.js'
import { ORDER_BOOK } from './orders.js'
import {BUILD_PASSIVES,resetBuildWave} from './buildPassives.js'
import {snapshotGame,restoreGame} from './gameSave.js'
import {
  WAVE_REWARDS, WAVE_REWARD_BY_ID, CURRENCY_REWARD_IDS, createRewardOffer,
  createRewardShelf, rewardAvailability, chooseWaveReward, chooseReward, isRewardOffer,
} from './waveRewards.js'

const copy=value=>JSON.parse(JSON.stringify(value))
function game(seed='REWARD-TEST') {
  const g=createGame({seed});g.phase='shop';g.baseHp=5;g.rewardChosen=false;g.rewardState={wave:g.wave,claimedId:null}
  addUnit(g,'knight','ally',1);return g
}
function offerOnly(g,id) {
  const offer=createRewardOffer(g,id);assert.ok(offer,id);g.rewards=[offer];return offer
}

test('the independent pool has 36 complete rewards including twelve unique build rules and the four ordinary IDs',()=>{
  assert.equal(WAVE_REWARDS.length,36)
  assert.equal(new Set(WAVE_REWARDS.map(row=>row.id)).size,36)
  for(const id of ['repair','power','supply','enlist'])assert.ok(WAVE_REWARD_BY_ID[id])
  assert.ok(CURRENCY_REWARD_IDS.length>=3)
  for(const definition of WAVE_REWARDS) {
    assert.ok(definition.id && definition.name && definition.icon && definition.category && definition.condition && definition.description)
    assert.ok(['army','poker','resource'].includes(definition.direction))
    assert.ok(Number.isFinite(definition.weight) && definition.weight>0)
    const offer=createRewardOffer(game(),definition.id)
    assert.ok(isRewardOffer(offer),definition.id)
    assert.deepEqual(JSON.parse(JSON.stringify(offer)),offer)
    assert.equal(/\{\w+\}/.test(offer.description),false)
    assert.ok(offer.duration)
  }
})

test('three weighted draws are deterministic and without replacement across the entire pool, with no category allotment',()=>{
  const a=game('shared seed'),b=copy(a),before=copy(a)
  assert.deepEqual(createRewardShelf(a),createRewardShelf(b));assert.equal(a.rng,b.rng)
  const changed=copy(a);changed.rng=before.rng;assert.deepEqual(changed,before,'constructing a shelf only advances the authoritative RNG')
  const homogeneous=new Set()
  for(let seed=0;seed<1600 && homogeneous.size<3;seed++) {
    const g=game(seed),rows=createRewardShelf(g)
    assert.equal(rows.length,3);assert.equal(new Set(rows.map(row=>row.id)).size,3)
    assert.ok(rows.every(isRewardOffer))
    const directions=new Set(rows.map(row=>row.direction));if(directions.size===1)homogeneous.add(rows[0].direction)
  }
  assert.deepEqual([...homogeneous].sort(),['army','poker','resource'],'each direction may naturally occupy all three slots')
})

test('full gate, reached caps, maxed books and unobtainable items are excluded, leaving at least three distinct currency fallbacks',()=>{
  const g=game();g.finalWaveCleared=true;g.baseHp=g.maxBaseHp=24;g.maxEnergy=30;g.maxDiscards=12;g.upgrades.power=1
  g.buildPassives.ids=BUILD_PASSIVES.map(row=>row.id)
  g.handLevels=Object.fromEntries(Object.keys(ORDER_BOOK).map(key=>[key,3]));g.discoveredHands=Object.keys(ORDER_BOOK)
  g.jokers=JOKERS.map(item=>({...item,quantity:item.stackable?Number.MAX_SAFE_INTEGER:1,triggers:0,flash:0}))
  for(const unit of g.allies){unit.trainingXp=999;unit.rewardModifiers={attackPercent:1,healthPercent:2}}
  for(const id of ['repair','power','discard-training','energy-reservoir','gate-masonry','order-notes','item-cache','army-experience','army-attack','army-health','enlist','supply','extra-hand'])
    assert.equal(createRewardOffer(g,id),null,id)
  for(let seed=0;seed<50;seed++) {
    g.rng=seed;const shelf=createRewardShelf(g)
    assert.equal(shelf.length,3);assert.equal(new Set(shelf.map(row=>row.id)).size,3)
    assert.ok(shelf.every(row=>CURRENCY_REWARD_IDS.includes(row.id)))
  }
})

test('ordinary enlist is eligible at every wave and final-wave filtering follows the general cleared flag',()=>{
  for(let wave=1;wave<=12;wave++) {
    const g=game();g.wave=wave;g.rewardState.wave=wave
    const offer=offerOnly(g,'enlist'),rng=g.rng
    assert.deepEqual(offer.payload,{pattern:'twoPair'})
    assert.equal(chooseReward(g,'enlist'),true);assert.equal(g.rng,rng)
    assert.deepEqual(g.waveBonuses.next.enlistPatterns,['twoPair'])
  }
  const g=game();g.wave=7;g.finalWaveCleared=true
  for(const row of createRewardShelf(g))assert.ok(!['next','enlist','supply'].includes(row.effect.kind))
  assert.equal(createRewardOffer(g,'extra-hand'),null)
  assert.equal(createRewardOffer(g,'supply'),null)
})

test('all twelve build rewards share the shelf, are unique for the run and stay owned after save and wave reset',()=>{
  for(const definition of BUILD_PASSIVES){
    const g=game('unique-build-pool-'+definition.id)
    g.rewards=[createRewardOffer(g,definition.id),createRewardOffer(g,'gold-purse'),createRewardOffer(g,'crystal-purse')]
    assert.ok(chooseWaveReward(g,definition.id));assert.ok(g.buildPassives.ids.includes(definition.id))
    const before=copy(g);assert.equal(chooseWaveReward(g,definition.id),false);assert.deepEqual(g,before)
    const loaded=restoreGame(snapshotGame(g));assert.ok(loaded);assert.deepEqual(loaded.buildPassives,g.buildPassives)
    g.wave++;resetBuildWave(g);g.rewardChosen=false;g.rewardState={wave:g.wave,claimedId:null}
    assert.equal(createRewardOffer(g,definition.id),null)
    assert.ok(createRewardShelf(g).every(row=>!g.buildPassives.ids.includes(row.id)))
  }
})

test('concrete book and item targets survive serialization and claiming uses no RNG or replacement target',()=>{
  for(const id of ['order-notes','item-cache']) {
    const g=game('fixed '+id),offer=offerOnly(g,id),saved=copy(g),rng=g.rng
    assert.equal(chooseWaveReward(g,id),true)
    assert.equal(chooseWaveReward(saved,id),true)
    assert.equal(g.rng,rng);assert.deepEqual(saved,g)
    if(id==='order-notes') {
      assert.equal(g.handLevels[offer.payload.handKey],2)
      for(const [key,level] of Object.entries(g.handLevels))if(key!==offer.payload.handKey)assert.equal(level,1)
    } else assert.ok(g.jokers.some(item=>item.id===offer.payload.itemId))
  }
  const g=game(),offer=offerOnly(g,'order-notes'),rng=g.rng
  g.handLevels[offer.payload.handKey]=3
  assert.equal(chooseWaveReward(g,offer.id),false);assert.equal(g.rng,rng)
  assert.ok(g.handLevels.high===1 || offer.payload.handKey==='high','no substitute book is upgraded')
  const itemGame=game(),item=offerOnly(itemGame,'item-cache')
  if(!JOKERS.find(row=>row.id===item.payload.itemId).stackable) {
    itemGame.jokers.push({...JOKERS.find(row=>row.id===item.payload.itemId),triggers:0,flash:0})
    const before=copy(itemGame);assert.equal(chooseWaveReward(itemGame,item.id),false);assert.deepEqual(itemGame,before)
  }
})

test('the eleven requested base effects and every stronger variant change the intended real state once',()=>{
  const cases={
    repair:g=>assert.equal(g.baseHp,7),power:g=>assert.equal(g.upgrades.power,.08),
    supply:g=>{assert.equal(g.gold,14);assert.equal(g.waveBonuses.next.discards,1)},
    enlist:g=>assert.deepEqual(g.waveBonuses.next.enlistPatterns,['twoPair']),
    'discard-training':g=>assert.equal(g.maxDiscards,4),
    'energy-reservoir':g=>{assert.equal(g.maxEnergy,18);assert.equal(g.energy,18)},
    'extra-hand':g=>assert.equal(g.waveBonuses.next.hands,1),
    'extra-hands-greater':g=>assert.equal(g.waveBonuses.next.hands,2),
    'opening-score':g=>assert.equal(g.waveBonuses.next.firstScorePercent,.25),
    'next-discards':g=>assert.equal(g.waveBonuses.next.discards,2),
    'next-prints':g=>assert.equal(g.waveBonuses.next.prints,2),
    'gate-masonry':g=>{assert.equal(g.maxBaseHp,14);assert.equal(g.baseHp,7)},
    'crystal-purse':g=>{assert.equal(g.crystals,4);assert.equal(g.stats.crystalsEarned,4)},
    'crystal-chest':g=>assert.equal(g.crystals,8),
    'gold-purse':g=>assert.equal(g.gold,11),'gold-chest':g=>assert.equal(g.gold,20),
    'army-experience':g=>assert.equal(g.allies[0].trainingXp,2),
    'army-experience-greater':g=>assert.equal(g.allies[0].trainingXp,4),
    'army-attack':g=>assert.equal(g.allies[0].rewardModifiers.attackPercent,.06),
    'army-attack-greater':g=>assert.equal(g.allies[0].rewardModifiers.attackPercent,.1),
    'army-health':g=>assert.equal(g.allies[0].rewardModifiers.healthPercent,.08),
    'army-health-greater':g=>assert.equal(g.allies[0].rewardModifiers.healthPercent,.12),
    'order-notes':g=>assert.equal(Object.values(g.handLevels).filter(level=>level===2).length,1),
    'item-cache':g=>assert.equal(g.jokers.length,2),
  }
  for(const [id,check] of Object.entries(cases)) {
    const g=game(id),offer=offerOnly(g,id),rng=g.rng
    assert.equal(chooseWaveReward(g,id),true,id);check(g,offer)
    assert.equal(g.rng,rng);assert.equal(g.rewardChosen,id);assert.deepEqual(g.rewardState,{wave:g.wave,claimedId:id})
    const committed=copy(g);assert.equal(chooseWaveReward(g,id),false);assert.deepEqual(g,committed)
  }
})

test('partial room is described honestly, and a full-health repair cannot consume the choice',()=>{
  const g=game();g.maxEnergy=29;g.energy=12
  const energy=offerOnly(g,'energy-reservoir');assert.equal(energy.payload.amount,1);assert.match(energy.description,/\+1/)
  assert.equal(chooseWaveReward(g,energy.id),true);assert.equal(g.maxEnergy,30);assert.equal(g.energy,13)
  const repair=game();repair.baseHp=repair.maxBaseHp
  repair.rewards=[createRewardOffer(repair,'repair',{allowUnavailable:true}),createRewardOffer(repair,'gold-purse')]
  assert.deepEqual(rewardAvailability(repair,'repair'),{available:false,reason:'生命已满，无需恢复。请选择其他补给。'})
  assert.equal(chooseWaveReward(repair,'repair'),false);assert.equal(repair.rewardChosen,false)
  assert.equal(chooseWaveReward(repair,'gold-purse'),true)
})

test('unoffered, malformed, stale, wrong-phase and separately claimed receipts fail without changing state',()=>{
  for(const mutate of [
    g=>{g.rewards=[]},g=>{g.phase='ready'},g=>{g.rewardState.wave++},
    g=>{g.rewardChosen='supply'},g=>{g.rewardState.claimedId='supply'},
    g=>{g.rewards[0].payload.gold=9999},g=>{g.rewards[0].description='另一次随机奖励'},
  ]) {
    const g=game();offerOnly(g,'gold-purse');mutate(g);const before=copy(g)
    assert.equal(chooseWaveReward(g,'gold-purse'),false);assert.deepEqual(g,before)
  }
})
