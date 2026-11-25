import { lastingStat } from './standingArmy.js'
import { log } from './gameState.js'
import { gradeOf } from './quality.js'
import {withBuildStatMutation} from './buildPassives.js'
export const VETERAN_MARKS = [0, 3, 8, 15, 25, 40, 60]
export const veteranLevel = xp => VETERAN_MARKS.filter(mark => (xp || 0) >= mark).length
export function trainingProgress(xp = 0) {
  const level = veteranLevel(xp)
  return { level, next: VETERAN_MARKS[level], start: VETERAN_MARKS[level - 1] }
}

const regimentLessons = {
  knight:{name:'铁卫格挡', text:'每三次行动，为自己增加相当于生命上限 4% 的护盾。'},
  healer:{name:'战地包扎', text:'每三次行动，为伤势最重的友军恢复 6 加自身攻击 15% 的生命。'},
  ranger:{name:'追击弩箭', text:'每三次行动，向附近一名敌人追加一箭，造成 30% 攻击伤害。'},
  mage:{name:'余烬弹', text:'每三次行动，对附近最多两名敌人各造成 20% 攻击伤害。'},
}
// Contracts teach a lighter version of their profession. Legacy jobs teach their regiment's art.
export const LESSONS = {
  ...regimentLessons,
  blade:{name:'横扫刀势', power:.22, targets:2, text:'每三次行动，对身边至多两名敌人各造成 22% 攻击伤害。'},
  priest:{...regimentLessons.healer, name:'祈愈术'},
  pike:{name:'贯阵枪法', power:.28, targets:2, line:true, text:'每三次行动，刺击附近同一路线上的至多两人，各造成 28% 攻击伤害。'},
  archer:{name:'远射', power:.5, reach:260, opening:true, text:'每波首次行动，向附近 260 距离内的一名敌人追加 50% 攻击伤害。'},
  cavalry:{name:'破阵冲锋', power:.65, opening:true, text:'每波首次行动，对附近一名敌人追加 65% 攻击伤害。'},
  fire:{...regimentLessons.mage, name:'余烬引燃', power:.20, targets:2},
  shield:{...regimentLessons.knight, name:'举盾'},
  assassin:{name:'摘首', power:.45, weakest:true, text:'每三次行动，追击附近生命最低的敌人，造成 45% 攻击伤害。'},
  outrider:{name:'奔射', power:.20, targets:2, text:'每三次行动，向附近至多两人各射一箭，造成 20% 攻击伤害。'},
  duelist:{name:'连斩', power:.45, text:'每三次行动，对最近的敌人追加 45% 攻击伤害。'},
  ward:{name:'护佑祷言', text:'每三次行动，给生命比例最低的友军增加 6 加自身攻击 10% 的护盾。'},
  sovereign:{name:'王剑', power:.60, execute:true, text:'每三次行动，斩击附近生命低于一半的一名敌人，造成 60% 攻击伤害。'},
}
export function inheritLessons(target, donor) {
  const lessons = new Set([...(target.lessons || []), ...(donor.lessons || [])])
  if ((target.jobId || target.type) !== (donor.jobId || donor.type)) {
    lessons.add(Object.hasOwn(LESSONS,donor.jobId) ? donor.jobId : donor.type)
  }
  return [...lessons]
}
export const soldierValue = unit => (unit.trainingXp || 0) + 2 ** unit.level + gradeOf(unit).xp + Math.floor((unit.statBonus || 0) / 20)
export function trainingBonus(xp, wave) {
  const tier = veteranLevel(xp) - 1
  const scale = 1 + (wave - 1) * .22
  const strength = Math.min(xp,25) + Math.min(35,Math.max(0,xp-25)) * .55 + Math.max(0,xp-60) * .15
  return { hp: Math.round((strength * 5 + tier * 16) * scale), atk: Math.round((strength * .82 + tier * 3) * scale) }
}
export function earnedTraining(unit, wave) {
  return unit.trainingGrowth ?? trainingBonus(unit.trainingXp || 0, wave)
}

export function grantExperience(game, unit, amount, announce = true) {
  if (!amount || !unit) return
  return withBuildStatMutation(game,unit,()=>grantExperienceBase(game,unit,amount,announce))
}
function grantExperienceBase(game, unit, amount, announce) {
  const xp = unit.trainingXp || 0
  const next = Math.min(999, xp + amount)
  const before = trainingBonus(xp, game.wave), after = trainingBonus(next, game.wave)
  const earned = earnedTraining(unit, game.wave)
  unit.trainingGrowth = { hp: earned.hp + after.hp - before.hp, atk: earned.atk + after.atk - before.atk }
  unit.hp += after.hp - before.hp
  unit.maxHp += after.hp - before.hp
  unit.atk += after.atk - before.atk
  if (unit.type === 'healer' || unit.fusionJobs?.some(id=>['priest','medic','bell','thorn','ward'].includes(id))) unit.heal += after.atk - before.atk
  unit.trainingXp = next
  if (announce && veteranLevel(next) > veteranLevel(xp)) {
    log(game, unit.name + '升至历练 ' + veteranLevel(next) + ' 级 · 生命 +' + (after.hp-before.hp) + '，攻击 +' + (after.atk-before.atk), 'good')
  }
  if (unit.id === game.champion?.unitId) game.champion.xp = next
}

export const marksForStar = level => [0, 0, 2, 5][level]

export function championProgress(champion) {
  if (champion.level >= 3) return '三星已成'
  const target = marksForStar(champion.level + 1)
  return '晋升' + (champion.level + 1) + '星 · ' + champion.marks + '/' + target
}

// A clear with the captain alive or one voluntary feeding earns one mark.
export function advanceChampion(game, unit) {
  const captain = game.champion
  if (captain?.unitId !== unit.id || captain.level >= 3) return
  captain.marks = Math.min(5,captain.marks + 1)
  const level = captain.marks >= 5 ? 3 : captain.marks >= 2 ? 2 : 1
  if (level <= captain.level) return
  return withBuildStatMutation(game,unit,()=>advanceChampionStats(game,unit,captain,level))
}
function advanceChampionStats(game,unit,captain,level) {
  const factor = (1 + (level - 1) * .34) / (1 + (unit.level - 1) * .34)
  for (const key of ['maxHp','atk','heal']) {
    const base = lastingStat(unit,key)
    const growth = Math.round(base * factor) - base
    unit[key] += growth
    if (key === 'maxHp') unit.hp += growth
  }
  unit.level = captain.level = level
}
