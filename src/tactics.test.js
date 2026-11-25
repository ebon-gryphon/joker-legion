import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, setFormation, waveSchedule, deploy, previewHand, beginBattle, tick, snapshotGame, restoreGame, nextWave, rerollShop } from './engine.js'
import { scoutWave, nextChime, tollDamage, BELL_INTERVAL, BELL_WINDUP, SILENT_BOUNTY, HOSTILE } from './tactics.js'
import { ENEMY_CATALOG, enemyFrame } from './enemyCatalog.js'
import { getSpriteFrame } from './spriteAtlas.js'
import { resetBuildWave } from './buildPassives.js'

test('every enemy matches its field guide portrait and the king changes pose exactly at half health', () => {
  assert.deepEqual(Object.keys(ENEMY_CATALOG), Object.keys(HOSTILE))
  assert.equal(new Set(Object.keys(HOSTILE).map(type => { const f=getSpriteFrame({type,side:'enemy'});return f.atlas+':'+f.frame })).size, Object.keys(HOSTILE).length)
  for (const type of Object.keys(HOSTILE)) {
    for (const hp of [100, 51, 50, 1]) {
      const field = getSpriteFrame({ type, side: 'enemy', hp, maxHp: 100 })
      const book = getSpriteFrame({ atlas: type==='finalBoss'?'queen-motion':'enemies', frame: type==='finalBoss'?0:enemyFrame(type, hp <= 50) })
      assert.deepEqual(field, book)
      assert.equal(field.frame, type==='finalBoss'?0:type === 'boss' && hp <= 50 ? 7 : ENEMY_CATALOG[type].frame)
      assert.equal(field.column + 4 * field.row, field.frame)
    }
  }
})

function takeCards(game, faces) {
  const deck = [...game.hand, ...game.deck]
  const chosen = faces.map(face => deck.find(card => card.suit + card.rank === face))
  assert.ok(chosen.every(Boolean))
  const others = deck.filter(card => !chosen.includes(card))
  game.hand = [...chosen, ...others.slice(0, 8 - chosen.length)]
  game.deck = others.slice(8 - chosen.length)
  game.selected = chosen.map(card => card.id)
}

function practice(formation, enemies, prepare = () => {}) {
  const game = createGame({ seed: 314, doctrine: 'arcane' })
  setFormation(game, formation)
  fixtureCompany(game, 'knight'); fixtureCompany(game, 'ranger')
  game.allies = ['knight','ranger','healer'].map(type => game.allies.find(u => u.type === type))
  game.wave = 3
  resetBuildWave(game)
  prepare(game)
  game.schedule = enemies.map(type => ({ at: 0, type })); assert.ok(beginBattle(game))
  tick(game, 1 / 30)
  game.allies.forEach(unit => { unit.x = 330; unit.y = 240; unit.cooldown = 100 })
  game.enemies.forEach(unit => { unit.x = 400; unit.y = 240; unit.cooldown = 100 })
  return game
}

test('shop scouting is deterministic before purchases and matches the next actual schedule in both difficulties', () => {
  for (const difficulty of ['standard', 'veteran']) {
    const game = createGame({ seed: 'route', difficulty })
    assert.equal(game.maxBaseHp, difficulty === 'standard' ? 12 : 8)
    game.wave = 2; game.phase = 'shop'; game.gold = 40; game.rewardChosen = 'power'
    const forecast = waveSchedule(game.seed, 3, difficulty)
    const snapshot = snapshotGame(game)
    const intel = scoutWave(forecast)
    assert.equal(intel.bells.length, difficulty === 'standard' ? 1 : 2)
    assert.deepEqual(snapshotGame(game), snapshot)
    rerollShop(game)
    assert.ok(nextWave(game))
    assert.deepEqual(game.schedule, forecast)
    assert.equal(intel.total, intel.enemies.reduce((n, entry) => n + entry.count, 0))
    assert.equal(restoreGame(snapshotGame(game)).difficulty, difficulty)
    for (let wave = 1; wave <= 12; wave++) {
      const schedule = waveSchedule(game.seed, wave, difficulty)
      assert.ok(schedule.length <= 40)
      assert.equal(scoutWave(schedule).bossAt, [6,12].includes(wave) ? 0 : null)
    }
  }
})

test('choosing a formation rearranges the camp, is reversible without consuming resources, and locks on battle', () => {
  const game = createGame()
  fixtureCompany(game, 'ranger')
  const before = snapshotGame(game)
  assert.equal(setFormation(game, '__proto__'), false)
  assert.equal(setFormation(game, 'spread'), true)
  assert.notDeepEqual(game.allies.map(unit => unit.y), before.allies.map(unit => unit.y))
  assert.equal(setFormation(game, 'guard'), true)
  assert.deepEqual(snapshotGame(game), before)
  setFormation(game, 'hunt'); beginBattle(game)
  assert.equal(setFormation(game, 'spread'), false)
  assert.equal(restoreGame(snapshotGame(game)).formation, 'hunt')
})

test('hunter ranged attacks preferentially hit the bellkeeper with the displayed direct bonus', () => {
  const game = practice('hunt', ['raider','bellkeeper','archer'])
  const ranger = game.allies.find(unit => unit.type === 'ranger')
  const [front, bell, archer] = game.enemies
  front.x = 355; bell.x = 470
  const hp = bell.hp, otherHp = archer.hp, frontHp = front.hp
  ranger.cooldown = 0
  tick(game, 1 / 30)
  assert.ok(Math.abs((hp - bell.hp) - ranger.atk * 1.3) < 1e-7)
  assert.ok(Math.abs(game.tacticsReport.extraDamage - ranger.atk * .3) < 1e-7)
  assert.equal(archer.hp, otherHp)
  assert.equal(front.hp, frontHp)
})

test('guard only mitigates the direct hit, spread only mitigates splash and reduces ordinary healing', () => {
  for (const formation of ['guard', 'spread']) {
    const game = practice(formation, ['brute'])
    const [brute] = game.enemies
    const knight = game.allies.find(unit => unit.type === 'knight')
    const ranger = game.allies.find(unit => unit.type === 'ranger')
    const healer = game.allies.find(unit => unit.type === 'healer')
    knight.x = 390; ranger.x = 375; healer.x = 270
    brute.cooldown = 0
    const hp = knight.hp, sideHp = ranger.hp
    tick(game, 1 / 30)
    assert.ok(Math.abs((hp - knight.hp) - brute.atk * (formation === 'guard' ? .8 : 1)) < 1e-7)
    assert.ok(Math.abs((sideHp - ranger.hp) - brute.atk * .5 * (formation === 'spread' ? .6 : 1)) < 1e-7)
    const healed = game.stats.healed
    healer.cooldown = 0; knight.hp = 1; brute.cooldown = 10
    tick(game, 1 / 30)
    assert.ok(Math.abs(game.stats.healed - healed - healer.heal * (formation === 'spread' ? .8 : 1)) < 1e-7)
    assert.ok(game.tacticsReport.prevented > 0)
  }
})

test('a legal pair interrupts the earliest active bell once and a mid-cast save reproduces the exact outcome', () => {
  const game = practice('guard',['bellkeeper','bellkeeper'], camp => {
    takeCards(camp,['♥J','♣J']);assert.ok(deploy(camp));assert.equal(camp.bellReady,true)
  })
  game.enemies[0].bellTimer=6;game.enemies[1].bellTimer=2
  const restored = restoreGame(snapshotGame(game))
  for (const run of [game, restored]) {
    const gold = run.gold
    assert.equal(deploy(run),false);tick(run,1/30)
    assert.ok(Math.abs(run.enemies[0].bellTimer-(6-1/30))<1e-7)
    assert.ok(Math.abs(run.enemies[1].bellTimer-(BELL_INTERVAL-1/30))<1e-7)
    assert.equal(run.bellReady,false)
    assert.equal(run.tacticsReport.interrupts, 1)
    assert.equal(run.gold, gold)
    assert.equal(deploy(run), false)
  }
  assert.deepEqual(snapshotGame(game), snapshotGame(restored))
})

test('an unaffordable pair cannot interrupt, high card cannot prepare one, and a toll summons a real raider without direct life loss', () => {
  const game=practice('guard',['bellkeeper'],camp=>{
    takeCards(camp,['♥J','♣J']);camp.energy=1
    assert.equal(deploy(camp),false);assert.equal(camp.bellReady,false)
    camp.energy=5;camp.selected=[camp.hand[0].id]
    assert.ok(deploy(camp));assert.equal(camp.bellReady,false)
  })
  assert.equal(deploy(game),false)
  assert.equal(game.tacticsReport.interrupts,0)
  game.baseHp = 7; game.enemies[0].bellTimer = .01
  tick(game, 1/30)
  assert.equal(game.tacticsReport.gateDamage,0)
  assert.equal(tollDamage(3),0)
  assert.equal(game.tacticsReport.tolls, 1)
  assert.equal(game.baseHp,7);assert.equal(game.phase,'battle')
  const reinforcement=game.enemies.find(unit=>unit.summonedBy==='bellkeeper')
  assert.ok(reinforcement);assert.equal(reinforcement.type,'raider')
  assert.equal(reinforcement.bellSourceId,game.enemies.find(unit=>unit.type==='bellkeeper').id)
  assert.ok(restoreGame(snapshotGame(game)))
})

test('killing a casting bell cancels its attack and pays a silent bounty once, only for defending a bell wave', () => {
  for (const silent of [true,false]) {
    const game = practice('guard', ['bellkeeper'])
    game.waveTime = 5
    const caster = game.enemies[0]
    caster.bellTimer = silent ? BELL_WINDUP : .01
    if (!silent) tick(game,1/30)
    const reinforcement=game.enemies.find(unit=>unit.summonedBy==='bellkeeper')
    if(!silent){assert.ok(reinforcement);reinforcement.hp=0}
    const gold = game.gold, hp = game.baseHp
    caster.hp = 0
    tick(game,1/30)
    const bonus = silent ? SILENT_BOUNTY : 0
    assert.equal(game.phase, 'shop')
    assert.equal(game.baseHp, hp)
    assert.equal(game.tacticsReport.bounty, bonus)
    assert.equal(game.gold, gold + 8 + 3 * 2 + bonus)
    tick(game,.25)
    assert.equal(game.gold, gold + 8 + 3 * 2 + bonus)
  }
})

test('legacy saves retain their active wave and migrate tactical fields, invalid timers and formations are rejected', () => {
  const game = practice('guard', ['raider'])
  const old = snapshotGame(game)
  delete old.formation; delete old.difficulty; delete old.tacticsReport
  const migrated = restoreGame(old)
  assert.equal(migrated.formation, 'guard')
  assert.equal(migrated.difficulty, 'standard')
  assert.deepEqual(migrated.schedule, old.schedule)
  const invalid = snapshotGame(practice('spread', ['bellkeeper']))
  invalid.enemies[0].bellTimer = 100
  assert.equal(restoreGame(invalid), null)
  old.formation = 'toString'
  assert.equal(restoreGame(old), null)
})

test('the hunt report counts only extra damage after an opening longbow shot and caps overkill',()=>{
  for (const [enemyHp,expected] of [[500,25.8],[100,14],[70,0]]) {
    const g=practice('hunt',['bellkeeper'])
    const ranger=g.allies.find(unit=>unit.type==='ranger')
    Object.assign(ranger,{jobId:'archer',atk:43,attacks:0,cooldown:0})
    Object.assign(g.enemies[0],{hp:enemyHp,maxHp:500,x:390})
    tick(g,1/30)
    assert.ok(Math.abs(g.tacticsReport.extraDamage-expected)<1e-7)
  }
})
