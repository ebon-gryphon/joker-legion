import test from 'node:test'
import assert from 'node:assert/strict'
import {ECONOMY_VERSION,ECONOMY_CONFIG,CRYSTALS_PER_WAVE,waveCrystalIncome,gainCrystals} from './economy.js'
import {createGame,endWave} from './campaign.js'
import {buyJoker,sellJoker,rerollShop,trainOrder,priceOf,sellValue,rerollCost,shopActionAvailability} from './fieldShop.js'
import {createRewardOffer,chooseReward} from './waveRewards.js'
import {snapshotGame} from './gameSave.js'
import {JOKER_BY_ID} from './campaignRules.js'

const clone=value=>JSON.parse(JSON.stringify(value))
function shop(){
 const game=createGame({seed:'dual-currency-shop'})
 game.phase='shop';game.rewardState={wave:game.wave,claimedId:null}
 game.rewards=[createRewardOffer(game,'gold-purse')]
 assert.ok(chooseReward(game,'gold-purse'))
 game.shop=['score-chalk','heart-engine','pair-ink'];game.soldShop=[]
 return game
}

test('crystal income is five per wave plus five on every fifth wave without a twelve-wave ceiling',()=>{
 assert.equal(ECONOMY_VERSION,1);assert.equal(CRYSTALS_PER_WAVE,5);assert.equal(ECONOMY_CONFIG.legacyGrant,5);assert.equal(rerollCost,2)
 for(let wave=1;wave<=40;wave++)assert.equal(waveCrystalIncome(wave),wave%5===0?10:5)
 assert.equal(waveCrystalIncome(1000),10)
 assert.equal(Array.from({length:12},(_,i)=>waveCrystalIncome(i+1)).reduce((sum,n)=>sum+n,0),70)
 for(const wave of [0,-1,1.5,NaN,Infinity,'5'])assert.equal(waveCrystalIncome(wave),0)
})

test('crystal gains update their own earned total and reject invalid amounts atomically',()=>{
 const game={gold:17,crystals:2,rng:789,stats:{goldEarned:11,crystalsEarned:3}}
 assert.equal(gainCrystals(game,5),5)
 assert.deepEqual(game,{gold:17,crystals:7,rng:789,stats:{goldEarned:11,crystalsEarned:8}})
 for(const amount of [0,-2,.5,NaN,Infinity]){const before=clone(game);assert.equal(gainCrystals(game,amount),0);assert.deepEqual(game,before)}
 game.crystals=Number.MAX_SAFE_INTEGER;const before=clone(game)
 assert.equal(gainCrystals(game,1),0);assert.deepEqual(game,before)
})

test('endWave credits nonterminal waves once and the final victory has no currency or shelf',()=>{
 for(const wave of [1,5,10,12]){
  const game=createGame({seed:'crystal-income-'+wave});game.wave=wave;game.phase='battle'
  const gold=game.gold,rng=game.rng
  endWave(game)
  if(wave===12){assert.equal(game.phase,'won');assert.equal(game.crystals,0);assert.equal(game.gold,gold);assert.deepEqual(game.rewards,[]);assert.deepEqual(game.shop,[]);assert.equal(game.rng,rng);continue}
  const expected=waveCrystalIncome(wave)
  assert.equal(game.phase,'shop');assert.equal(game.crystals,expected);assert.equal(game.stats.crystalsEarned,expected)
  assert.equal(game.gold,gold+(wave===12?0:8+wave*2));assert.equal(game.lastSettlement.crystals.total,expected)
  assert.equal(game.lastSettlement.crystals.base,5);assert.equal(game.lastSettlement.crystals.bonus,wave%5===0?5:0)
  assert.notEqual(game.rng,rng,'Only shelf generation rolls, after income has been credited')
  const settled=snapshotGame(game);endWave(game);assert.deepEqual(snapshotGame(game),settled)
 }
})

test('shop purchases spend original blue-crystal prices while gold cannot pay for an item',()=>{
 const game=shop(),price=JOKER_BY_ID['score-chalk'].price
 game.gold=0;game.crystals=price
 const earned=game.stats.goldEarned,crystalEarned=game.stats.crystalsEarned
 assert.equal(priceOf('score-chalk'),price);assert.equal(priceOf(JOKER_BY_ID['score-chalk']),price)
 assert.ok(buyJoker(game,'score-chalk'));assert.equal(game.crystals,0);assert.equal(game.gold,0)
 assert.equal(game.stats.goldEarned,earned);assert.equal(game.stats.crystalsEarned,crystalEarned)
 assert.equal(game.jokers.find(item=>item.id==='score-chalk').quantity,1)
 game.gold=999;game.crystals=0
 for(const action of [()=>buyJoker(game,'heart-engine'),()=>rerollShop(game)]){const before=clone(game);assert.equal(action(),false);assert.deepEqual(game,before)}
})

test('sales remove one copy and credit crystals with a minimum return of one, never gold-earned',()=>{
 const game=shop(),item=JOKER_BY_ID['score-chalk'],value=Math.max(1,Math.floor(item.price/2))
 game.jokers.push({...item,quantity:2,triggers:0,flash:0});game.crystals=0
 const gold=game.gold,earned=game.stats.goldEarned,crystalEarned=game.stats.crystalsEarned
 assert.equal(sellValue(item),value);assert.ok(sellJoker(game,item.id));assert.equal(game.jokers.find(row=>row.id===item.id).quantity,1)
 assert.equal(game.crystals,value);assert.ok(sellJoker(game,item.id));assert.ok(!game.jokers.some(row=>row.id===item.id))
 assert.equal(game.crystals,value*2);assert.equal(game.stats.crystalsEarned,crystalEarned+value*2)
 assert.equal(game.gold,gold);assert.equal(game.stats.goldEarned,earned)
 const before=clone(game);assert.equal(sellJoker(game,item.id),false);assert.deepEqual(game,before)
})

test('paid rerolls spend two crystals and insufficient funds do not consume randomness or mutate sold slots',()=>{
 const game=shop();game.gold=0;game.crystals=2;game.soldShop=['score-chalk']
 const rng=game.rng,earned=game.stats.crystalsEarned
 assert.ok(rerollShop(game));assert.equal(game.crystals,0);assert.equal(game.gold,0);assert.equal(game.stats.crystalsEarned,earned)
 assert.notEqual(game.rng,rng);assert.equal(game.shop.length,3);assert.deepEqual(game.soldShop,[])
 const before=clone(game);assert.equal(rerollShop(game),false);assert.deepEqual(game,before)
})

test('unclaimed rewards block every merchant mutation and availability is a pure explanation',()=>{
 const game=shop();game.rewardChosen=false;game.rewardState.claimedId=null;game.gold=100;game.crystals=100
 for(const [kind,id,action] of [['buy','score-chalk',()=>buyJoker(game,'score-chalk')],['sell',game.jokers[0].id,()=>sellJoker(game,game.jokers[0].id)],['reroll',null,()=>rerollShop(game)]]){
  const before=clone(game),status=shopActionAvailability(game,kind,id)
  assert.equal(status.available,false);assert.match(status.reason,/领取/);assert.equal(status.currency,'crystals')
  assert.deepEqual(game,before);assert.equal(action(),false);assert.deepEqual(game,before)
 }
 const before=clone(game);assert.equal(trainOrder(game,'pair'),false);assert.deepEqual(game,before)
})

test('hand research retains its gold price and cannot spend crystals as a substitute',()=>{
 const game=shop();game.gold=5;game.crystals=0
 assert.ok(trainOrder(game,'pair'));assert.equal(game.gold,0);assert.equal(game.crystals,0);assert.equal(game.handLevels.pair,2)
 game.trainedHere=false;game.gold=4;game.crystals=100
 const before=clone(game);assert.equal(trainOrder(game,'high'),false);assert.deepEqual(game,before)
})
