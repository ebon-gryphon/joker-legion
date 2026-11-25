import {waveInfo} from './endless.js'
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
import { HOSTILE, FORMATION_BY_ID, SILENT_BOUNTY, BELL_INTERVAL,DIFFICULTIES } from './tactics.js'
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
import {ECONOMY_VERSION,ECONOMY_CONFIG} from './economy.js'
import {isRewardOffer,createRewardShelf,createRewardOffer,migrateRewardOffer,WAVE_REWARDS} from './waveRewards.js'
import {emptyWaveBonuses} from './rewardModifiers.js'
import {LIFE_RULES,initialLifeMax,lifeMaxCap} from './playerLife.js'
import {createBuildState,validBuildState,validBuildUnitStats,buildUnitPercent} from './buildPassives.js'

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
    if(data?.lifeVersion===undefined && !prepareLegacyLife(data))return null
    discardInvalidScoreMetadata(data)
    if (!validExpedition(data) || !validDeck(data) || !validHandAndTricks(data) ||
        !validArmies(data) || !validWave(data) || !validResources(data) || !validProgress(data) || !validRewardEconomy(data) || !validLifeBuild(data)) return null
    return migrateExpedition(data)
  } catch { return null }
}

function validExpedition(data) {
  if (!data || data.version !== 1 || !DOCTRINES.some(item => item.id === data.doctrine)) return false
  if(data.mode!==undefined && !['standard','endless'].includes(data.mode))return false
  if(data.mode==='endless' && data.phase==='won' || data.phase==='retired' && (data.mode!=='endless' || data.stats?.wavesCleared!==data.wave))return false
  if (!['ready', 'battle', 'shop', 'won', 'lost','retired'].includes(data.phase) || !Number.isSafeInteger(data.wave) || data.wave < 1 || data.mode!=='endless' && data.wave > WAVES.length) return false
  if (data.campaignLength !== undefined && ![6,WAVES.length].includes(data.campaignLength)) return false
  if (data.phase === 'won' && !(data.wave === WAVES.length || data.wave === 6 && (data.campaignLength == null || data.campaignLength === 6))) return false
  for (const key of ['baseHp', 'maxBaseHp', 'energy', 'maxEnergy', 'gold', 'time', 'waveTime', 'rng', 'sequence', 'accumulator', 'deployCooldown', 'discardCooldown', 'discards', 'waveKills', 'waveSpawned', 'spawnIndex', 'energyRegen']) {
    if (!Number.isFinite(data[key]) || data[key] < 0) return false
  }
  if (data.baseHp > data.maxBaseHp || data.maxBaseHp > lifeMaxCap(data) || data.energy > data.maxEnergy || data.maxEnergy > 30 || data.gold > Number.MAX_SAFE_INTEGER || data.sequence > 1e9 || data.energyRegen > 10 || data.accumulator >= STEP + 1e-6 || data.spawnIndex > data.schedule?.length) return false
  return true
}

function prepareLegacyLife(data) {
  if(!data || !Number.isFinite(data.baseHp) || !Number.isFinite(data.maxBaseHp) || data.maxBaseHp<=0 || data.maxBaseHp>200 || data.baseHp<0 || data.baseHp>data.maxBaseHp)return false
  const oldHp=data.baseHp,oldMax=data.maxBaseHp,oldBase=data.difficulty==='veteran'?75:100
  const increments=Math.max(0,Math.floor((oldMax-oldBase)/10))
  const nextMax=Math.min(lifeMaxCap(data),initialLifeMax(data.difficulty)+increments*LIFE_RULES.expansion)
  const active=['ready','battle','shop'].includes(data.phase)
  const mapped=Math.min(oldHp<oldMax?nextMax-1:nextMax,Math.ceil(oldHp/oldMax*nextMax))
  data.baseHp=Math.min(nextMax,Math.max(active?1:0,mapped))
  data.maxBaseHp=nextMax;data.lifeVersion=LIFE_RULES.version;data.lifeFailed=data.phase==='lost'
  if(data.lifeFailed)data.baseHp=0
  const oldOrders=data.combatLedger?.orders || []
  const scoring=order=>order.scoreTrace?.scoringCards || []
  data.lifeItemState={redEchoUsed:oldOrders.some(order=>scoring(order).filter(c=>c.suit==='♥').length>=2),
    flushCrownUsed:oldOrders.some(order=>scoring(order).length===5 && scoring(order).every(c=>c.suit===scoring(order)[0].suit))}
  data.lifeEvents=[];data.buildPassives=createBuildState(data.wave)
  data.legacyLifeHistory={version:0,oldHp,oldMax,mappedLife:data.baseHp,mappedMax:nextMax,
    gate:JSON.parse(JSON.stringify(data.combatLedger?.gate || data.lastCombatReport?.gate || null)),timeout:data.waveTimeout || null,
    tactics:JSON.parse(JSON.stringify(data.tacticsReport || null)),
    logs:(data.logs || []).filter(row=>/城门|城堡|耐久|钟击/.test(row.text || ''))}
  data.logs=(data.logs || []).map(row=>/城门|城堡|耐久|钟击/.test(row.text || '')?{...row,text:'旧制记录 · '+row.text.replace(/城门耐久|城门|城堡|耐久/g,'原防线')}:row)
  data.waveTimeout=null
  for(const container of [data.combatLedger,data.lastCombatReport])for(const order of container?.orders || [])if(order.scoreTrace)order.scoreTrace.legacyLife=true
  if(data.lastDeploy?.scoreTrace)data.lastDeploy.scoreTrace.legacyLife=true
  if(data.combatLedger && !data.combatLedger.ended){
    const ledger=data.combatLedger;ledger.legacyGate=JSON.parse(JSON.stringify(ledger.gate))
    ledger.lifeVersion=1;ledger.lifeStart=data.baseHp;ledger.lifeMaxStart=data.maxBaseHp;ledger.lifeEvents=[];ledger.passiveEvents=[]
    ledger.gate={start:data.baseHp,battleStart:ledger.started?data.baseHp:null,end:data.baseHp,damage:0,repaired:0,untracked:0,
      preparationDamage:0,preparationRepaired:0,battleDamage:0,battleRepaired:0,sources:{bell:0,breach:0,timeout:0,unknown:0}}
    if(data.tacticsReport)data.tacticsReport.gateDamage=0
  }
  if(data.mode!=='endless' && data.phase==='shop' && data.wave===WAVES.length && data.stats?.wavesCleared===WAVES.length){
    data.legacyLifeHistory.rewards=data.rewards;data.phase='won';data.finalWaveCleared=true
    data.rewards=[];data.shop=[];data.soldShop=[];data.rewardChosen=false;data.rewardState={wave:data.wave,claimedId:null}
  }else if(data.economyVersion!==undefined && Array.isArray(data.rewards)){
    data.rewards=data.rewards.map(row=>migrateRewardOffer(data,row))
    if(data.rewards.some(row=>!row))return false
    // Existing targets remain fixed. A newly capped life option is replaced by
    // a deterministic unused resource fallback, never a reroll of the shelf.
    if(data.phase==='shop' && !data.rewardChosen){
      const seen=new Set(data.rewards.map(row=>row.id))
      data.rewards=data.rewards.map(row=>{
        if(!['repair','gate-masonry'].includes(row.id) || (row.id==='repair'?data.baseHp<data.maxBaseHp:data.maxBaseHp<lifeMaxCap(data)))return row
        const id=['gold-purse','crystal-purse','gold-chest','crystal-chest'].find(id=>!seen.has(id));seen.add(id)
        return createRewardOffer(data,id)
      })
    }
  }
  return true
}

function validLifeBuild(data) {
  if(data.mode!=='endless' && data.phase==='shop' && data.wave===WAVES.length)return false
  if(data.lifeVersion!==LIFE_RULES.version || typeof data.lifeFailed!=='boolean' || data.lifeFailed && data.baseHp!==0 ||
    !Number.isSafeInteger(data.baseHp) || !Number.isSafeInteger(data.maxBaseHp) || data.maxBaseHp<initialLifeMax(data.difficulty) ||
    !data.lifeItemState || !['redEchoUsed','flushCrownUsed'].every(key=>typeof data.lifeItemState[key]==='boolean') ||
    !validBuildState(data.buildPassives) || data.buildPassives.wave.number!==data.wave)return false
  if(!Array.isArray(data.lifeEvents) || data.lifeEvents.length>10000)return false
  const kinds=['loss','heal','max','failure','end','bell-summon','bell-blocked','bell-kill','bell-breach','bell-timeout']
  return data.lifeEvents.every(row=>row && kinds.includes(row.kind) && ['id','source','sourceId'].every(key=>typeof row[key]==='string'&&row[key].length<=500) &&
    row.wave===data.wave && Number.isFinite(row.at)&&row.at>=0 && ['before','after','amount','maxBefore','maxAfter'].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0) &&
    row.before<=row.maxBefore && row.after<=row.maxAfter && row.maxAfter<=lifeMaxCap(data) &&
    (row.kind!=='loss' || row.before-row.after===row.amount && row.amount<=LIFE_RULES.breachLoss) &&
    (row.kind!=='heal' || row.after-row.before===row.amount) &&
    (row.kind!=='max' || row.maxAfter-row.maxBefore===row.amount))
}

function validDeck(data) {
  if (!Array.isArray(data.hand) || data.hand.length !== 8 || !Array.isArray(data.deck) || data.deck.length > 52) return false
  const validCard = card => card && typeof card.id === 'string' && RANKS.includes(card.rank) && Object.hasOwn(SUITS, card.suit)
  if (![...data.hand, ...data.deck].every(validCard)) return false
  const ids = [...data.hand, ...data.deck].map(card => card.id)
  const edits = data.orderRules >= 2 ? data.cardEdits : {}
  if (!edits || typeof edits !== 'object' || Array.isArray(edits) ||
      !Object.entries(edits).every(([slot, face]) => deckFaces.includes(slot) && deckFaces.includes(face) && slot !== face)) return false
  if (data.orderRules >= 2 && (!Number.isInteger(data.printsLeft) || data.printsLeft < 0 || data.printsLeft > (data.printsBudget ?? PRINTS_PER_WAVE))) return false
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
      !['shop','retired'].includes(data.phase) || !data.hand.some(card => card.id === data.keptCardId))) return false
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
    if (!units.every(unit => unit && Object.hasOwn(definition, unit.type) && unit.side === side && ['x', 'y', 'hp', 'maxHp', 'atk', 'range', 'cooldown', 'level', 'speed', 'period'].every(key => Number.isFinite(unit[key])) && unit.hp > 0 && unit.hp <= unit.maxHp && unit.x >= 0 && unit.x <= 1100 && unit.y >= 150 && unit.y <= 350 && unit.level >= 1 && unit.level <= 3 && (data.mode==='endless'||unit.maxHp <= 100000) && unit.atk >= 0 && (data.mode==='endless'||unit.atk <= 20000) && unit.period > 0 && unit.speed >= 0)) return false
    if (new Set(units.map(unit => unit.id)).size !== units.length) return false
    if (side === 'ally') for (const unit of units) {
      const buildPercent=buildUnitPercent(data,unit)
      if(!validBuildUnitStats(unit) || unit.echoUntil==null && (buildPercent>0&&!unit.buildPassiveStats || unit.buildPassiveStats&&Math.abs(unit.buildPassiveStats.percent-buildPercent)>1e-9))return false
      if(unit.rewardModifiers && (!['attackPercent','healthPercent'].every(key=>Number.isFinite(unit.rewardModifiers[key]) && unit.rewardModifiers[key]>=0 && unit.rewardModifiers[key]<=10) || Object.keys(unit.rewardModifiers).length!==2))return false
      if (unit.waveBonus && (!Object.entries(unit.waveBonus).every(([k,v]) => ['maxHp','atk','heal','period'].includes(k) && Number.isFinite(v)) ||
          lastingStat(unit,'maxHp') < 1 || data.mode!=='endless' && (lastingStat(unit,'maxHp') > 100000 || lastingStat(unit,'atk') > 20000) || lastingStat(unit,'period') <= 0 || lastingStat(unit,'atk') < 0 || lastingStat(unit,'heal') < 0)) return false
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
  if(data.enemies.some(unit=>
    unit.parentId!==undefined && (unit.type!=='brood' || typeof unit.parentId!=='string') ||
    unit.quarryId!=null && (unit.type!=='hunter' || typeof unit.quarryId!=='string')))return false
  if(data.enemies.some(unit=>unit.type==='cantor' && (!Number.isFinite(unit.riteTimer) || unit.riteTimer<0 || unit.riteTimer>4.5 || unit.chanting!==undefined && typeof unit.chanting!=='boolean')))return false
  if (!Number.isFinite(data.bossTimer)) return false
  if (!Array.isArray(data.schedule) || data.schedule.length > 40 || !data.schedule.every(item => Number.isFinite(item.at) && item.at >= 0 && Object.hasOwn(HOSTILE, item.type))) return false
  if (data.waveTimeout != null) {
    const { count, damage, boss, bossName } = data.waveTimeout
    if (!['shop', 'won', 'lost','retired'].includes(data.phase) || data.waveTime !== waveInfo(data).duration ||
        !Number.isSafeInteger(count) || count < 1 || count > MAX_ENEMIES + data.schedule.length ||
        !Number.isFinite(damage) || damage < 0 || damage > data.maxBaseHp || typeof boss !== 'boolean' ||
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
  if (!Array.isArray(data.rewards) || data.rewards.length > (data.economyVersion?3:4) || !data.rewards.every(item => data.economyVersion?isRewardOffer(item):['repair','power','supply','enlist'].includes(item.id))) return false
  if (data.rewardChosen!==false && !WAVE_REWARDS.some(reward=>reward.id===data.rewardChosen)) return false
  if (data.bossTelegraph) {
    const mark = data.bossTelegraph
    if (!['x', 'y', 'radius', 'remaining', 'duration'].every(key => Number.isFinite(mark[key])) ||
        mark.radius <= 0 || mark.radius > 1000 || mark.remaining <= 0 || mark.duration <= 0 || mark.duration > 8 || mark.remaining > mark.duration ||
        !Object.values(BOSS_SKILLS).some(skill => skill.name === mark.name) ||
        (mark.mode !== undefined && !Object.values(BOSS_SKILLS).some(skill => skill.name === mark.name && skill.mode === mark.mode)) ||
        (mark.mode === 'pulse' && (!Number.isFinite(mark.startHp) || mark.startHp <= 0 || data.mode!=='endless' && mark.startHp > 100000)) ||
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
      data.handsLeft - data.paidHandsLeft > HANDS_PER_WAVE+(data.waveBonuses?.active?.hands || 0)) return false
  if (data.legacyFieldSize !== undefined && (!Number.isInteger(data.legacyFieldSize) || data.legacyFieldSize < 0 || data.legacyFieldSize > OLD_FIELD_LIMIT)) return false
  if (data.reserveUsed !== undefined && typeof data.reserveUsed !== 'boolean') return false
  if (data.difficulty !== undefined && !Object.hasOwn(DIFFICULTIES,data.difficulty)) return false
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
  if (data.rewardChosen === 'enlist' && !['shop','won','retired'].includes(data.phase)) return false
  return true
}

function validRewardEconomy(data) {
  if(data.economyVersion===undefined)return true
  if(data.economyVersion!==ECONOMY_VERSION || !Number.isSafeInteger(data.crystals) || data.crystals<0 ||
    !Number.isSafeInteger(data.stats.crystalsEarned) || data.stats.crystalsEarned<0 ||
    !Number.isInteger(data.crystalIncomeWave) || data.crystalIncomeWave<0 || data.crystalIncomeWave>data.wave ||
    typeof data.finalWaveCleared!=='boolean' || data.finalWaveCleared && (data.mode==='endless' || data.wave!==WAVES.length))return false
  const keys=Object.keys(emptyWaveBonuses())
  for(const phase of ['next','active']){
    const b=data.waveBonuses?.[phase]
    if(!b || Object.keys(b).length!==keys.length || !keys.every(key=>Object.hasOwn(b,key)))return false
    if(!['hands','discards','prints'].every(key=>Number.isSafeInteger(b[key]) && b[key]>=0 && b[key]<=10) || !Number.isFinite(b.firstScorePercent) || b.firstScorePercent<0 || b.firstScorePercent>1 || !Array.isArray(b.enlistPatterns) || b.enlistPatterns.length>5 || !b.enlistPatterns.every(key=>Object.hasOwn(DETACHMENTS,key)))return false
  }
  if(!Number.isSafeInteger(data.printsBudget) || data.printsBudget<PRINTS_PER_WAVE || data.printsBudget>PRINTS_PER_WAVE+10 || !Number.isSafeInteger(data.maxDiscards) || data.maxDiscards<0 || data.maxDiscards>12)return false
  const state=data.rewardState
  if(!state || !Number.isSafeInteger(state.wave) || state.wave<0 || state.wave>data.wave || (state.claimedId!==null && !WAVE_REWARDS.some(row=>row.id===state.claimedId)))return false
  if(data.phase==='shop' && (state.wave!==data.wave || (data.rewardChosen || null)!==state.claimedId || new Set(data.rewards.map(row=>row.id)).size!==data.rewards.length || (data.rewards.length!==3 && !(state.legacy && data.rewardChosen && data.rewards.length===0))))return false
  if(data.phase==='shop' && data.rewardChosen && !state.legacy && !data.rewards.some(row=>row.id===data.rewardChosen))return false
  if(data.lastSettlement!==null){
    const s=data.lastSettlement
    if(!s || !Number.isSafeInteger(s.wave) || s.wave<1 || s.wave>data.wave)return false
    for(const [currency,fields] of [['gold',['base','bounty','wages','total','balance']],['crystals',['base','bonus','total','balance']]])if(!s[currency] || !fields.every(key=>Number.isSafeInteger(s[currency][key]) && s[currency][key]>=0) || s[currency].total!==fields.slice(0,-2).reduce((sum,key)=>sum+s[currency][key],0))return false
  }
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
  if(data.economyVersion===undefined){
    pristine.economyVersion=ECONOMY_VERSION
    pristine.crystals=ECONOMY_CONFIG.legacyGrant
    pristine.stats.crystalsEarned=ECONOMY_CONFIG.legacyGrant
    pristine.crystalIncomeWave=['shop','won'].includes(pristine.phase)?pristine.wave:Math.max(0,pristine.wave-1)
    pristine.waveBonuses={next:emptyWaveBonuses(),active:emptyWaveBonuses()}
    pristine.printsBudget=PRINTS_PER_WAVE
    pristine.finalWaveCleared=pristine.mode!=='endless' && pristine.wave===WAVES.length && ['shop','won'].includes(pristine.phase)
    pristine.lastSettlement=null
    if(pristine.phase==='shop'){
      if(pristine.rewardChosen){pristine.rewards=[];pristine.rewardState={wave:pristine.wave,claimedId:pristine.rewardChosen,legacy:true}}
      else {pristine.rewards=createRewardShelf(pristine);pristine.rewardState={wave:pristine.wave,claimedId:null}}
      if(pristine.rewardChosen==='enlist')pristine.waveBonuses.next.enlistPatterns=['twoPair']
    }else {pristine.rewards=[];pristine.rewardState={wave:0,claimedId:null}}
  }
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
