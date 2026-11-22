import { seedNumber, random, log, effect } from './gameState.js'
import { isBackline, HOSTILE } from './tactics.js'
import { isBoss } from './bossRules.js'
import { MAX_ENEMIES } from './campaignRules.js'
import { addUnit } from './campArmy.js'

export function waveSchedule(seed, wave, difficulty = 'standard') {
  const rollState = { rng: seedNumber(String(seed) + '/wave/' + wave) }
  const count = [0, 9, 11, 10, 10, 10, 8, 13, 14, 15, 16, 17, 12][wave]
  if (!count) return []
  const schedule = []
  for (let i = 0; i < count; i++) {
    let type = 'raider'
    const roll = random(rollState)
    if (wave >= 2 && roll < 0.26) type = 'bat'
    else if (wave >= 2 && roll < 0.45) type = 'archer'
    else if (wave >= 3 && roll < 0.65) type = 'brute'
    else if (wave >= 4 && roll < 0.82) type = 'warlock'
    schedule.push({ at: 0, type })
  }
  if (wave >= 3) {
    // Replace part of an existing group, preserving the advertised force size.
    schedule[1].type = 'bellkeeper'
    if (difficulty === 'veteran') schedule[Math.floor(count * .35)].type = 'bellkeeper'
  }
  if (wave === 3) schedule.push({ at: 0, type: 'brute' })
  if (wave === 5) schedule.push({ at: 0, type: 'brute' }, { at: 0, type: 'brute' }, { at: 0, type: 'warlock' })
  if (wave === 6) schedule.push({ at: 0, type: 'boss' })
  if (wave >= 8) schedule[Math.floor(count * .6)].type = 'bellkeeper'
  if (wave >= 11) schedule[Math.floor(count * .8)].type = 'bellkeeper'
  if (wave >= 7) {
    schedule.push({at:0,type:'brute'})
    if (wave >= 9) schedule.push({at:0,type:'warlock'})
    if (wave >= 10) schedule.push({at:0,type:'brute'})
  }
  if (wave === 12) schedule.push({at:0,type:'finalBoss'})
  return schedule.sort((a,b) => Number(isBackline(a.type) || isBoss(a.type)) - Number(isBackline(b.type) || isBoss(b.type)))
}

export function makeSchedule(game) {
  game.schedule = waveSchedule(game.seed, game.wave, game.difficulty)
  game.spawnIndex = 0
}

export function spawnEnemies(game) {
  if (game.spawnIndex >= game.schedule.length) return
  const columnStep = Math.min(44, 185 / Math.max(1, Math.ceil(game.schedule.length / 4) - 1))
  while (game.spawnIndex < game.schedule.length && game.schedule[game.spawnIndex].at <= game.waveTime && game.enemies.length < MAX_ENEMIES) {
    const spawn = game.schedule[game.spawnIndex++]
    const level = isBoss(spawn.type) ? 3 : game.wave >= 8 ? 3 : game.wave >= 4 ? 2 : 1
    const unit = addUnit(game, spawn.type, 'enemy', level)
    const slot = game.spawnIndex - 1
    unit.x = 770 + Math.floor(slot / 4) * columnStep + (slot % 2) * 9
    unit.y = 202 + (slot % 4) * 36 + (Math.floor(slot / 4) % 2) * 9
    if (unit.type === 'bellkeeper' && game.enemies.some(other => other !== unit && other.type === 'bellkeeper')) unit.bellTimer += 4
    game.waveSpawned++
    if (isBoss(spawn.type)) {
      game.bossTimer = 5
      unit.bossCasts = 0
      const definition = HOSTILE[spawn.type]
      log(game, definition.name + '降临 · 留意技能标记与蓄力提示。', 'danger')
      effect(game, 'burst', 870, 180, definition.name, definition.color)
    }
  }
}
