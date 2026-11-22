import { lastingStat } from './standingArmy.js'
import { ascendedGrade } from './quality.js'
import { earnedTraining, trainingBonus, soldierValue, inheritLessons } from './training.js'
import { professionId, combinedProfessionJobs } from './professionFusion.js'
export const FUSION_COST = 5
export const ROLE_NAMES = { knight: '铁卫', healer: '牧师', ranger: '游侠', mage: '术士' }

export const FUSIONS = [
  { id: 'paladin', name: '圣盾骑士', types: ['knight', 'healer'], frame: 0, color: '#e9be87', skill: '圣盾祷言', description: '为生命比例最低的友军赋盾，盾量为 20 加自身治疗力。护盾取较高值。' },
  { id: 'warden', name: '铁棘猎卫', types: ['knight', 'ranger'], frame: 1, color: '#dbb879', skill: '猎王重矢', description: '对射程内当前生命最高的敌人追加一击，造成 140% 攻击伤害。' },
  { id: 'starblade', name: '星刃卫士', types: ['knight', 'mage'], frame: 2, color: '#b4a9fa', skill: '裂星斩', description: '以最近的敌人为中心斩击最多三名敌人，各造成 75% 攻击伤害。' },
  { id: 'bard', name: '林歌医师', types: ['healer', 'ranger'], frame: 3, color: '#abd4a2', skill: '林间和声', description: '为生命比例最低的两名伤员各恢复 12 加自身 60% 治疗力的生命。' },
  { id: 'priest', name: '绯晶司祭', types: ['healer', 'mage'], frame: 4, color: '#e99db5', skill: '绯晶汲取', description: '对最近的敌人造成 90% 攻击伤害，为一名伤员恢复 8 加实际伤害一半的生命。' },
  { id: 'frostbow', name: '霜弦游侠', types: ['ranger', 'mage'], frame: 5, color: '#93cde3', skill: '寒弦双箭', description: '向最近的两名敌人各射一箭，造成 50% 攻击伤害，并将其下次普通行动最多推迟 0.8 秒。' },
]
export const FUSION_BY_ID = Object.fromEntries(FUSIONS.map(recipe => [recipe.id, recipe]))
export function recipeFor(left, right) {
  if (left === right) return null
  return FUSIONS.find(recipe => recipe.types.includes(left) && recipe.types.includes(right)) || null
}

export function mergeKind(leader, donor) {
  if (!leader || !donor || leader.id === donor.id || leader.hp <= 0 || donor.hp <= 0 ||
      donor.locked) return null
  if (ascendedGrade(leader, donor)) return 'ascend'
  if (donor.command || donor.crowned) return null
  if (professionId(leader) !== professionId(donor)) return 'profession'
  return leader.level === donor.level && leader.level < 3 ? 'promote' : null
}

function legacyPair(leader,donor,kind) {
  const recipe=Object.hasOwn(FUSION_BY_ID,kind) && FUSION_BY_ID[kind]
  return !!recipe && leader && donor && leader.id!==donor.id && leader.hp>0 && donor.hp>0 &&
    !donor.locked && !donor.command && !donor.crowned && !leader.fusion && !donor.fusion &&
    leader.level===2 && donor.level===2 && leader.type!==donor.type &&
    recipe.types.includes(leader.type) && recipe.types.includes(donor.type) && !ascendedGrade(leader,donor)
}

export function workshopPairs(game) {
  const pairs = { promote: [], ascend: [], profession: [] }
  for (const recipe of FUSIONS) pairs[recipe.id] = []
  if (game.phase !== 'ready') return pairs
  const members = [...game.allies, ...(game.reserves || [])]
  for (const leader of members) for (const donor of members) {
    const kind = mergeKind(leader, donor)
    if (kind && (kind === 'ascend' || (!game.reserves?.includes(leader) && !game.reserves?.includes(donor)))) pairs[kind].push({ leader, donor })
    if (!game.reserves?.includes(leader) && !game.reserves?.includes(donor)) for (const recipe of FUSIONS) {
      if (legacyPair(leader,donor,recipe.id)) pairs[recipe.id].push({leader,donor})
    }
  }
  return pairs
}

export function mergePreview(game, leaderId, donorId, kind) {
  if (game.phase !== 'ready') return null
  const members = [...game.allies, ...(game.reserves || [])]
  const leader = members.find(unit => unit.id === leaderId)
  const donor = members.find(unit => unit.id === donorId)
  if ((game.reserves?.includes(leader) || game.reserves?.includes(donor)) && kind !== 'ascend') return null
  if (!kind || (mergeKind(leader, donor) !== kind && !legacyPair(leader,donor,kind))) return null
  const ascending = kind === 'ascend'
  const profession = kind === 'profession'
  const share = ascending ? .5 : profession ? 1 : kind === 'promote' ? .8 : .6
  const trained = earnedTraining(donor, game.wave)
  const retained = earnedTraining(leader, game.wave)
  const xp = Math.min(999,(leader.trainingXp || 0) + (ascending ? soldierValue(donor) : donor.trainingXp || 0))
  const before = trainingBonus(leader.trainingXp || 0,game.wave), after = trainingBonus(xp,game.wave)
  const gainHp = after.hp-before.hp, gainAtk=after.atk-before.atk
  const maxHp = leader.maxHp + gainHp + Math.round((lastingStat(donor,'maxHp') - trained.hp) * share)
  const skills=[...new Set([leader.fusion,donor.fusion,...(leader.fusionSkills || []),...(donor.fusionSkills || [])].filter(Boolean))]
  return {
    ...(ascending ? {grade:leader.grade + 1} : {}),
    ...(profession || leader.fusionJobs || donor.fusionJobs ? {fusionJobs:combinedProfessionJobs(leader,donor)} : {}),
    ...(skills.length && (profession || leader.fusionSkills || donor.fusionSkills || donor.fusion) ? {fusionSkills:skills,skillCharge:leader.skillCharge || 0} : {}),
    ...(profession ? {range:Math.max(leader.range,donor.range), speed:Math.max(leader.speed,donor.speed), period:Math.min(leader.period,lastingStat(donor,'period'))} : {}),
    lessons:inheritLessons(leader, donor),
    trainingXp:xp, trainingGrowth:{hp:retained.hp + gainHp, atk:retained.atk + gainAtk}, level: ascending ? Math.max(leader.level, donor.level) : profession ? leader.level : leader.level + 1, maxHp, hp: Math.min(maxHp, leader.hp + gainHp + Math.round(Math.max(0,donor.hp-trained.hp) * share)),
    atk: leader.atk + gainAtk + Math.round((lastingStat(donor,'atk')-trained.atk) * share), heal: leader.heal + (leader.type === 'healer' || profession && (leader.heal>0 || donor.heal>0) ? gainAtk : 0) + Math.round(Math.max(0,lastingStat(donor,'heal')-trained.atk) * share),
  }
}
