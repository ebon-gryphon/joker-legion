import { DOCTRINES, PRINTS_PER_WAVE, HANDS_PER_WAVE, JOKER_BY_ID, WAVES, FIELD_LIMIT } from './campaignRules.js'
import { DIFFICULTIES, SILENT_BOUNTY } from './tactics.js'
import { ORDER_BOOK, REGIMENTS } from './orders.js'
import { seedNumber, emptyTacticsReport, emptyWaveReport, log, effect, gainGold, copies, restoreBase, trigger, slotOf, faceOf } from './gameState.js'
import { replenish } from './deck.js'
import { makeSchedule, spawnEnemies } from './waveSchedule.js'
import { performerOf } from './performers.js'
import { scoutRead, FEINT } from './battlePlans.js'
import { restedSoldier } from './standingArmy.js'
import { grantExperience, advanceChampion } from './training.js'
import { refreshShop } from './fieldShop.js'
import { DETACHMENTS } from './recruitment.js'
import { addUnit, recruitIdentity, arrangeCamp, muster } from './campArmy.js'
import { applyOpeningItems } from './itemEffects.js'

export function createGame({ seed = 'JOKER-LEGION', doctrine = 'iron', difficulty = 'standard' } = {}) {
  const selected = DOCTRINES.find(item => item.id === doctrine) || DOCTRINES[0]
  const mode = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'standard'
  const castle = DIFFICULTIES[mode].castle
  const game = {
    version: 1, campaignLength:WAVES.length, reserves: [], casualties: [], victorySeen: false, lastField: [], squadRules: 1, champion: null, royalMarch: false, orderRules: 3, discoveredHands: [], cardEdits: {}, printsLeft: PRINTS_PER_WAVE, orderTarget: null, trainedHere: false,
    handLevels: Object.fromEntries(Object.keys(ORDER_BOOK).map(key => [key, 1])), seed: String(seed), rng: seedNumber(seed), sequence: 0, doctrine: selected.id,
    difficulty: mode, formation: 'guard', tacticsReport: emptyTacticsReport(), waveReport: emptyWaveReport(),
    phase: 'ready', preparedScore:0, bellReady:false, handsLeft: HANDS_PER_WAVE, handsBought: 0, paidHandsLeft: 0, legacyFieldSize: 0, trickUsed:false, palmedCard:null, keptCardId:null, convoyTaken: null, feint: null, wave: 1, waveTime: 0, time: 0, accumulator: 0,
    baseHp: castle, maxBaseHp: castle, gold: 8, energy: 16, maxEnergy: 16,
    energyRegen: 0, reserveUsed: false, promotions: 0, fusions: 0, fusionUses: {}, selected: [], hand: [], deck: [], allies: [], enemies: [],
    jokers: [{ ...JOKER_BY_ID[selected.joker], triggers: 0, flash: 0 }],
    shop: [], soldShop: [], rewards: [], rewardChosen: false, deployCooldown: 0, discardCooldown: 0,
    discards: 3, maxDiscards: 3, waveKills: 0, waveSpawned: 0, waveTimeout: null, spawnIndex: 0, schedule: [],
    logs: [], effects: [], chain: 0, chainTimer: 0, lastTrigger: null, lastDeploy: null,
    bossTelegraph: null, bossTimer: 0, healedCharge: 0, battleId: 1,
    upgrades: { power: 0, regeneration: 0 },
    stats: { deploys: 0, summoned: 0, kills: 0, lost: 0, healed: 0, damage: 0, goldEarned: 0, jokerTriggers: 0, maxChain: 0, bestHand: '高牌', bestPower: 0, wavesCleared: 0, discards: 0 },
  }
  replenish(game)
  makeSchedule(game)
  log(game, `${performerOf(selected.id).name}已就位 · 起始搭档 ${game.jokers[0].name}`, 'good')
  return game
}

export function beginBattle(game) {
  if (game.phase !== 'ready' || !game.allies.length) return false
  if (game.feint) {
    const { fielded, target } = scoutRead(game)
    if (game.gold >= FEINT.stake && fielded.length >= 2 && fielded.includes(game.feint.flag)) {
      game.gold -= FEINT.stake
      Object.assign(game.feint, { target, result: 'active' })
      log(game, `敌将盯上${REGIMENTS[target].name} · 亮旗花费 ${FEINT.stake} 金币`, 'danger')
    } else {
      game.feint = null
      log(game, '兵力或金币不足，军团已收起假旗', 'normal')
    }
  }
  game.selected = []
  game.phase = 'battle'
  const shield = 3 * copies(game,'ward-pin')
  if (shield) {
    for (const ally of game.allies) ally.shield += shield
    trigger(game,'ward-pin','全军护盾 +'+shield)
  }
  spawnEnemies(game)
  applyOpeningItems(game)
  log(game, `${WAVES[game.wave - 1].name}全军入场 · 军团自动交战`, 'danger')
  return true
}

export function endWave(game) {
  if (game.phase !== 'battle') return
  const captain = game.allies.find(unit => unit.id === game.champion?.unitId && unit.hp > 0)
  if (captain) advanceChampion(game,captain)

  game.allies = game.allies.filter(unit => unit.echoUntil == null)
  const repair = copies(game,'gate-rivet')
  if (repair && game.baseHp < game.maxBaseHp) { restoreBase(game,repair); trigger(game,'gate-rivet','修复城门') }
  game.stats.wavesCleared = game.wave
  if (game.wave === WAVES.length) {
    regroupArmy(game)
    game.phase = 'won'
    game.selected = []
    game.bossTelegraph = null
    log(game, '终幕落定。你的军团守住了这座城。', 'epic')
    effect(game, 'burst', 500, 180, '军团凯旋', '#e5c995')
    return
  }
  game.phase = 'shop'
  game.selected = []
  game.bossTelegraph = null
  const reward = 8 + game.wave * 2
  if (game.schedule.some(spawn => spawn.type === 'bellkeeper') && game.tacticsReport.tolls === 0) {
    game.tacticsReport.bounty = SILENT_BOUNTY
    log(game, `止钟赏金 +${SILENT_BOUNTY} · 城门未受钟击`, 'epic')
  }
  const wages = copies(game,'field-pay')
  gainGold(game, reward + game.tacticsReport.bounty + wages)
  if (wages) trigger(game,'field-pay','分红 +'+wages+' 金币')
  // Keep the battlefield backdrop separate from the restored camp roster.
  game.lastField = game.allies.slice(0,FIELD_LIMIT).map(u => ({
    id:u.id, appearanceId:u.appearanceId, pattern:u.pattern || null, variantRank:u.variantRank || null, grade:u.grade ?? 0, x:u.x, y:u.y, level:u.level,
    fusion:u.fusion || null, standard:!!u.standard,
  }))
  regroupArmy(game)
  game.victorySeen = false
  game.trainedHere = false
  game.rewards = [
    { id: 'repair', name: '修复城堡', description: '城堡恢复 20 生命。稳住下一波的容错。', icon: '♡' },
    { id: 'power', name: '淬炼军团', description: '之后征募的士兵基础属性提高 8%。', icon: '♠' },
    { id: 'supply', name: '战地补给', description: '获得 6 金币，下波额外获得 1 次弃牌。', icon: '◇' },
  ]
  if ([2,4].includes(game.wave)) game.rewards.push({id:'enlist', name:'收编枪兵', description:'下波一名枪兵入阵；满编时转为集训经验。', icon:'♠'})
  game.rewardChosen = false
  game.bonusDiscard = 0
  refreshShop(game)
  log(game, `第 ${game.wave} 波守住了 · 金币 +${reward} · 军团已归营`, 'good')
}

export function regroupArmy(game) {
  game.allies = [...game.allies.filter(u => u.echoUntil == null).map(restedSoldier), ...game.casualties]
  game.casualties = []
  for (const unit of game.allies) grantExperience(game,unit,1)
  if (game.champion && !game.allies.some(unit => unit.id === game.champion.unitId)) game.champion.unitId = null
  arrangeCamp(game)
}

export function nextWave(game) {
  if (game.phase !== 'shop' || !game.rewardChosen || game.wave >= WAVES.length) return false
  game.reserveUsed = false
  game.preparedScore = 0
  game.bellReady = false
  game.handsLeft = HANDS_PER_WAVE
  game.handsBought = 0
  game.paidHandsLeft = 0
  game.legacyFieldSize = game.allies.length > FIELD_LIMIT ? game.allies.length : 0
  game.wave++
  game.royalMarch = false
  game.lastField = []
  game.victorySeen = false
  game.trickUsed = false
  game.palmedCard = null
  game.convoyTaken = null
  game.feint = null
  game.phase = 'ready'
  game.waveTime = 0
  game.waveTimeout = null
  game.fusionUses = {}
  game.waveReport = emptyWaveReport()
  game.tacticsReport = emptyTacticsReport()
  game.waveKills = 0
  game.waveSpawned = 0
  game.battleId++
  game.discards = game.maxDiscards + (game.bonusDiscard || 0) + copies(game,'supply-satchel')
  game.energy = game.maxEnergy
  game.deployCooldown = 0
  game.discardCooldown = 0
  game.selected = []
  game.effects = []
  game.chain = 0
  game.chainTimer = 0
  game.bossTelegraph = null
  game.lastDeploy = null
  game.rewards = []
  game.shop = []
  game.soldShop = []
  const kept = game.hand.find(card => card.id === game.keptCardId)
  game.hand = kept ? [kept] : []
  game.keptCardId = null
  game.deck = []
  replenish(game)
  if (game.champion && !game.champion.unitId && !game.hand.some(c => slotOf(c) === game.champion.slot)) {
    const index = game.deck.findIndex(c => slotOf(c) === game.champion.slot)
    if (index >= 0) [game.hand[7],game.deck[index]] = [game.deck[index],game.hand[7]]
  }
  if (game.rewardChosen === 'enlist') {
    const face = DETACHMENTS.twoPair.members[0]
    const identity = {...recruitIdentity(face,1,'enlist'),pattern:'twoPair'}
    const plan = muster(game,identity)
    if (plan.trainer) grantExperience(game,plan.trainer,plan.xp)
    else addUnit(game,face.type,'ally',1,{identity})
    arrangeCamp(game)
  }
  game.rewardChosen = false
  game.orderTarget = null
  game.trainedHere = false
  game.printsLeft = PRINTS_PER_WAVE
  makeSchedule(game)
  log(game, `${WAVES[game.wave - 1].name}即将来袭 · 可整编驻军或继续征兵`, 'danger')
  if (kept) log(game,'夹层从袖底取回 ' + faceOf(kept),'good')
  return true
}
