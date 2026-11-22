import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { FUSIONS, FUSION_COST, mergePreview, recipeFor, workshopPairs } from './forge.js'
import { createGame, beginBattle, tick, forgeUnit, commission, restoreGame, snapshotGame, vanguard, nextWave } from './engine.js'
import { outfitFrame } from './outfits.js'
import { getSpriteFrame } from './spriteAtlas.js'

function recruitPair(recipe) {
  const game = createGame({ seed: 614, doctrine: 'scarlet' })
  for (const type of recipe.types) assert.ok(fixtureCompany(game, type))
  const [leader, donor] = recipe.types.map(type => game.allies.find(unit => unit.type === type && unit.level === 2))
  return { game, leader, donor }
}

for (const recipe of FUSIONS) {
  test(recipe.name + ' has one symmetric recipe, an exact preview and a saveable three-star identity for this wave', () => {
    const { game, leader, donor } = recruitPair(recipe)
    assert.equal(recipeFor(donor.type, leader.type), recipe)
    const preview = mergePreview(game, leader.id, donor.id, recipe.id)
    assert.ok(workshopPairs(game)[recipe.id].some(pair => pair.leader.id === donor.id && pair.donor.id === leader.id))
    assert.equal(preview.atk, leader.atk + Math.round(donor.atk * .6))
    const face = leader.appearanceId, before = game.allies.length, gold = game.gold
    assert.equal(forgeUnit(game, leader.id, donor.id, recipe.id), true)
    assert.equal(game.gold, gold - FUSION_COST)
    assert.equal(game.allies.length, before - 1)
    assert.equal(leader.level, 3)
    for (const [key, value] of Object.entries(preview)) assert.deepEqual(leader[key], value)
    assert.equal(leader.fusionPartner, donor.appearanceId)
    assert.equal(leader.fusion, recipe.id)
    assert.equal(leader.appearanceId, face)
    assert.deepEqual(getSpriteFrame(leader),outfitFrame(recipe.id,leader.grade))
    assert.equal(game.stats.lost, 0)
    assert.equal(game.fusions, 1)
    const restored = restoreGame(snapshotGame(game))
    assert.deepEqual(restored.allies, game.allies)
    assert.deepEqual(restored.hand, game.hand)
    restored.phase = 'shop'; restored.rewardChosen = 'supply'
    assert.equal(nextWave(restored), true)
    assert.equal(restored.allies.find(u=>u.id===leader.id).fusion, recipe.id)
    assert.ok(!restored.allies.some(u=>u.id===donor.id))
    assert.equal(restored.fusions, 1)
    const repeat = snapshotGame(game)
    assert.equal(forgeUnit(game, leader.id, donor.id, recipe.id), false)
    assert.deepEqual(snapshotGame(game), repeat)
  })

  test(recipe.skill + ' triggers in actual combat and records its mechanical effect only on a charged action', () => {
    const { game, leader, donor } = recruitPair(recipe)
    assert.equal(forgeUnit(game, leader.id, donor.id, recipe.id), true)
    game.schedule = [0, 0, 0].map(at => ({ at, type: 'brute' })); beginBattle(game)
    tick(game, .04)
    for (const unit of game.allies) {
      unit.x = 300; unit.y = 240; unit.cooldown = 5; unit.hp = 1
    }
    leader.hp = leader.maxHp; leader.cooldown = 0; leader.skillCharge = 2
    game.enemies.forEach((unit, i) => {
      unit.x = 320 + i * 10; unit.y = 240; unit.hp = unit.maxHp = [500, 900, 650][i]; unit.cooldown = .5
    })
    const control = restoreGame(snapshotGame(game))
    const plain = control.allies.find(unit => unit.id === leader.id)
    plain.skillCharge = 0
    tick(game, 1 / 30); tick(control, 1 / 30)
    assert.equal(game.fusionUses[recipe.id], 1)
    assert.equal(leader.skillCharge, 0)
    assert.equal(plain.skillCharge, 1)
    assert.deepEqual(control.fusionUses, {})
    const extraDamage = game.enemies.map((unit, i) => control.enemies[i].hp - unit.hp)
    if (recipe.id === 'paladin') assert.ok(game.allies.some(unit => unit.shield === 20 + leader.heal))
    if (recipe.id === 'warden') assert.deepEqual(extraDamage, [0, Math.round(leader.atk * 1.4), 0])
    if (recipe.id === 'starblade') assert.ok(extraDamage.every(value => value === Math.round(leader.atk * .75)))
    if (recipe.id === 'bard') assert.ok(game.allies.filter((unit, i) => unit.hp > control.allies[i].hp).length >= 2)
    if (recipe.id === 'priest') {
      assert.equal(extraDamage[0], Math.round(leader.atk * .9))
      assert.ok(game.waveReport.healer.healed > control.waveReport.healer.healed)
    }
    if (recipe.id === 'frostbow') {
      assert.deepEqual(extraDamage, [Math.round(leader.atk * .5), Math.round(leader.atk * .5), 0])
      assert.ok(game.enemies[0].cooldown > control.enemies[0].cooldown + .79)
    }
    assert.ok(restoreGame(snapshotGame(game)))
  })
}

test('invalid workshop choices are atomic and a commander can lead but cannot be consumed', () => {
  const recipe = FUSIONS[0]
  const { game, leader, donor } = recruitPair(recipe)
  commission(game, donor.id, 'guard')
  const before = snapshotGame(game)
  for (const args of [[leader.id, donor.id, recipe.id], [leader.id, leader.id, recipe.id],
    [donor.id, leader.id, 'warden'], [donor.id, leader.id, 'promote'], ['missing', leader.id, recipe.id]]) {
    assert.equal(forgeUnit(game, ...args), false)
    assert.deepEqual(snapshotGame(game), before)
  }
  assert.equal(forgeUnit(game, donor.id, leader.id, recipe.id), true)
  assert.equal(donor.command, 'guard')
  assert.equal(vanguard(game)[0].id, donor.id)
  beginBattle(game)
  assert.deepEqual(workshopPairs(game)[recipe.id], [])
  assert.equal(mergePreview(game, donor.id, leader.id, recipe.id), null)
})

test('legacy armies migrate and corrupted fusion identities, reports, progress or duplicated unit IDs are rejected', () => {
  const recipe = FUSIONS[0]
  const { game, leader, donor } = recruitPair(recipe)
  const legacy = snapshotGame(game)
  delete legacy.fusions; delete legacy.fusionUses
  const migrated = restoreGame(legacy)
  assert.equal(migrated.fusions, 0)
  assert.deepEqual(migrated.fusionUses, {})
  assert.equal(forgeUnit(game, leader.id, donor.id, recipe.id), true)
  for (const mutate of [
    (g, u) => { u.fusion = 'toString' }, (g, u) => { u.fusion = 'frostbow' }, (g, u) => { u.level = 2 }, (g, u) => { u.fusionPartner = 'clubs-A' },
    (g, u) => { u.skillCharge = 4 }, g => { g.fusionUses.paladin = -1 }, g => { g.allies[1].id = g.allies[0].id },
  ]) {
    const bad = snapshotGame(game)
    mutate(bad, bad.allies.find(unit => unit.id === leader.id))
    assert.equal(restoreGame(bad), null)
  }
})

test('fusion previews stay available when funds run short and failed spending leaves both soldiers intact', () => {
  const { game, leader, donor } = recruitPair(FUSIONS[0])
  game.gold = FUSION_COST - 1
  const before = snapshotGame(game)
  assert.ok(mergePreview(game, leader.id, donor.id, 'paladin'))
  assert.equal(forgeUnit(game, leader.id, donor.id, 'paladin'), false)
  assert.deepEqual(snapshotGame(game), before)
  game.gold++
  assert.equal(forgeUnit(game, leader.id, donor.id, 'paladin'), true)
  assert.equal(game.gold, 0)
  assert.equal(forgeUnit(game, leader.id, donor.id, 'paladin'), false)
  assert.equal(game.gold, 0)
})

// All recruit professions can combine, even when they share a regiment.
import { FUSION_PROFESSIONS, PROFESSION_COMBINATIONS, professionJobs } from './professionFusion.js'
import { DETACHMENTS } from './recruitment.js'
import { addUnit, drill, drillPreview, designateChampion, toggleSoldierLock } from './engine.js'
import { grantExperience, trainingBonus } from './training.js'
import { lastingStat, waveChange } from './standingArmy.js'

function professionSoldier(game,job,level=1) {
  const role=FUSION_PROFESSIONS.find(item=>item.id===job)
  const face=DETACHMENTS[role.pattern].members[0]
  return addUnit(game,face.type,'ally',level,{identity:{...face,pattern:role.pattern,source:'card',grade:0}})
}

test('all 66 profession combinations fuse at one star in either order, adding full base stats and retaining identity',()=>{
  assert.equal(PROFESSION_COMBINATIONS.length,66)
  for (const combination of PROFESSION_COMBINATIONS) for (const reverse of [false,true]) {
    const game=createGame();game.gold=20
    const [left,right]=reverse?combination.jobs.slice().reverse():combination.jobs
    const leader=professionSoldier(game,left),donor=professionSoldier(game,right)
    const identity=[leader.id,leader.appearanceId,leader.pattern,leader.jobId,leader.level]
    const expected={atk:leader.atk+donor.atk,maxHp:leader.maxHp+donor.maxHp,heal:leader.heal+donor.heal}
    assert.ok(workshopPairs(game).profession.some(p=>p.leader===leader && p.donor===donor),combination.name)
    assert.equal(drillPreview(game,donor.id,leader.id).kind,'profession')
    const preview=mergePreview(game,leader.id,donor.id,'profession')
    for(const key of ['atk','maxHp','heal']) assert.equal(preview[key],expected[key],combination.name+' '+key)
    assert.ok(forgeUnit(game,leader.id,donor.id,'profession'),combination.name)
    assert.deepEqual([leader.id,leader.appearanceId,leader.pattern,leader.jobId,leader.level],identity)
    assert.deepEqual(professionJobs(leader),[left,right]);assert.equal(game.gold,15);assert.equal(game.allies.length,1)
    assert.deepEqual(restoreGame(snapshotGame(game)).allies,game.allies)
  }
})

test('continued fusion retains every profession, learned lesson and earlier fusion through promotion and the next wave',()=>{
  const game=createGame();game.gold=40
  const leader=professionSoldier(game,'blade'),priest=professionSoldier(game,'priest',3),rider=professionSoldier(game,'cavalry')
  grantExperience(game,priest,8);rider.lessons=['ward']
  assert.ok(drill(game,priest.id,leader.id));assert.equal(leader.level,1)
  assert.ok(drill(game,rider.id,leader.id));assert.deepEqual(leader.fusionJobs,['blade','priest','cavalry'])
  assert.ok(leader.lessons.includes('ward'))
  const twin=professionSoldier(game,'blade')
  assert.ok(forgeUnit(game,leader.id,twin.id,'promote'));assert.equal(leader.level,2)
  game.phase='shop';game.rewardChosen='supply';assert.ok(nextWave(game))
  const restored=restoreGame(snapshotGame(game))
  assert.deepEqual(restored.allies[0].fusionJobs,['blade','priest','cavalry']);assert.ok(restored.allies[0].lessons.includes('ward'))
})

test('profession fusion excludes temporary orders and reconstructs inherited training once',()=>{
  const game=createGame();game.gold=20
  const leader=professionSoldier(game,'blade'),donor=professionSoldier(game,'priest')
  grantExperience(game,leader,8);grantExperience(game,donor,15)
  const hp=leader.maxHp,atk=leader.atk,donorHp=donor.maxHp,donorAtk=donor.atk
  waveChange(donor,()=>{donor.maxHp+=500;donor.hp+=500;donor.atk+=300;donor.heal+=200;donor.period*=.5})
  const before=trainingBonus(8,game.wave),after=trainingBonus(23,game.wave),trained=trainingBonus(15,game.wave)
  const preview=mergePreview(game,leader.id,donor.id,'profession')
  assert.equal(preview.maxHp,hp+after.hp-before.hp+donorHp-trained.hp)
  assert.equal(preview.atk,atk+after.atk-before.atk+donorAtk-trained.atk)
  assert.equal(preview.period,Math.min(leader.period,lastingStat(donor,'period')))
  assert.ok(forgeUnit(game,leader.id,donor.id,'profession'));assert.equal(leader.trainingXp,23)
  assert.ok(restoreGame(snapshotGame(game)))
})

test('same-regiment jobs fuse but only the same actual profession can use free star promotion',()=>{
  const game=createGame();game.gold=20
  const blade=professionSoldier(game,'blade'),pike=professionSoldier(game,'pike'),twin=professionSoldier(game,'blade')
  assert.equal(mergePreview(game,blade.id,pike.id,'promote'),null)
  assert.ok(mergePreview(game,blade.id,pike.id,'profession'))
  assert.equal(mergePreview(game,blade.id,twin.id,'profession'),null)
  assert.ok(mergePreview(game,blade.id,twin.id,'promote'))
})

test('locked materials and short funds fail atomically while a locked main soldier can fuse',()=>{
  const game=createGame();const leader=professionSoldier(game,'blade'),donor=professionSoldier(game,'priest')
  designateChampion(game,donor.id)
  let before=snapshotGame(game);assert.equal(drill(game,donor.id,leader.id),false);assert.deepEqual(snapshotGame(game),before)
  toggleSoldierLock(game,donor.id);designateChampion(game,leader.id)
  game.gold=4;before=snapshotGame(game)
  assert.equal(forgeUnit(game,leader.id,donor.id,'profession'),false);assert.deepEqual(snapshotGame(game),before)
  game.gold=5;assert.ok(drill(game,donor.id,leader.id));assert.ok(leader.locked)
})

test('corrupt profession histories are rejected without discarding legitimate old six-skill saves',()=>{
  const game=createGame();const leader=professionSoldier(game,'blade'),donor=professionSoldier(game,'priest')
  assert.ok(forgeUnit(game,leader.id,donor.id,'profession'))
  for (const jobs of [[],['blade'],['priest','blade'],['blade','blade'],['blade','toString'],['blade','constructor']]) {
    const bad=snapshotGame(game);bad.allies[0].fusionJobs=jobs;assert.equal(restoreGame(bad),null)
  }
})
