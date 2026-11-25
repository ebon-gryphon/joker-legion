import { isBoss } from './bossRules.js'

export const HOSTILE = {
  raider: { name: '流寇', icon: '†', color: '#e87876', hp: 96, atk: 19, range: 38, speed: 42, period: 1.2, breach: 1 },
  bat: { name: '夜翼', icon: '⌁', color: '#c08ad9', hp: 52, atk: 12, range: 33, speed: 64, period: 0.9, breach: 1 },
  archer: { name: '暗弓手', icon: '↟', color: '#d4948a', hp: 82, atk: 20, range: 195, speed: 33, period: 1.5, breach: 1 },
  brute: { name: '碎盾巨兵', icon: '♜', color: '#d68063', hp: 320, atk: 33, range: 44, speed: 28, period: 1.6, breach: 1 },
  warlock: { name: '猩红术士', icon: '✦', color: '#d17ad2', hp: 140, atk: 28, range: 215, speed: 30, period: 1.85, breach: 1 },
  bellkeeper: { name: '鸣钟使', icon: '♢', color: '#e4ad73', hp: 490, atk: 18, range: 245, speed: 29, period: 1.85, breach: 1 },
  boss: { name: '无冕之王', icon: '♛', color: '#ef667f', hp: 6200, atk: 64, range: 65, speed: 22, period: 1.5, breach: 100 },
  finalBoss: { name: '缀命皇后', icon: '♕', color: '#c89cff', hp: 12800, atk: 92, range: 175, speed: 20, period: 1.4, breach: 100 },
}

export const FORMATIONS = [
  { id: 'guard', name: '护卫阵', color: '#9bb9df', summary: '铁卫护住前列', rule: '铁卫承受的普通攻击直击伤害降低 20%。' },
  { id: 'hunt', name: '猎手阵', color: '#e0bb85', summary: '远程集火后排', rule: '游侠和术士前移，优先射击射程内的鸣钟使，再瞄准暗弓手与猩红术士。普攻直击这些目标时伤害提高 30%。' },
  { id: 'spread', name: '散兵阵', color: '#bba3e7', summary: '分散承受轰击', rule: '全军承受的溅射与首领轰击伤害降低 40%，牧师普通治疗量降低 20%。' },
]
export const FORMATION_BY_ID = Object.fromEntries(FORMATIONS.map(item => [item.id, item]))
export const DIFFICULTIES = {
  standard: { name: '标准', lifeMax:12,castle:12 },
  veteran: { name: '险境', lifeMax:8,castle:8 },
}
export const BELL_WINDUP = 8
export const BELL_INTERVAL = 16
export const SILENT_BOUNTY = 3
export const BELL_SUMMON=Object.freeze({type:'raider',x:1000})
// Compatibility export for old callers: ringing now summons a real enemy.
export function tollDamage() { return 0 }
export function isBackline(type) { return ['bellkeeper', 'archer', 'warlock'].includes(type) }

export function nextChime(game) {
  let first = null
  for (const enemy of game.enemies) {
    if (enemy.type !== 'bellkeeper' || enemy.hp <= 0 || enemy.bellTimer > BELL_WINDUP) continue
    if (!first || enemy.bellTimer < first.bellTimer) first = enemy
  }
  return first
}

export function scoutWave(schedule) {
  const counts = new Map(), bells = []
  let bossAt = null
  for (const spawn of schedule) {
    counts.set(spawn.type, (counts.get(spawn.type) || 0) + 1)
    if (spawn.type === 'bellkeeper') bells.push(spawn.at)
    if (isBoss(spawn.type)) bossAt = spawn.at
  }
  const enemies = [...counts].map(([type, count]) => ({ type, count, name: HOSTILE[type].name }))
  return { enemies, total: schedule.length, bells, bossAt }
}
