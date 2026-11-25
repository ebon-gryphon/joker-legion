import {ENDLESS,endlessBudget,hasRearguard,lastBatchTime} from './endless.js'
import { seedNumber, random, log, effect } from './gameState.js'
import { isBackline, HOSTILE } from './tactics.js'
import { isBoss } from './bossRules.js'
import { MAX_ENEMIES } from './campaignRules.js'
import { addUnit } from './campArmy.js'

export function waveSchedule(seed, wave, difficulty = 'standard', mode='standard') {
  const rollState = { rng: seedNumber(String(seed) + '/wave/' + wave) }
  if(wave>12 && mode==='endless') {
    const packs=[['banner','archer','splitter'],['cantor','brute','banner'],['hunter','raider','brute'],['splitter','warlock','cantor']]
    const budget=endlessBudget(wave)
    if(wave>=18)packs.push(['banner','splitter','hunter'],['cantor','brute','archer'])
    if(wave>=25)packs.push(['banner','cantor','splitter'],['hunter','bat','splitter'])
    const queue=[]
    for(let i=0;i<budget;i+=3){
      const pack=packs[Math.floor(random(rollState)*packs.length)]
      for(const type of pack.slice(0,budget-i))queue.push({type,at:Math.floor(queue.length/ENDLESS.batchSize)*ENDLESS.batchInterval})
    }
    if(wave%6===0)queue[0].type=wave%12===0?'finalBoss':'boss'
    if(hasRearguard(wave)) {
      const last=queue.slice(-ENDLESS.reserveSize)
      for(const unit of last)unit.at=lastBatchTime(wave)
      if(wave%3===1){last[0].type='banner';last[1].type='splitter'}
      if(wave%3===2){last[0].type='banner';last[1].type='splitter';last[2].type='cantor'}
    }
    return queue
  }
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
  if(wave>=4) schedule[0].type='banner'
  if(wave>=5) schedule[2].type='splitter'
  if(wave>=7) schedule[4].type='hunter'
  if(wave>=9) schedule[5].type='cantor'
  return schedule.sort((a,b) => Number(isBackline(a.type) || isBoss(a.type)) - Number(isBackline(b.type) || isBoss(b.type)))
}

export function makeSchedule(game) {
  if(game.mode==='endless')game.endlessRevision=2
  game.schedule = waveSchedule(game.seed, game.wave, game.difficulty, game.mode)
  game.spawnIndex = 0
}

export function spawnPosition(schedule,index,wave) {
  const slot=wave<=12?index:index%ENDLESS.batchSize
  const columnStep=Math.min(44,185/Math.max(1,Math.ceil(schedule.length/4)-1))
  const back=wave>12 && isBackline(schedule[index].type)?120:0
  return {x:770+Math.floor(slot/4)*columnStep+(slot%2)*9+back,
    y:202+(slot%4)*36+(Math.floor(slot/4)%2)*9}
}

export function spawnEnemies(game) {
  if (game.spawnIndex >= game.schedule.length) return
  while (game.spawnIndex < game.schedule.length && game.schedule[game.spawnIndex].at <= game.waveTime && game.enemies.length < MAX_ENEMIES) {
    const spawn = game.schedule[game.spawnIndex++]
    const level = isBoss(spawn.type) ? 3 : game.wave >= 8 ? 3 : game.wave >= 4 ? 2 : 1
    const unit = addUnit(game, spawn.type, 'enemy', level)
    Object.assign(unit,spawnPosition(game.schedule,game.spawnIndex-1,game.wave))
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
