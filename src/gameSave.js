import { inCampArea } from './formation.js'
import { addUnit, arrangeCamp } from './campArmy.js'
import { lastingStat } from './standingArmy.js'
import { grantExperience, marksForStar, trainingBonus, LESSONS } from './training.js'
import { REPEATED_FACES } from './outfits.js'
import { CARD_RANKS, getCardDesign } from './cardCatalog.js'
import { recruitLook, recruitName, DETACHMENTS } from './recruitment.js'
import {
  DOCTRINES, STEP, RANKS, SUITS, PRINTS_PER_WAVE, JOKER_BY_ID, ALLIED, MAX_ENEMIES, OLD_FIELD_LIMIT,
  FIELD_LIMIT, WAVES, HANDS_PER_WAVE
} from './campaignRules.js'
import { deckFaces, slotOf, faceOf, emptyTacticsReport, log } from './gameState.js'
import { REGIMENTS, ORDER_BOOK, MAX_ORDER_LEVEL } from './orders.js'
import { shiftedRank, extraHandPrice } from './deck.js'
import { HOSTILE, FORMATION_BY_ID, SILENT_BOUNTY, BELL_INTERVAL } from './tactics.js'
import { QUALITIES } from './quality.js'
import { FUSION_BY_ID } from './forge.js'
import { validFusionJobs } from './professionFusion.js'
import { LURE_TRAVEL, LURE_REVEAL } from './performers.js'
import { PAY_WAGONS } from './convoy.js'
import { createGame } from './campaign.js'
import { makeSchedule, spawnEnemies } from './waveSchedule.js'
import { PERFORMANCES } from './performance.js'
import { BOSS_SKILLS, isBoss } from './bossRules.js'
import { validCombatStats, migrateCombatStats, discardInvalidScoreMetadata } from './combatStats.js'
import { validOnboarding, migrateOnboarding } from './onboarding.js'

const RESERVED = new Set(['__proto__', 'constructor', 'prototype'])

function validUniform(unit) {
  if (unit.variantRank == null) return true
  return Object.hasOwn(REPEATED_FACES, unit.pattern) && CARD_RANKS.includes(unit.variantRank) &&
    recruitLook(unit.pattern,unit.variantRank).design.id === unit.appearanceId
}

export function snapshotGame(game) {
  if (!game || game.version !== 1) return null
  return JSON.parse(JSON.stringify({ ...game, effects: [] }))
}

export function restoreGame(snapshot) {
  // Never merge persisted data into live objects; whitelist and validate a full snapshot.
  try {
    const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : JSON.parse(JSON.stringify(snapshot))
    discardInvalidScoreMetadata(data)
    if (!validExpedition(data) || !validDeck(data) || !validHandAndTricks(data) ||
        !validArmies(data) || !validWave(data) || !validResources(data) || !validProgress(data)) return null
    return migrateExpedition(data)
  } catch { return null }
}

function validExpedition(data) {
  if (!data || data.version !== 1 || !DOCTRINES.some(item => item.id === data.doctrine)) return false
  if (!['ready', 'battle', 'shop', 'won', 'lost'].includes(data.phase) || !Number.isInteger(data.wave) || data.wave < 1 || data.wave > WAVES.length) return false
  if (data.campaignLength !== undefined && ![6,WAVES.length].includes(data.campaignLength)) return false
  if (data.phase === 'won' && !(data.wave === WAVES.length || data.wave === 6 && (data.campaignLength == null || data.campaignLength === 6))) return false
  for (const key of ['baseHp', 'maxBaseHp', 'energy', 'maxEnergy', 'gold', 'time', 'waveTime', 'rng', 'sequence', 'accumulator', 'deployCooldown', 'discardCooldown', 'discards', 'waveKills', 'waveSpawned', 'spawnIndex', 'energyRegen']) {
    if (!Number.isFinite(data[key]) || data[key] < 0) return false
  }
  if (data.baseHp > data.maxBaseHp || data.maxBaseHp > 200 || data.energy > data.maxEnergy || data.maxEnergy > 30 || data.gold > 1e6 || data.sequence > 1e9 || data.energyRegen > 10 || data.accumulator >= STEP + 1e-6 || data.spawnIndex > data.schedule?.length) return false
  return true
}

function validDeck(data) {
  if (!Array.isArray(data.hand) || data.hand.length !== 8 || !Array.isArray(data.deck) || data.deck.length > 52) return false
  const validCard = card => card && typeof card.id === 'string' && RANKS.includes(card.rank) && Object.hasOwn(SUITS, card.suit)
  if (![...data.hand, ...data.deck].every(validCard)) return false
  const ids = [...data.hand, ...data.deck].map(card => card.id)
  const edits = data.orderRules >= 2 ? data.cardEdits : {}
  if (!edits || typeof edits !== 'object' || Array.isArray(edits) ||
      !Object.entries(edits).every(([slot, face]) => deckFaces.includes(slot) && deckFaces.includes(face) && slot !== face)) return false
  if (data.orderRules >= 2 && (!Number.isInteger(data.printsLeft) || data.printsLeft < 0 || data.printsLeft > PRINTS_PER_WAVE)) return false
  const stock = [...data.hand, ...data.deck]
  if (new Set(ids).size !== ids.length || new Set(stock.map(slotOf)).size !== stock.length ||
      !stock.every(card => deckFaces.includes(slotOf(card)) && (edits[slotOf(card)] || slotOf(card)) === faceOf(card))) return false
  return true
}

function validHandAndTricks(data) {
  if (data.trickUsed !== undefined && typeof data.trickUsed !== 'boolean') return false
  if (data.feint != null) {
    const { flag, target, result } = data.feint
    if (!Object.hasOwn(REGIMENTS, flag) || !['planned','active','fooled','missed'].includes(result)) return false
    if (data.phase === 'ready' ? result !== 'planned' || target !== null : result === 'planned' || !Object.hasOwn(REGIMENTS, target)) return false
    if (result === 'active' && (data.phase !== 'battle' || data.reserveUsed)) return false
  }
  if (data.keptCardId != null && (!data.trickUsed || data.doctrine !== 'sleeve' ||
      data.phase !== 'shop' || !data.hand.some(card => card.id === data.keptCardId))) return false
  if (data.palmedCard != null) {
    const card = data.hand.find(item => item.id === data.palmedCard.id)
    if (!data.trickUsed || data.doctrine !== 'iron' || !card || !shiftedRank(card.rank,data.palmedCard.step)) return false
  }
  if (!Array.isArray(data.selected) || data.selected.length > 5 || new Set(data.selected).size !== data.selected.length || !data.selected.every(id => data.hand.some(card => card.id === id))) return false
  if (!Array.isArray(data.jokers) || new Set(data.jokers.map(joker => joker.id)).size !== data.jokers.length) return false
  if (!data.jokers.every(joker => Object.hasOwn(JOKER_BY_ID, joker.id) && Number.isFinite(joker.triggers) && joker.triggers >= 0 &&
    (joker.quantity === undefined || (Number.isSafeInteger(joker.quantity) && joker.quantity > 0 && (joker.quantity === 1 || JOKER_BY_ID[joker.id].stackable))))) return false
  return true
}

function validArmies(data) {
  const reserves = data.reserves ?? []
  if (!Array.isArray(reserves) || !reserves.every(u => u?.grade >= 4 && !!QUALITIES[u.grade] && !u.locked && u.echoUntil == null)) return false
  const fallen = data.casualties ?? []
  if (!Array.isArray(fallen) || (fallen.length && data.phase !== 'battle') || fallen.some(u=>!u || u.echoUntil != null)) return false
  if (data.victorySeen !== undefined && typeof data.victorySeen !== 'boolean') return false
  for (const [field, definition, side] of [['allies', ALLIED, 'ally'], ['enemies', HOSTILE, 'enemy']]) {
    const limit = field === 'enemies' ? MAX_ENEMIES : data.squadRules === undefined || data.handsLeft === undefined ? OLD_FIELD_LIMIT : Math.max(FIELD_LIMIT, data.legacyFieldSize || 0)
    if (!Array.isArray(data[field]) || data[field].length > limit) return false
    if (side === 'ally' && data.allies.filter(u=>u?.echoUntil == null).length + fallen.length > limit) return false
    const units = side === 'ally' ? data.allies.concat(fallen, reserves) : data.enemies
    if (!units.every(unit => unit && Object.hasOwn(definition, unit.type) && unit.side === side && ['x', 'y', 'hp', 'maxHp', 'atk', 'range', 'cooldown', 'level', 'speed', 'period'].every(key => Number.isFinite(unit[key])) && unit.hp > 0 && unit.hp <= unit.maxHp && unit.x >= 0 && unit.x <= 1100 && unit.y >= 150 && unit.y <= 350 && unit.level >= 1 && unit.level <= 3 && unit.maxHp <= 100000 && unit.atk >= 0 && unit.atk <= 20000 && unit.period > 0 && unit.speed >= 0)) return false
    if (new Set(units.map(unit => unit.id)).size !== units.length) return false
    if (side === 'ally') for (const unit of units) {
      if (unit.waveBonus && (!Object.entries(unit.waveBonus).every(([k,v]) => ['maxHp','atk','heal','period'].includes(k) && Number.isFinite(v)) ||
          lastingStat(unit,'maxHp') < 1 || lastingStat(unit,'maxHp') > 100000 || lastingStat(unit,'atk') > 20000 || lastingStat(unit,'period') <= 0 || lastingStat(unit,'atk') < 0 || lastingStat(unit,'heal') < 0)) return false
      if (unit.royalWard !== undefined && typeof unit.royalWard !== 'boolean') return false
      if (unit.royalStars !== undefined && (!Number.isInteger(unit.royalStars) || unit.royalStars<0 || unit.royalStars>3)) return false
      if (unit.legendGuard !== undefined && (unit.legendGuard !== true || unit.grade!==4)) return false
      if (unit.pattern != null && (!Object.hasOwn(DETACHMENTS,unit.pattern) || DETACHMENTS[unit.pattern].members[0].type !== unit.type)) return false
      if (!validUniform(unit)) return false
      if (!validFusionJobs(unit)) return false
      if (unit.fusionSkills !== undefined && (!Array.isArray(unit.fusionSkills) || !unit.fusionSkills.length || unit.fusionSkills.length>6 ||
          new Set(unit.fusionSkills).size!==unit.fusionSkills.length || !unit.fusionSkills.every(id=>Object.hasOwn(FUSION_BY_ID,id)) ||
          !Number.isInteger(unit.skillCharge) || unit.skillCharge<0 || unit.skillCharge>3)) return false
      if (unit.statBonus != null && (!Number.isInteger(unit.statBonus) || unit.statBonus < 0 || unit.statBonus > 70)) return false
      if (unit.locked !== undefined && typeof unit.locked !== 'boolean') return false
      if (unit.grade !== undefined && (!Number.isInteger(unit.grade) || !QUALITIES[unit.grade])) return false
      if (unit.lessons !== undefined && (!Array.isArray(unit.lessons) || new Set(unit.lessons).size !== unit.lessons.length ||
          !unit.lessons.every(type => Object.hasOwn(LESSONS,type)))) return false
      if (unit.trainingGrowth && !['hp','atk'].every(key => Number.isSafeInteger(unit.trainingGrowth[key]) && unit.trainingGrowth[key] >= 0)) return false
      if (unit.trainingXp !== undefined && (!Number.isInteger(unit.trainingXp) || unit.trainingXp < 0 || unit.trainingXp > 999)) return false
      if (unit.campSpot && !inCampArea(unit.campSpot.x, unit.campSpot.y)) return false
      if (unit.cardSlot !== undefined && !deckFaces.includes(unit.cardSlot)) return false
      if (unit.jobId !== undefined && unit.jobId !== (unit.pattern ? DETACHMENTS[unit.pattern].job : getCardDesign(unit)?.jobId)) return false
      if (unit.fusion !== undefined) {
        const recipe = Object.hasOwn(FUSION_BY_ID, unit.fusion) && FUSION_BY_ID[unit.fusion]
        if (!recipe || !recipe.types.includes(unit.type) || unit.level !== 3 || !Number.isInteger(unit.skillCharge) || unit.skillCharge < 0 || unit.skillCharge > 3) return false
        if (unit.fusionPartner !== undefined) {
          const partner = getCardDesign(unit.fusionPartner)
          if (!partner || partner.type === unit.type || !recipe.types.includes(partner.type) || unit.fusionPartner !== partner.id) return false
        }
      }
      if (unit.heal !== undefined && (!Number.isFinite(unit.heal) || unit.heal < 0)) return false
      if (unit.crowned !== undefined && typeof unit.crowned !== 'boolean') return false
      if (unit.command !== undefined && (!['guard', 'assault'].includes(unit.command) || unit.level < 2)) return false
      const present = ['suit', 'rank', 'appearanceId'].filter(key => Object.hasOwn(unit, key))
      // Old v1 saves had class-only units. New identities are all-or-nothing.
      if (present.length === 0) continue
      if (present.length !== 3 || typeof unit.rank !== 'string') return false
      const design = getCardDesign(unit.suit, unit.rank)
      if (!design || design.id !== unit.appearanceId || design.type !== unit.type) return false
    }
  }
  return true
}

function validWave(data) {
  if (!Number.isFinite(data.bossTimer)) return false
  if (!Array.isArray(data.schedule) || data.schedule.length > 40 || !data.schedule.every(item => Number.isFinite(item.at) && item.at >= 0 && Object.hasOwn(HOSTILE, item.type))) return false
  if (data.waveTimeout != null) {
    const { count, damage, boss, bossName } = data.waveTimeout
    if (!['shop', 'won', 'lost'].includes(data.phase) || data.waveTime !== WAVES[data.wave - 1].duration ||
        !Number.isSafeInteger(count) || count < 1 || count > MAX_ENEMIES + data.schedule.length ||
        !Number.isFinite(damage) || damage <= 0 || damage > data.maxBaseHp || typeof boss !== 'boolean' ||
        (boss && data.phase !== 'lost') || (bossName !== undefined && (!boss || !['无冕之王','缀命皇后'].includes(bossName)))) return false
  }
  if (!Array.isArray(data.shop) || data.shop.length > 3 || new Set(data.shop).size !== data.shop.length || !data.shop.every(id => Object.hasOwn(JOKER_BY_ID, id))) return false
  const sold = data.soldShop ?? []
  if (!Array.isArray(sold) || new Set(sold).size !== sold.length || !sold.every(id=>data.shop.includes(id))) return false
  if (data.shop.some(id=>!JOKER_BY_ID[id].stackable && !sold.includes(id) && data.jokers.some(j=>j.id===id))) return false
  if (!data.upgrades || !Number.isFinite(data.upgrades.power) || data.upgrades.power < 0 || data.upgrades.power > 1) return false
  if (!data.stats || !['deploys', 'summoned', 'kills', 'lost', 'healed', 'damage', 'goldEarned', 'jokerTriggers', 'maxChain', 'bestPower', 'wavesCleared', 'discards'].every(key => Number.isFinite(data.stats[key]) && data.stats[key] >= 0)) return false
  if (!Number.isSafeInteger(data.stats.wavesCleared) || data.stats.wavesCleared > data.wave) return false
  if (!Array.isArray(data.logs) || data.logs.length > 36 || !data.logs.every(item => typeof item.text === 'string' && item.text.length < 1000)) return false
  if (!Array.isArray(data.rewards) || data.rewards.length > 4 || !data.rewards.every(item => ['repair', 'power', 'supply','enlist'].includes(item.id) && (item.id !== 'enlist' || [2,4].includes(data.wave)))) return false
  if (![false, 'repair', 'power', 'supply','enlist'].includes(data.rewardChosen)) return false
  if (data.bossTelegraph) {
    const mark = data.bossTelegraph
    if (!['x', 'y', 'radius', 'remaining', 'duration'].every(key => Number.isFinite(mark[key])) ||
        mark.radius <= 0 || mark.radius > 1000 || mark.remaining <= 0 || mark.duration <= 0 || mark.duration > 8 || mark.remaining > mark.duration ||
        !Object.values(BOSS_SKILLS).some(skill => skill.name === mark.name) ||
        (mark.mode !== undefined && !Object.values(BOSS_SKILLS).some(skill => skill.name === mark.name && skill.mode === mark.mode)) ||
        (mark.mode === 'pulse' && (!Number.isFinite(mark.startHp) || mark.startHp <= 0 || mark.startHp > 100000)) ||
        data.phase !== 'battle' || !data.enemies.some(unit => isBoss(unit.type))) return false
  }
  if (Object.keys(data).some(key => RESERVED.has(key))) return false
  if (data.waveReport !== undefined && !Object.keys(ALLIED).every(type =>
    ['damage', 'healed'].every(key => Number.isFinite(data.waveReport?.[type]?.[key]) && data.waveReport[type][key] >= 0))) return false
  if (data.allies.filter(unit => unit.lifeline).length > 1 || data.enemies.some(unit => unit.lifeline !== undefined)) return false
  for (const unit of data.allies) {
    if (unit.lifeline !== undefined && (unit.lifeline !== true || !data.trickUsed || data.doctrine !== 'escape' ||
        !['battle','won','lost'].includes(data.phase))) return false
    if (unit.echoUntil !== undefined && (!data.trickUsed || data.doctrine !== 'arcane' ||
        !Number.isFinite(unit.echoUntil) || unit.echoUntil <= data.time || unit.echoUntil > data.time+6.001)) return false
  }
  for (const unit of data.enemies) {
    if (unit.bossCasts !== undefined && (!isBoss(unit.type) || !Number.isSafeInteger(unit.bossCasts) || unit.bossCasts < 0)) return false
    const grip = unit.lure
    if (grip !== undefined && (!grip || !data.trickUsed || data.doctrine !== 'scarlet' ||
        !['at','fromX','toX','fromY','toY'].every(key => Number.isFinite(grip[key])) ||
        grip.at > data.time || grip.at < data.time-LURE_TRAVEL-LURE_REVEAL-.001 ||
        [grip.fromX,grip.toX].some(x => x<0 || x>1100) || [grip.fromY,grip.toY].some(y => y<150 || y>350))) return false
  }
  if (data.allies.filter(unit => unit.command).length > 1) return false
  if (data.convoyTaken != null && (!PAY_WAGONS.some(wagon => wagon.id === data.convoyTaken) ||
    data.wave > 2 || data.phase === 'ready')) return false
  return true
}

function validResources(data) {
  const legacyHands = data.handsBought === undefined && data.paidHandsLeft === undefined
  if (data.handsLeft !== undefined && (!Number.isSafeInteger(data.handsLeft) || data.handsLeft < 0)) return false
  if (legacyHands) {
    if (data.handsLeft > 4) return false
  } else if (!Number.isSafeInteger(data.handsBought) || data.handsBought < 0 ||
      !Number.isSafeInteger(extraHandPrice(data)) || !Number.isSafeInteger(data.paidHandsLeft) ||
      data.paidHandsLeft < 0 || data.paidHandsLeft > data.handsBought ||
      !Number.isSafeInteger(data.handsLeft) || data.paidHandsLeft > data.handsLeft ||
      data.handsLeft - data.paidHandsLeft > HANDS_PER_WAVE) return false
  if (data.legacyFieldSize !== undefined && (!Number.isInteger(data.legacyFieldSize) || data.legacyFieldSize < 0 || data.legacyFieldSize > OLD_FIELD_LIMIT)) return false
  if (data.reserveUsed !== undefined && typeof data.reserveUsed !== 'boolean') return false
  if (data.difficulty !== undefined && !['standard', 'veteran'].includes(data.difficulty)) return false
  if (data.formation !== undefined && !Object.hasOwn(FORMATION_BY_ID, data.formation)) return false
  if (data.tacticsReport !== undefined && !Object.keys(emptyTacticsReport()).every(key =>
    Number.isFinite(data.tacticsReport?.[key]) && data.tacticsReport[key] >= 0)) return false
  if (data.tacticsReport && (!['tolls', 'interrupts', 'gateDamage'].every(key => Number.isSafeInteger(data.tacticsReport[key])) ||
    ![0, SILENT_BOUNTY].includes(data.tacticsReport.bounty))) return false
  if (data.enemies.some(unit => unit.type === 'bellkeeper' && (!Number.isFinite(unit.bellTimer) || unit.bellTimer <= 0 || unit.bellTimer > BELL_INTERVAL))) return false
  if (data.fusions !== undefined && (!Number.isSafeInteger(data.fusions) || data.fusions < 0)) return false
  if (data.fusionUses !== undefined && (!data.fusionUses || Array.isArray(data.fusionUses) || typeof data.fusionUses !== 'object' ||
      !Object.entries(data.fusionUses).every(([id, count]) => Object.hasOwn(FUSION_BY_ID, id) && Number.isSafeInteger(count) && count >= 0))) return false
  if (data.promotions !== undefined && (!Number.isSafeInteger(data.promotions) || data.promotions < 0)) return false
  return true
}

function validProgress(data) {
  if (!validOnboarding(data.onboarding)) return false
  const levelKeys = Object.keys(ORDER_BOOK).filter(key => data.orderRules !== 1 || !ORDER_BOOK[key].secret)
  if (data.orderRules !== undefined && (![1, 2, 3].includes(data.orderRules) ||
      (!Object.hasOwn(REGIMENTS, data.orderTarget) && !(data.orderRules === 3 && data.orderTarget === null)) || typeof data.trainedHere !== 'boolean' ||
      !data.handLevels || Array.isArray(data.handLevels) || Object.keys(data.handLevels).length !== levelKeys.length ||
      !levelKeys.every(key => Number.isInteger(data.handLevels[key]) && data.handLevels[key] >= 1 && data.handLevels[key] <= MAX_ORDER_LEVEL))) return false
  if (data.discoveredHands !== undefined && (!Array.isArray(data.discoveredHands) ||
      new Set(data.discoveredHands).size !== data.discoveredHands.length ||
      !data.discoveredHands.every(key => Object.hasOwn(ORDER_BOOK, key) && ORDER_BOOK[key].secret) ||
      levelKeys.some(key => ORDER_BOOK[key].secret && data.handLevels?.[key] > 1 && !data.discoveredHands.includes(key)))) return false
  if (data.lastField !== undefined && (!Array.isArray(data.lastField) || data.lastField.length > FIELD_LIMIT || new Set(data.lastField.map(unit => unit?.id)).size !== data.lastField.length ||
      !data.lastField.every(u => u && typeof u.id === 'string' && getCardDesign(u.appearanceId)?.id === u.appearanceId &&
        typeof u.appearanceId === 'string' && validUniform(u) && (u.pattern == null || Object.hasOwn(DETACHMENTS,u.pattern)) && (u.grade == null || Number.isInteger(u.grade) && !!QUALITIES[u.grade]) && Number.isFinite(u.x) && u.x >= 0 && u.x <= 1100 && Number.isFinite(u.y) && u.y >= 150 && u.y <= 350 &&
        Number.isInteger(u.level) && u.level>=1 && u.level<=3 && typeof u.standard === 'boolean' && (!u.fusion || Object.hasOwn(FUSION_BY_ID,u.fusion))))) return false
  if (data.champion?.pattern != null && !Object.hasOwn(DETACHMENTS,data.champion.pattern)) return false
  if (data.champion?.locked !== undefined && typeof data.champion.locked !== 'boolean') return false
  if (data.champion != null && (!deckFaces.includes(data.champion.slot) ||
    !Number.isInteger(data.champion.xp) || data.champion.xp < 0 || data.champion.xp > 999 ||
    !(data.champion.unitId === null || typeof data.champion.unitId === 'string'))) return false
  if (data.royalMarch !== undefined && typeof data.royalMarch !== 'boolean') return false
  if (data.preparedScore !== undefined && (!Number.isSafeInteger(data.preparedScore) || data.preparedScore < 0)) return false
  if (data.bellReady !== undefined && typeof data.bellReady !== 'boolean') return false
  if (data.champion) {
    for (const [key,min,max] of [['marks',0,5],['level',1,3],['grade',0,QUALITIES.length-1]]) {
      const v = data.champion[key]
      if (v !== undefined && (!Number.isInteger(v) || v < min || v > max)) return false
    }
  }
  if (data.rewardChosen === 'enlist' && (data.phase !== 'shop' || ![2,4].includes(data.wave))) return false
  return true
}

function migrateExpedition(data) {
  const legacyHands = data.handsBought === undefined && data.paidHandsLeft === undefined
  const pristine = createGame({ seed: data.seed, doctrine: data.doctrine, difficulty: data.difficulty })
  for (const key of Object.keys(pristine)) if (Object.hasOwn(data, key)) pristine[key] = data[key]
  for (const key of ['bonusDiscard']) if (Object.hasOwn(data, key)) pristine[key] = data[key]
  // Completed six-wave records remain completed; active old expeditions continue to twelve.
  pristine.campaignLength = data.phase === 'won' && data.wave === 6 ? 6 : WAVES.length
  if (pristine.champion) {
    const captain = data.allies.find(u=>u.id===pristine.champion.unitId)
    pristine.champion.level ??= captain?.level || 1
    pristine.champion.grade ??= captain?.grade || 0
    pristine.champion.marks = Math.max(pristine.champion.marks || 0, marksForStar(pristine.champion.level))
    delete pristine.champion.focus
  }
  if (data.preparedScore === undefined) {
    pristine.preparedScore = Math.max(0, Number(pristine.lastDeploy?.score) || 0)
    pristine.bellReady = !!pristine.lastDeploy?.key && pristine.lastDeploy.key !== 'high' && !data.reserveUsed
  }
  if (pristine.phase === 'battle') pristine.selected = []
  const last = pristine.lastDeploy
  if (last && Object.hasOwn(DETACHMENTS,last.key)) {
    const grade = last.captainGrade ?? last.grade ?? 0
    if (QUALITIES[grade]) pristine.lastDeploy = {...last, variantName:recruitName(last.key,grade)}
  }
  pristine.jokers = data.jokers.map(joker => ({ ...JOKER_BY_ID[joker.id], ...(joker.quantity ? {quantity:joker.quantity} : {}), triggers: joker.triggers, flash: 0 }))
  function restoreSoldier(unit) {
    const design = getCardDesign(unit)
    const definition = ALLIED[unit.type]
    const growth = unit.trainingXp > 0 && !unit.trainingGrowth ? {trainingGrowth:trainingBonus(unit.trainingXp, data.wave)} : {}
    return { ...growth, heal: definition.heal || 0, grade:0, locked:false, jobId:unit.pattern ? DETACHMENTS[unit.pattern].job : design.jobId, trainingXp:0, cardSlot:faceOf(design), ...unit, suit: design.suit, rank: design.rank, appearanceId: design.id, name: unit.pattern ? recruitName(unit.pattern,unit.grade ?? 0) : design.name, className: definition.name, color: definition.color, icon: definition.icon }
  }
  pristine.allies = data.allies.map(restoreSoldier)
  pristine.reserves = pristine.reserves.map(restoreSoldier)
  pristine.casualties = pristine.casualties.map(restoreSoldier)
  if (data.reserveUsed === undefined) {
    pristine.maxEnergy = 16
    pristine.energy = pristine.phase === 'ready' ? 16 : Math.min(16, pristine.energy)
    pristine.energyRegen = 0
  }
  if (data.orderRules === undefined) {
    pristine.handLevels = Object.fromEntries(Object.keys(ORDER_BOOK).map(key => [key, 1]))
    pristine.orderTarget = null; pristine.trainedHere = false
    if (data.phase === 'ready') {
      pristine.energy = pristine.maxEnergy; pristine.selected = []; pristine.lastDeploy = null
      log(pristine, '本波军令已补满，可以继续整编。', 'good')
    } else if (data.phase === 'battle') {
      pristine.orderTarget = pristine.allies[0]?.type || 'knight'
    }
  }
  if (data.orderRules !== 3) {
    // Keep the cursor and enemies already on the field when loading an older convoy battle.
    pristine.schedule = pristine.schedule.filter((spawn, index) => index < pristine.spawnIndex || !spawn.convoyGuard)
  }
  if (legacyHands && data.handsLeft !== undefined) pristine.handsLeft = Math.max(0,data.handsLeft - 1)
  if (data.handsLeft === undefined) {
    // Earlier versions had no per-wave counter. Wave one has an exact lifetime count.
    const used = data.wave === 1 ? data.stats.deploys : Math.ceil((data.maxEnergy - data.energy) / 4)
    pristine.handsLeft = Math.max(0, HANDS_PER_WAVE - Math.max(used, data.reserveUsed ? 1 : 0))
    pristine.legacyFieldSize = pristine.allies.length > FIELD_LIMIT ? pristine.allies.length : 0
    if (pristine.phase === 'ready') {
      makeSchedule(pristine)
      if (!pristine.allies.length) pristine.handsLeft = HANDS_PER_WAVE
    }
    if (pristine.phase === 'battle') {
      for (const spawn of pristine.schedule.slice(pristine.spawnIndex)) spawn.at = 0
      spawnEnemies(pristine)
    }
  }
  if (!data.squadRules && pristine.allies.length > FIELD_LIMIT) pristine.legacyFieldSize = pristine.allies.length
  pristine.squadRules = 1
  pristine.orderRules = 3
  if (!(data.orderRules >= 2)) {
    pristine.cardEdits = {}
    pristine.printsLeft = PRINTS_PER_WAVE
    pristine.handLevels = Object.fromEntries(Object.keys(ORDER_BOOK).map(key => [key, pristine.handLevels[key] ?? 1]))
  }
  if (data.discoveredHands === undefined) {
    pristine.discoveredHands = Object.keys(ORDER_BOOK).filter(key => ORDER_BOOK[key].secret &&
      (pristine.handLevels[key] > 1 || pristine.stats.bestHand === ORDER_BOOK[key].name))
  }
  if (data.casualties === undefined && data.phase === 'shop' && !pristine.allies.length && data.lastField?.length) {
    // Older shops saved only display records. Recover the identities and growth actually on record.
    const {rng,sequence} = pristine, summoned = pristine.stats.summoned
    for (const record of data.lastField) {
      const design = getCardDesign(record.appearanceId)
      const captain = pristine.champion?.unitId === record.id
      const unit = addUnit(pristine,design.type,'ally',record.level,{identity:{...design, ...record, source:'legacy'}})
      if (!unit) continue
      unit.id = record.id
      unit.standard = captain
      if (record.fusion) { unit.fusion = record.fusion; unit.skillCharge = 0 }
      if (captain) {
        unit.cardSlot = pristine.champion.slot
        unit.locked = !!pristine.champion.locked
        grantExperience(pristine,unit,pristine.champion.xp,false)
      }
    }
    Object.assign(pristine,{rng,sequence}); pristine.stats.summoned = summoned
    arrangeCamp(pristine)
  }
  if (pristine.phase === 'shop' && pristine.champion && !pristine.allies.some(u=>u.id===pristine.champion.unitId)) pristine.champion.unitId = null
  for (const unit of [...pristine.allies, ...pristine.enemies]) {
    for (const key of ['motion','aim']) {
      const pose = unit[key]
      if (pose && (!Object.hasOwn(PERFORMANCES,pose.profile) || ![-1,1].includes(pose.direction) ||
          !['attack','heal','skill','toll','bombard'].includes(pose.kind) ||
          (key === 'motion' && (!Number.isFinite(pose.at) || pose.at > data.time)))) delete unit[key]
    }
  }
  pristine.effects = []
  if (data.onboarding !== undefined) pristine.onboarding = migrateOnboarding(data.onboarding)
  // Optional measurement data never makes an otherwise valid expedition unplayable.
  const measured = validCombatStats(data) ? data : {}
  migrateCombatStats(pristine, measured)
  return pristine
}
