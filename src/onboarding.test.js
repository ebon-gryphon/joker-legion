import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame,deploy,beginBattle,nextWave,addUnit,setFormation,moveInCamp,useTrick,snapshotGame,restoreGame } from './engine.js'
import { PERFORMERS } from './performers.js'
import { ONBOARDING_STEPS,initOnboarding,updateOnboarding,skipOnboarding,featureVisible,onboardingView,validOnboarding,migrateOnboarding } from './onboarding.js'

function deal(game,faces) {
  const stock=[...game.hand,...game.deck]
  const picked=faces.map(face=>stock.find(card=>card.suit+card.rank===face))
  assert.ok(picked.every(Boolean))
  const rest=stock.filter(card=>!picked.includes(card))
  game.hand=[...picked,...rest.slice(0,8-picked.length)];game.deck=rest.slice(8-picked.length);game.selected=picked.map(card=>card.id)
}
function newLearner(doctrine='iron') {const game=createGame({doctrine,seed:'tutorial'});initOnboarding(game);return game}
function advance(game) {game.phase='shop';game.rewardChosen='supply';assert.ok(nextWave(game));updateOnboarding(game,'nextWave')}
function fill(game,type='knight') {return addUnit(game,type,'ally')}

test('only explicit new-game opt-in enables coaching; old saves and disabled runs keep every feature',()=>{
  const old=createGame()
  assert.equal(onboardingView(old),null);assert.equal(old.onboarding,undefined)
  for (const key of ['orders','trick','forge','brief','feint','press','advanced']) assert.equal(featureVisible(old,key),true)
  assert.equal(migrateOnboarding(undefined),undefined)
  assert.ok(restoreGame(snapshotGame(old)))
  const game=createGame();initOnboarding(game,{enabled:false})
  assert.equal(game.onboarding.status,'skipped');assert.equal(onboardingView(game),null);assert.ok(featureVisible(game,'advanced'))
})

test('first-wave objectives follow actual recruits and front-line shields, and one pair can satisfy both effects',()=>{
  const game=newLearner()
  assert.equal(onboardingView(game).stepId,'w1-front')
  updateOnboarding(game,'deploy');assert.deepEqual(game.onboarding.done,[])
  deal(game,['♠3']);assert.ok(deploy(game));updateOnboarding(game,'deploy')
  assert.equal(onboardingView(game).stepId,'w1-healer')
  deal(game,['♥2','♦2']);game.orderTarget='knight';assert.ok(deploy(game));updateOnboarding(game,'deploy')
  assert.deepEqual(game.onboarding.done,['w1-front','w1-healer','w1-shield'])
  assert.equal(onboardingView(game).completed,3);assert.equal(onboardingView(game).stepId,null)
  assert.equal(game.handsLeft,1);assert.ok(beginBattle(game))
})

test('recruiting a priest without shielding the frontline does not finish the shield lesson',()=>{
  const game=newLearner();deal(game,['♠3']);deploy(game);updateOnboarding(game,'deploy')
  deal(game,['♥2','♦2']);game.orderTarget='healer';assert.ok(deploy(game));updateOnboarding(game,'deploy')
  assert.ok(game.onboarding.done.includes('w1-healer'));assert.ok(!game.onboarding.done.includes('w1-shield'))
  assert.equal(onboardingView(game).stepId,'w1-shield')
})

test('missing a pair or exhausting hands offers an exit and never rewrites the deck, resources or legal battle entry',()=>{
  const game=newLearner();deal(game,['♠3']);deploy(game);updateOnboarding(game,'deploy')
  deal(game,['♠2','♥4','♣5','♦6','♠7','♥8','♣9','♦10']);game.selected=[]
  const before=snapshotGame(game)
  assert.match(onboardingView(game).hint,/没有对子/)
  assert.deepEqual(snapshotGame(game),before)
  game.handsLeft=0;assert.match(onboardingView(game).hint,/次数已用完/)
  assert.ok(beginBattle(game));updateOnboarding(game,'battle')
  assert.ok(!game.onboarding.done.includes('w1-healer'))
  assert.equal(onboardingView(game).action,null)
  assert.ok(skipOnboarding(game,'step'));assert.ok(game.onboarding.skipped.includes('w1-healer'))
})

for (const actor of PERFORMERS) test(actor.name+' tutorial uses its actual trick timing and successful action',()=>{
  const game=newLearner(actor.doctrine);advance(game)
  assert.equal(onboardingView(game).stepId,'w2-trick')
  updateOnboarding(game,'trick');assert.ok(!game.onboarding.done.includes('w2-trick'))
  if (actor.id==='sleeve') {
    assert.match(onboardingView(game).hint,/战后/);assert.equal(onboardingView(game).usable,false)
    game.phase='shop';assert.equal(onboardingView(game).usable,true)
    assert.ok(useTrick(game,game.hand[0].id))
  } else if (actor.id==='ghost') {
    assert.ok(useTrick(game,game.hand.find(card=>card.rank!=='A').id,1))
  } else if (actor.id==='voice') {
    fill(game);fill(game,'healer');game.selected=[game.hand[0].id];game.orderTarget='knight'
    assert.ok(useTrick(game,'healer'))
  } else {
    const friend=fill(game);assert.ok(beginBattle(game))
    assert.equal(onboardingView(game).usable,true)
    assert.ok(useTrick(game,actor.id==='bell'?game.enemies[0].id:friend.id))
  }
  updateOnboarding(game,'trick');assert.ok(game.onboarding.done.includes('w2-trick'))
})

test('mirror explains the needed empty slot and a failed full-army cast cannot complete its objective',()=>{
  const game=newLearner('arcane');advance(game)
  for(let i=0;i<5;i++) fill(game)
  assert.match(onboardingView(game).hint,/满编/)
  beginBattle(game);assert.equal(useTrick(game,game.allies[0].id),false)
  updateOnboarding(game,'trick',{success:false});assert.ok(!game.onboarding.done.includes('w2-trick'))
  assert.ok(skipOnboarding(game,'step'));assert.ok(game.onboarding.skipped.includes('w2-trick'))
})

test('third wave teaches real formation or placement plus a prepared bell interrupt',()=>{
  const game=newLearner();advance(game);advance(game);fill(game)
  assert.equal(onboardingView(game).stepId,'w3-formation')
  updateOnboarding(game,'formation',{previous:'guard'});assert.ok(!game.onboarding.done.includes('w3-formation'))
  const previous=game.formation;assert.ok(setFormation(game,'hunt'));updateOnboarding(game,'formation',{previous})
  assert.equal(onboardingView(game).stepId,'w3-bell')
  deal(game,['♥2','♦2']);assert.ok(deploy(game));updateOnboarding(game,'deploy')
  assert.ok(game.bellReady);assert.ok(game.onboarding.done.includes('w3-bell'))
  assert.equal(game.onboarding.status,'complete');assert.equal(onboardingView(game),null)
  assert.ok(featureVisible(game,'press'))
  const placement=newLearner();advance(placement);advance(placement);const unit=fill(placement)
  assert.ok(moveInCamp(placement,unit.id,220,230));updateOnboarding(placement,'move',{id:unit.id})
  assert.ok(placement.onboarding.done.includes('w3-formation'))
})

test('a read-only view recovers actual state after a missed event without falsely advancing old waves',()=>{
  const game=newLearner();deal(game,['♠3']);deploy(game)
  const before=snapshotGame(game)
  assert.equal(onboardingView(game).stepId,'w1-healer');assert.deepEqual(snapshotGame(game),before)
  updateOnboarding(game,'state');assert.deepEqual(game.onboarding.done,['w1-front'])
  advance(game);assert.deepEqual(game.onboarding.skipped,['w1-healer','w1-shield'])
  assert.ok(!game.onboarding.done.includes('w1-healer'))
})

test('a first-wave camp position or non-default formation cannot skip the third-wave layout lesson',()=>{
  let game=newLearner();const unit=fill(game)
  assert.ok(moveInCamp(game,unit.id,220,230));updateOnboarding(game,'move',{id:unit.id})
  assert.ok(setFormation(game,'hunt'));updateOnboarding(game,'formation',{previous:'guard'})
  assert.ok(moveInCamp(game,unit.id,240,240));updateOnboarding(game,'move',{id:unit.id})
  game=restoreGame(snapshotGame(game));assert.ok(game)
  advance(game);advance(game)
  assert.ok(game.allies.some(ally=>ally.campSpot));assert.equal(game.formation,'hunt')
  assert.equal(onboardingView(game).stepId,'w3-formation')
  updateOnboarding(game,'state');assert.ok(!game.onboarding.done.includes('w3-formation'))
  const previous=game.formation;assert.ok(setFormation(game,'spread'))
  updateOnboarding(game,'formation',{previous});assert.ok(game.onboarding.done.includes('w3-formation'))
  const restored=restoreGame(snapshotGame(game));assert.ok(restored)
  assert.ok(restored.onboarding.done.includes('w3-formation'));assert.equal(onboardingView(restored).stepId,'w3-bell')
})

test('feature visibility is UI-only and skipping all immediately exposes the complete interface',()=>{
  const game=newLearner();assert.ok(featureVisible(game,'orders'));assert.equal(featureVisible(game,'forge'),false)
  assert.equal(featureVisible(game,'brief'),false);assert.equal(featureVisible(game,'press'),false)
  advance(game);assert.ok(featureVisible(game,'forge'));assert.ok(featureVisible(game,'trick'));assert.equal(featureVisible(game,'brief'),false)
  advance(game);assert.ok(featureVisible(game,'brief'));assert.equal(featureVisible(game,'feint'),false)
  const before=snapshotGame(game);assert.ok(skipOnboarding(game,'all'))
  const after=snapshotGame(game);delete before.onboarding;delete after.onboarding;assert.deepEqual(after,before)
  for(const key of ['orders','trick','forge','brief','feint','press','advanced']) assert.ok(featureVisible(game,key))
  assert.equal(game.onboarding.status,'skipped');assert.ok(validOnboarding(game.onboarding));assert.equal(onboardingView(game),null)
})

test('saved progress is cloned and validated, with invalid IDs, overlap and forged finished states rejected',()=>{
  const game=newLearner();assert.ok(skipOnboarding(game,'step'))
  const copy=migrateOnboarding(game.onboarding);assert.deepEqual(copy,game.onboarding);copy.skipped.push('w1-healer')
  assert.notDeepEqual(copy,game.onboarding)
  for(const bad of [null,{},[],{...game.onboarding,version:2},{...game.onboarding,done:['w2-unknown']},
    {...game.onboarding,done:['w1-front']},{...game.onboarding,skipped:['w1-front','w1-front']},
    {...game.onboarding,status:'complete'},{...game.onboarding,status:'skipped'},{...game.onboarding,extra:true}]) assert.equal(validOnboarding(bad),false)
  assert.equal(ONBOARDING_STEPS.length,6)
})

test('new-game progress resumes intact while malformed optional tutorial state rejects the snapshot',()=>{
  const game=newLearner();deal(game,['♠3']);assert.ok(deploy(game));updateOnboarding(game,'deploy')
  const restored=restoreGame(snapshotGame(game));assert.ok(restored)
  assert.deepEqual(restored.onboarding,game.onboarding);assert.equal(onboardingView(restored).stepId,'w1-healer')
  const bad=snapshotGame(game);bad.onboarding.done.push('invented-step');assert.equal(restoreGame(bad),null)
})
