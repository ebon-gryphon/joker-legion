// Unit-test fixtures for a specific reward effect. Strategy tests use the real seeded shelf.
import assert from 'node:assert/strict'
import {createRewardOffer,chooseReward,rewardAvailability} from './waveRewards.js'

export function setTestRewardShelf(game,requested) {
 const ids=Array.isArray(requested)?requested:[requested]
 const selected=[...new Set([...ids,'gold-purse','crystal-purse','gold-chest'])].slice(0,3)
 game.rewards=selected.map(id=>createRewardOffer(game,id,{allowUnavailable:true}))
 assert.ok(game.rewards.every(Boolean),'Test reward must be an actual catalog offer')
 game.rewardChosen=false
 game.rewardState={wave:game.wave,claimedId:null}
 return game.rewards
}

export function claimTestReward(game,id) {
 setTestRewardShelf(game,id)
 return chooseReward(game,id)
}

export function claimAvailableReward(game,preferred) {
 const offer=game.rewards.find(row=>row.id===preferred&&rewardAvailability(game,row.id).available) ||
  game.rewards.find(row=>rewardAvailability(game,row.id).available)
 return offer?chooseReward(game,offer.id):false
}
