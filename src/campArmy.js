import { waveChange } from './standingArmy.js'
import { getCardDesign } from './cardCatalog.js'
import { FIELD_LIMIT, MAX_ENEMIES, ALLIED, RECRUIT_STRENGTH } from './campaignRules.js'
import { soldierValue, grantExperience, advanceChampion, marksForStar, inheritLessons, LESSONS, veteranLevel } from './training.js'
import { faceOf, log, owns, random, uid, copies, spendCharge, effect } from './gameState.js'
import { HOSTILE, BELL_WINDUP, FORMATION_BY_ID } from './tactics.js'
import { DETACHMENTS, recruitName } from './recruitment.js'
import { JOBS } from './jobs.js'
import { GRADES, QUALITIES, ascendedGrade } from './quality.js'
import { campSlots, inCampArea } from './formation.js'
import { mergePreview, mergeWarning, materialIdentity, FUSION_COST, FUSION_BY_ID } from './forge.js'
import { professionId, professionName, fusionProfessionNames } from './professionFusion.js'
import { isBoss } from './bossRules.js'
import {syncBuildUnitStats} from './buildPassives.js'

export function recruitIdentity(card, level, source = 'card') {
  const design = getCardDesign(card)
  return {
    type: design.type, level, suit: design.suit, rank: design.rank,
    appearanceId: design.id, name: design.name,
    cardId: card.cardId ?? (typeof card.id === 'string' && card.id !== design.id ? card.id : null), source,
  }
}

export function recalls(champion, recruit) {
  if (!champion || champion.unitId || recruit.source !== 'card') return false
  return champion.pattern ? recruit.pattern === champion.pattern : recruit.cardSlot === champion.slot
}

export function muster(game, recruit) {
  const veteran = game.allies.find(unit => unit.hp > 0 && unit.id === game.champion?.unitId)
  if (game.allies.length < FIELD_LIMIT) {
    return {recruits:[recruit], reserve:[], xp:0}
  }
  if (recruit.grade >= 4) return {recruits:[], reserve:[recruit], waiting:true, xp:0}
  const trainer = veteran || game.allies.filter(unit => unit.hp > 0 && !unit.echoUntil)
    .sort((a,b) => (b.trainingXp || 0) - (a.trainingXp || 0) || b.level - a.level)[0]
  return {recruits:[], reserve:[recruit], trainer, xp:soldierValue(recruit)}
}

export function designateChampion(game, id) {
  if (game.phase !== 'ready') return false
  const unit = game.allies.find(u => u.id === id && u.hp > 0)
  if (!unit) return false
  if (game.champion?.unitId === id) return false
  for (const member of game.allies) member.standard = member.id === id
  unit.locked = true
  game.champion = { unitId:id, slot:unit.cardSlot || faceOf(unit), pattern:unit.pattern || null,
    xp:unit.trainingXp || 0, locked:true, level:unit.level, grade:unit.grade, marks:marksForStar(unit.level) }
  return true
}

export function toggleSoldierLock(game,id) {
  if (game.phase !== 'ready') return false
  const unit = game.allies.find(u=>u.id===id && u.hp>0)
  if (!unit) return false
  unit.locked = !unit.locked
  if (game.champion?.unitId === id) game.champion.locked = unit.locked
  return true
}

export function drillPreview(game, donorId, targetId) {
  if (game.phase !== 'ready' || donorId === targetId) return null
  const donor = [...game.allies, ...game.reserves].find(u => u.id === donorId && u.hp > 0)
  const target = game.allies.find(u => u.id === targetId && u.hp > 0)
  if (!donor || !target || donor.locked) return null
  const grade = ascendedGrade(target,donor)
  if (grade) return {kind:'ascend', grade, text:'融合 → ' + QUALITIES[grade].name + ' · ' + target.name}
  if (game.reserves.includes(donor)) return null
  if (professionId(target)!==professionId(donor)) {
    const result=mergePreview(game,target.id,donor.id,'profession')
    if (!result) return null
    return {kind:'profession', cost:FUSION_COST, text:professionName(target)+'＋'+professionName(donor)+' · '+(game.gold<FUSION_COST?'还缺 '+(FUSION_COST-game.gold)+' 金币':FUSION_COST+' 金币融合')}
  }
  const xp = soldierValue(donor) + copies(game,'drill-badge') + (copies(game,'training-whistle') ? 3 : 0)
  const lessons = inheritLessons(target,donor)
  const learned = lessons.filter(type => !target.lessons?.includes(type)).map(type => LESSONS[type].name)
  const level = veteranLevel(Math.min(999,(target.trainingXp || 0) + xp))
  const levelUp = level > veteranLevel(target.trainingXp) ? ' · 升至 Lv.' + level : ''
  return {kind:'drill', name:target.name, xp, lessons,
    text:target.name + ' +' + xp + '经验' + levelUp + (learned.length ? ' · 习得' + learned.join('、') : '')}

}

export function drill(game, donorId, targetId) {
  const plan = drillPreview(game,donorId,targetId)
  if (!plan) return false
  if (plan.kind === 'ascend') return forgeUnit(game,targetId,donorId,'ascend')
  if (plan.kind === 'profession') return forgeUnit(game,targetId,donorId,'profession')
  const donor = game.allies.find(u => u.id === donorId), target = game.allies.find(u => u.id === targetId)
  if (game.champion?.unitId === donorId) game.champion = null
  target.lessons = plan.lessons
  spendCharge(game,'training-whistle')
  grantExperience(game,target,plan.xp)
  if (game.champion?.unitId === targetId) advanceChampion(game,target)
  game.allies = game.allies.filter(u => u.id !== donorId)
  arrangeCamp(game)
  log(game,plan.text,'good')
  return true
}

export function moveInCamp(game, id, x, y) {
  if (game.phase !== 'ready' || !inCampArea(x,y)) return false
  const unit = game.allies.find(u => u.id === id && u.hp > 0)
  if (!unit) return false
  unit.campSpot = {x,y}
  Object.assign(unit,unit.campSpot)
  return true
}

export function addUnit(game, type, side, level = 1, { identity, reserve = false } = {}) {
  if (reserve && (side !== 'ally' || identity?.grade !== 4)) return null
  const team = reserve ? game.reserves : side === 'ally' ? game.allies : game.enemies
  if (!reserve && team.length >= (side === 'ally' ? FIELD_LIMIT : MAX_ENEMIES)) return null
  const definition = side === 'ally' ? ALLIED[type] : HOSTILE[type]
  if (!definition) return null
  const strength = side === 'ally' ? (1 + (level - 1) * 0.34) * (1 + game.upgrades.power + (game.wave - 1) * .26) : isBoss(type) ? 1 : 1 + (game.wave - 1) * 0.22
  const maxHp = Math.round(definition.hp * strength * (side === 'ally' && type === 'mage' && owns(game, 'diamond-bank') ? 1.2 : 1))
  const lane = Math.floor(random(game) * 3)
  const unit = {
    id: uid(game, side), type, side, name: definition.name, icon: definition.icon, color: definition.color,
    x: side === 'ally' ? 100 + random(game) * 50 : 920 + random(game) * 48,
    y: 205 + lane * 43 + random(game) * 17,
    hp: maxHp, maxHp, atk: Math.round(definition.atk * strength),
    heal: definition.heal ? Math.round(definition.heal * strength) : 0,
    range: definition.range, speed: definition.speed, period: definition.period,
    cooldown: random(game) * 0.4, level, attacks: 0, shield: 0,
    attackTimer: 0, hitTimer: 0, breach: definition.breach || 0,
  }
  if (type === 'bellkeeper') unit.bellTimer = BELL_WINDUP
  team.push(unit)
  if (side === 'ally') {
    const design = getCardDesign(identity || { type })
    Object.assign(unit, { suit: design.suit, rank: design.rank, appearanceId: design.id, name: design.name, className: definition.name })
    unit.jobId = identity?.pattern ? DETACHMENTS[identity.pattern].job : design.jobId
    const job = JOBS[unit.jobId]
    if (identity?.variantRank) unit.variantRank = identity.variantRank
    unit.cardSlot = identity?.cardSlot || faceOf(design)
    if (identity?.pattern) {
      unit.pattern = identity.pattern
      unit.name = recruitName(unit.pattern, identity.grade ?? 0)
      unit.statBonus = identity.statBonus ?? 0
    }
    unit.trainingXp = 0
    unit.grade = identity?.grade ?? 0
    if (unit.grade===4 && identity?.source==='card') unit.legendGuard=true
    unit.locked = false
    const force = RECRUIT_STRENGTH * (1 + GRADES[Math.min(unit.grade,4)].boost / 100) * (1 + (unit.statBonus || 0) / 100)
    unit.maxHp = unit.hp = Math.round(unit.maxHp * force * (job.hp || 1))
    unit.atk = Math.round(unit.atk * force * (job.atk || 1))
    unit.heal = Math.round(unit.heal * force)
    unit.speed *= job.speed || 1
    unit.period *= job.period || 1
    unit.range = job.range || unit.range
    if (!reserve && identity && recalls(game.champion,identity)) {
      unit.standard = true
      game.champion.level = unit.level
      game.champion.marks = Math.max(game.champion.marks, marksForStar(unit.level))
      game.champion.grade = unit.grade
      unit.locked = !!game.champion.locked
      game.champion.unitId = unit.id
      grantExperience(game,unit,game.champion.xp)
    }
    game.stats.summoned++
    syncBuildUnitStats(game,unit,{reason:'新兵按已拥有的构筑被动结算永久攻疗'})
  }
  return unit
}

export function fieldReserve(game,id) {
  if (game.phase !== 'ready' || game.allies.length >= FIELD_LIMIT) return false
  const index = game.reserves.findIndex(unit => unit.id === id)
  if (index < 0) return false
  const [unit] = game.reserves.splice(index,1)
  game.allies.push(unit)
  arrangeCamp(game)
  return true
}

export function arrangeCamp(game) {
  const slots=campSlots(game.formation)
  const placed=game.allies.filter(u=>u.campSpot)
  for (const u of placed) Object.assign(u,u.campSpot)
  for (const u of game.allies.filter(unit=>!unit.campSpot)) {
    const melee=u.range<=100
    const preference=melee?[0,1,4,2,3]:[2,3,4,0,1]
    const at=preference.map(i=>slots[i]).find(slot=>placed.every(p=>Math.hypot(p.x-slot.x,p.y-slot.y)>42))
    if (at) Object.assign(u,at)
    placed.push(u)
  }
}

export function setFormation(game, id) {
  if (game.phase !== 'ready' || !Object.hasOwn(FORMATION_BY_ID, id) || game.formation === id) return false
  for (const unit of game.allies) delete unit.campSpot
  game.formation = id
  arrangeCamp(game)
  return true
}

export function promotionPreview(game, leaderId, donorId) {
  return mergePreview(game, leaderId, donorId, 'promote')
}

export function promotionWarning(game,leaderId,donorId) {
  return mergeWarning(game,leaderId,donorId,'promote')
}

export function drillMaterialWarning(game,donorId,targetId) {
  const plan=drillPreview(game,donorId,targetId)
  if(!plan) return null
  if(plan.kind!=='drill') return mergeWarning(game,targetId,donorId,plan.kind)
  const donor=game.allies.find(u=>u.id===donorId),target=game.allies.find(u=>u.id===targetId)
  const main=materialIdentity(target),material=materialIdentity(donor)
  return {kind:'drill',leader:main,donor:material,title:'传授会消耗副兵',
    identity:'保留接收者身份与'+main.quality+'品质，副兵品质不会转移。',
    attributes:'同职业传授只提供经验与已学传承技，不合入副兵基础属性；升星请使用工坊。',
    training:'本次提供 '+plan.xp+' 经验，受 999 经验上限限制。',lostXp:Math.max(0,main.xp+plan.xp-999)}
}

export function forgeUnit(game, leaderId, donorId, kind) {
  const result = mergePreview(game, leaderId, donorId, kind)
  const cost = kind==='profession' || FUSION_BY_ID[kind] ? FUSION_COST : 0
  if (!result || game.gold < cost) return false
  const leader = [...game.allies, ...game.reserves].find(unit => unit.id === leaderId)
  const donor = [...game.allies, ...game.reserves].find(unit => unit.id === donorId)
  const previousBuildStats=leader.buildPassiveStats
  game.gold -= cost
  Object.assign(leader, result)
  if (game.champion?.unitId === donorId) game.champion = null
  leader.standard = leader.id === game.champion?.unitId
  if (leader.standard) {
    game.champion.grade = leader.grade
    game.champion.xp = leader.trainingXp || 0
    game.champion.level = Math.max(game.champion.level,leader.level)
    game.champion.marks = Math.max(game.champion.marks, marksForStar(leader.level))
  }
  game.allies = game.allies.filter(unit => unit !== donor)
  game.reserves = game.reserves.filter(unit => unit !== donor)
  if (kind === 'ascend') {
    delete leader.legendGuard
    if (leader.pattern) leader.name = recruitName(leader.pattern,leader.grade)
    game.fusions++
    const quality = QUALITIES[leader.grade]
    effect(game,'burst',leader.x,leader.y-22,quality.name+'降临',quality.color)
    log(game,leader.name+'融合为'+quality.name+' · 生命 '+leader.maxHp+' · 攻击 '+leader.atk,'epic')
  } else if (kind === 'promote') {
    game.promotions++
    log(game, `${leader.name}升至 ${leader.level} 星 · 攻击 ${leader.atk} · 生命上限 ${leader.maxHp}`, 'epic')
  } else if (kind === 'profession') {
    game.fusions++
    effect(game,'burst',leader.x,leader.y-22,'职业融合',leader.color)
    log(game,leader.name+'融合'+professionName(donor)+' · '+fusionProfessionNames(leader).join('＋')+' · 攻击 '+leader.atk+' · 生命 '+leader.maxHp,'epic')
  } else {
    const recipe = FUSION_BY_ID[kind]
    leader.fusionPartner = donor.appearanceId
    leader.fusion = kind
    leader.skillCharge = 0
    game.fusions++
    log(game, `${leader.name}转职${recipe.name} · 习得${recipe.skill}`, 'epic')
  }
  syncBuildUnitStats(game,leader,{previous:previousBuildStats,reason:'正式融合或升星后同步永久加成；未重复继承副兵加成'})
  if (game.phase === 'ready') arrangeCamp(game)
  return true
}

export function promote(game, leaderId, donorId) {
  return forgeUnit(game, leaderId, donorId, 'promote')
}

export function commission(game, id, branch) {
  if (game.phase !== 'ready' || !['guard', 'assault'].includes(branch)) return false
  if (game.allies.some(unit => unit.command)) return false
  const leader = game.allies.find(unit => unit.id === id)
  if (!leader || leader.level < 2) return false
  leader.command = branch
  waveChange(leader, () => {
    if (branch === 'guard') {
      leader.hp += Math.round(leader.maxHp * 0.4)
      leader.maxHp += Math.round(leader.maxHp * 0.4)
    } else {
      leader.atk = Math.round(leader.atk * 1.3)
      leader.heal = Math.round(leader.heal * 1.3)
    }
  })
  log(game, `${leader.name}就任${branch === 'guard' ? '壁垒' : '先遣'}统领`, 'epic')
  return true
}

export function vanguard(game) {
  return game.allies.slice().sort((a, b) => Number(!!b.command) - Number(!!a.command) || Number(!!b.crowned) - Number(!!a.crowned)
    || Number(!!b.fusion) - Number(!!a.fusion) || b.level - a.level || (b.atk + b.heal - a.atk - a.heal) || b.maxHp - a.maxHp).slice(0, 16)
}
