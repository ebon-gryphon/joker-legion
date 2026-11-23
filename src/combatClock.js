import { CAMP_AREA } from './formation.js'
import { breachDamage, bossStep, unitStep } from './combatActions.js'
import { log, effect, clamp } from './gameState.js'
import { spawnEnemies } from './waveSchedule.js'
import { settleDeaths } from './combatHealth.js'
import { WAVES, STEP } from './campaignRules.js'
import { resolvePreparedTactics, settleFeint } from './battlePlans.js'
import { endWave, regroupArmy } from './campaign.js'
import { isBoss } from './bossRules.js'
import { recordGateDamage, finishCombatStats } from './combatStats.js'

export function describeWaveTimeout({ count, damage, boss, bossName }) {
  return boss ? `时间到，${bossName || '无冕之王'}突破城门` : `时间到，${count} 名残敌突围，城门耐久 −${damage}`
}

function resolveTimeout(game) {
  // The field cap can leave reinforcements queued behind the front line.
  const remaining = game.enemies.concat(game.schedule.slice(game.spawnIndex))
  if (!remaining.length) return
  const before = game.baseHp
  for (const unit of remaining) game.baseHp -= breachDamage(unit.type, game.baseHp)
  recordGateDamage(game,before-game.baseHp)
  game.waveTimeout = { count: remaining.length, damage: before - game.baseHp, boss: remaining.some(unit => isBoss(unit.type)),
    ...(remaining.some(unit => unit.type === 'finalBoss') ? {bossName:'缀命皇后'} : {}) }
  game.enemies = []
  game.spawnIndex = game.schedule.length
  log(game, describeWaveTimeout(game.waveTimeout), 'danger')
}

function advanceCombat(game, dt, onAction) {
  spawnEnemies(game)
  if (game.trickUsed && game.doctrine === 'arcane') {
    const expired = game.allies.find(unit => unit.echoUntil <= game.time)
    if (expired) {
      game.allies = game.allies.filter(unit => unit !== expired)
      effect(game,'burst',expired.x,expired.y,'镜消','#c9a7e9')
    }
  }
  bossStep(game, dt, onAction)
  for (const unit of game.allies) unitStep(game, unit, dt, onAction)
  for (const unit of game.enemies) unitStep(game, unit, dt, onAction)
  settleDeaths(game)
  // Gentle separation keeps the battlefield readable without changing targeting rules.
  for (const team of [game.allies, game.enemies]) {
    for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) {
      const a = team[i], b = team[j]
      if (Math.abs(a.x - b.x) < 18 && Math.abs(a.y - b.y) < 13) {
        const sign = a.y <= b.y ? -1 : 1
        a.y = clamp(a.y + sign * dt * 8, CAMP_AREA.top, CAMP_AREA.bottom)
        b.y = clamp(b.y - sign * dt * 8, CAMP_AREA.top, CAMP_AREA.bottom)
      }
    }
  }
}

function simulationStep(game, dt, onAction) {
  const deadline = WAVES[game.wave - 1].duration
  if (game.phase === 'battle') dt = Math.min(dt, Math.max(0, deadline - game.waveTime))
  game.time += dt
  for (const item of game.effects) item.life -= dt
  game.effects = game.effects.filter(item => item.life > 0)
  for (const joker of game.jokers) joker.flash = Math.max(0, joker.flash - dt)
  game.discardCooldown = Math.max(0, game.discardCooldown - dt)
  game.deployCooldown = Math.max(0, game.deployCooldown - dt)
  game.chainTimer = Math.max(0, game.chainTimer - dt)
  if (game.chainTimer <= 0) game.chain = 0
  if (game.phase !== 'battle') return
  if (dt > 0) {
    game.waveTime += dt
    resolvePreparedTactics(game)
    advanceCombat(game, dt, onAction)
  }
  if (deadline - game.waveTime < 1e-8) {
    game.waveTime = deadline
    if (game.baseHp > 0) resolveTimeout(game)
  }
  if (game.baseHp <= 0) {
    settleFeint(game)
    game.baseHp = 0
    finishCombatStats(game,'lost')
    regroupArmy(game)
    game.phase = 'lost'
    game.selected = []
    game.bossTelegraph = null
    log(game, '城堡防线失守。带着这次的构筑经验，再演一幕。', 'danger')
  } else if (game.spawnIndex >= game.schedule.length && !game.enemies.length && game.waveTime > 3) {
    settleFeint(game)
    endWave(game)
  }
}

export function tick(game, dtSeconds, onAction, beforeLastStep) {
  if (!game || !['ready', 'battle'].includes(game.phase) || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return false
  // A bounded catch-up prevents huge background-tab deltas from skipping a battle.
  game.accumulator += Math.min(2, dtSeconds)
  let steps = 0
  while (game.accumulator + 1e-8 >= STEP && steps++ < 61) {
    game.accumulator = Math.max(0, game.accumulator - STEP)
    if (game.accumulator + 1e-8 < STEP) beforeLastStep?.()
    simulationStep(game, STEP, onAction)
    if (!['ready', 'battle'].includes(game.phase)) { game.accumulator = 0; break }
  }
  return true
}
