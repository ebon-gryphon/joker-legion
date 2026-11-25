import { seedNumber, random, log, effect } from './gameState.js'
import { isBackline, HOSTILE } from './tactics.js'
import { isBoss } from './bossRules.js'
import { MAX_ENEMIES } from './campaignRules.js'
import { addUnit } from './campArmy.js'

// Each of the four formations has a twelve-member core and up to four additional starting slots.
const COMPANIES = [
  ['banner','splitter','archer','bat','raider','hunter','archer','bat','bat','cantor','brute','archer','raider','banner','bat','archer'],
  ['cantor','brute','banner','bat','archer','raider','splitter','brute','bat','brute','archer','splitter','brute','warlock','bat','splitter'],
  ['hunter','hunter','brute','bat','bat','raider','banner','splitter','bat','brute','splitter','brute','cantor','archer','bat','raider'],
  ['splitter','cantor','brute','bat','hunter','raider','archer','splitter','bat','brute','banner','cantor','splitter','raider','warlock','bat'],
]
const rear = type => isBackline(type) || isBoss(type)

export function waveSchedule(seed, wave, difficulty = 'standard', mode='standard') {
  const rollState = { rng: seedNumber(String(seed) + '/wave/' + wave) }
  if(wave>12 && mode==='endless') {
    const company=COMPANIES[Math.floor(random(rollState)*COMPANIES.length)]
    const count=12+Math.floor(random(rollState)*5)
    const types=company.slice(0,count)
    if(wave%6===0){
      // Royal escorts bring bowmen in the ritualists' places.
      for(let i=0;i<types.length;i++)if(types[i]==='cantor')types[i]='archer'
      types[types.length-1]=wave%12===0?'finalBoss':'boss'
    }
    return types.map(type=>({type,at:0}))
  }
  const count = [0, 9, 11, 10, 10, 10, 8, 11, 12, 12, 12, 12, 10][wave]
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
  game.encounterVersion=1
  game.schedule = waveSchedule(game.seed, game.wave, game.difficulty, game.mode)
  game.spawnIndex = 0
}

export function spawnPosition(schedule,index,wave) {
  if(wave<=6){
    const column=Math.floor(index/4),row=index%4
    return {x:770+column*44+(row%2)*9,y:202+row*36+(column%2)*9}
  }
  if(wave>12 && schedule[index].type==='bat'){
    const wing=schedule.slice(0,index).filter(slot=>slot.type==='bat').length
    return {x:840+Math.floor(wing/2)*62,y:wing%2?348:152}
  }
  const back=rear(schedule[index].type)
  const group=schedule.filter(entry=>rear(entry.type)===back)
  const slot=schedule.slice(0,index).filter(entry=>rear(entry.type)===back).length
  const columns=Math.ceil(group.length/4),column=Math.floor(slot/4),row=slot%4
  const x=back?908-(columns-1-column)*58:635+column*58
  return {x:x+(row%2)*16,y:177+row*49+(column%2)*14+(back?6:0)}
}

export function spawnEnemies(game) {
  if (game.spawnIndex >= game.schedule.length) return
  const seats=MAX_ENEMIES-game.enemies.length
  if(game.schedule.length-game.spawnIndex>seats)game.schedule.length=game.spawnIndex+seats
  while (game.spawnIndex < game.schedule.length) {
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
