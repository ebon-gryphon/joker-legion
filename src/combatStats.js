import {openingLines} from './legacyRun.js'
import { getCardDesign } from './cardCatalog.js'
import { JOBS } from './jobs.js'
import { QUALITIES } from './quality.js'
import { WAVES, JOKER_BY_ID, RANKS, SUITS } from './campaignRules.js'
import { ORDER_BOOK } from './orders.js'
import { soldierIdentity } from './soldierIdentity.js'
import { FORMATION_BY_ID } from './tactics.js'
import { FUSION_BY_ID } from './forge.js'
import {BUILD_PASSIVE_BY_ID,validBuildPassiveEvent} from './buildPassives.js'

const copy = value => JSON.parse(JSON.stringify(value))
const tally = () => ({damage:0, healed:0, taken:0, absorbed:0, kills:0, deaths:0})
const fallbackRunId = g => JSON.stringify([g.seed,g.doctrine,g.difficulty || 'standard',...(g.mode==='endless'?['endless']:[])])
const identity = (g,runId) => JSON.stringify([runId,g.battleId,g.wave])
const safe = n => Number.isFinite(n) && n >= 0 && n <= 1e12
const text = s => typeof s === 'string' && s.length <= 500
const TRACKED_ITEMS=['score-chalk','pair-ink','third-act','iron-banner','red-echo','heart-engine']

export function initializeCombatStats(game, {runId, partial = false} = {}) {
  const id = runId || game.combatLedger?.runId || fallbackRunId(game)
  game.combatLedger = {
    version:1, runId:id, waveId:identity(game,id), seed:String(game.seed), doctrine:game.doctrine,
    mode:game.mode || 'standard',enemyEvents:[],difficulty:game.difficulty || 'standard', wave:game.wave, battleId:game.battleId,
    partial, started:game.phase==='battle', ended:false, result:null, fromWaveTime:game.waveTime || 0,
    duration:0, gate:{start:game.baseHp,battleStart:game.phase==='battle'?game.baseHp:null,end:game.baseHp,damage:0,repaired:0,untracked:0,
      preparationDamage:0,preparationRepaired:0,battleDamage:0,battleRepaired:0,sources:{bell:0,breach:0,timeout:0,unknown:0}},
    energyStart:game.energy, energyLeft:game.energy, units:[], systems:[], orders:[], itemEvents:[], pendingKills:[], creditedKills:[],
    ...(game.lifeVersion===1?{lifeVersion:1,lifeStart:game.baseHp,lifeMaxStart:game.maxBaseHp}:{}),lifeEvents:[],passiveEvents:[],
  }
  game.lastCombatReport = null
  registerArmy(game)
  return game.combatLedger
}

function ledgerFor(game) {
  const ledger = game.combatLedger
  if (!ledger || ledger.wave !== game.wave || ledger.battleId !== game.battleId)
    return initializeCombatStats(game,{partial:true})
  return ledger
}

function soldierRow(ledger, unit) {
  if (!unit || unit.side !== 'ally') return null
  let row = ledger.units.find(row => row.unitId === unit.id)
  const design = getCardDesign(unit)
  const display = soldierIdentity(unit)
  const details = {
    name:display.name || '未记录身份的士兵', appearanceId:design?.id || '',
    type:unit.type, jobId:unit.jobId || '', jobLabel:display.profession || JOBS[unit.jobId]?.name || '',
    qualityLabel:display.quality || QUALITIES[unit.grade || 0]?.name || '', grade:unit.grade || 0,
    echo:unit.echoUntil != null,
  }
  if (!row) {
    row = {unitId:unit.id,...details,...tally(),participated:false,alive:true}
    ledger.units.push(row)
  } else Object.assign(row,details)
  return row
}

export function registerArmy(game) {
  const ledger = game.combatLedger
  if (!ledger || ledger.ended) return
  for (const unit of game.allies) {
    const row = soldierRow(ledger,unit)
    row.participated ||= game.phase === 'battle'
  }
}

function sourceRow(ledger, source) {
  if (source?.side === 'ally') return soldierRow(ledger,source)
  // Items pooling several soldiers' actions cannot be credited to the last actor.
  const id = source?.system || 'unattributed'
  let row = ledger.systems.find(row => row.id === id)
  if (!row) { row={id,name:source?.label || (id==='unattributed'?'未归因来源':id),...tally()};ledger.systems.push(row) }
  return row
}

export function recordDamage(game, target, dealt, absorbed, source) {
  const ledger = ledgerFor(game)
  if (ledger.ended) return
  if (target.side === 'ally') {
    const row=soldierRow(ledger,target)
    row.taken+=dealt;row.absorbed+=absorbed;row.participated ||= game.phase==='battle'
  } else if (target.side === 'enemy' && (dealt > 0 || absorbed > 0)) {
    const row=sourceRow(ledger,source)
    row.damage+=dealt
    if (row.unitId) row.participated ||= game.phase==='battle'
    if (dealt>0 && target.hp<=0 && !ledger.pendingKills.some(k=>k.targetId===target.id))
      ledger.pendingKills.push({targetId:target.id,unitId:row.unitId || null,systemId:row.unitId?null:row.id})
  }
}

export function recordHealing(game, target, restored, source) {
  if (restored<=0 || target.side!=='ally') return
  const ledger=ledgerFor(game)
  if (ledger.ended) return
  soldierRow(ledger,target)
  const row=sourceRow(ledger,source)
  row.healed+=restored
  if (row.unitId) row.participated ||= game.phase==='battle'
}

export function recordDeath(game, unit) {
  const ledger=ledgerFor(game)
  if (ledger.ended) return
  if (unit.side==='ally') {
    const row=soldierRow(ledger,unit)
    if (row.alive) { row.alive=false;if(unit.echoUntil==null) row.deaths++ }
  } else if (!unit.breached && !ledger.creditedKills.includes(unit.id)) {
    const credit=ledger.pendingKills.find(k=>k.targetId===unit.id)
    const row=credit?.unitId ? ledger.units.find(r=>r.unitId===credit.unitId) :
      sourceRow(ledger,{system:credit?.systemId || 'unattributed'})
    if (row) row.kills++
    ledger.creditedKills.push(unit.id)
  }
}

export function recordGateDamage(game, amount, source='unknown') {
  const ledger=ledgerFor(game)
  if (!ledger.ended) {
    ledger.gate.sources ??= {bell:0,breach:0,timeout:0,unknown:ledger.gate.damage}
    ledger.gate.sources[['bell','breach','timeout'].includes(source)?source:'unknown']+=amount
    ledger.gate.damage+=amount
    const part=ledger.started?'battleDamage':'preparationDamage'
    if(ledger.gate[part]!==undefined) ledger.gate[part]+=amount
  }
}
export function recordGateRepair(game, amount) {
  const ledger=ledgerFor(game)
  if (!ledger.ended) {
    ledger.gate.repaired+=amount
    const part=ledger.started?'battleRepaired':'preparationRepaired'
    if(ledger.gate[part]!==undefined) ledger.gate[part]+=amount
  }
}
export function recruitmentOutcome(preview,{joined=[],reserve=null,trainer=null,xpGain=0}={}) {
  const recruit=preview.recruits[0] || preview.reserve[0]
  return {status:joined.length?'fielded':reserve?'reserve':trainer?'training':'unresolved',
    profession:preview.profession,grade:preview.captainGrade,minimumGrade:preview.grade,level:recruit?.level || 1,
    appearanceId:recruit?.appearanceId || '',recruitId:joined[0]?.id || reserve?.id || null,
    recipientId:trainer?.id || null,recipientName:trainer?soldierIdentity(trainer).name:'',
    plannedXp:preview.trainingXp || 0,xpGain}
}

export function recordItemEvent(game,actual,{orderId=null,orderOrdinal=null,targetIds=[]}={}) {
  const ledger=ledgerFor(game)
  if(ledger.ended) return
  ledger.itemEvents ??= []
  const event={index:ledger.itemEvents.length,at:game.waveTime || 0,phase:game.phase,
    orderId,orderOrdinal,targetIds:[...new Set(targetIds)],...copy(actual)}
  ledger.itemEvents.push(event)
  return event
}

export function compactScoreTrace(trace) {
  if(!trace) return null
  return copy({version:trace.version,id:trace.id,mode:trace.mode,
    hand:{key:trace.hand.key,name:trace.hand.name,level:trace.hand.level},
    scoringCards:trace.scoringCards.map(({suit,rank,points})=>({suit,rank,points})),
    nonScoringCards:trace.nonScoringCards.map(({suit,rank})=>({suit,rank})),
    chipsBeforeMult:trace.chipsBeforeMult,mult:trace.mult,finalScore:trace.finalScore,...(trace.finalBonus?{finalBonus:copy(trace.finalBonus)}:{}),
    chipBonuses:trace.chipBonuses.map(({id,delta,quantity})=>({id,delta,quantity})),
    quality:{floor:trace.quality.floor,rolled:trace.quality.rolled},recruit:trace.recruit,
    order:trace.order,items:trace.items.map(({id,quantity,actual})=>({id,quantity,actual})),
    ...(trace.passives?{passives:copy(trace.passives)}:{})})
}

export function recordOrder(game, preview, secondary, resolution={}) {
  const ledger=ledgerFor(game)
  if (ledger.ended || ledger.orders.some(order=>order.id===game.lastDeploy.id)) return
  registerArmy(game)
  ledger.orders.push({id:game.lastDeploy.id,key:preview.key,name:preview.name,target:preview.target,
    secondary:secondary || null,score:preview.score.total,cost:preview.cost,phase:game.phase,
    at:game.waveTime || 0,energyLeft:game.energy,
    ...(resolution.recruit?{recruitment:copy(resolution.recruit)}:{}),
    ...(resolution.scoreTrace?{scoreTrace:compactScoreTrace(resolution.scoreTrace)}:{})})
  for(const event of ledger.itemEvents || []) if(event.orderId===null && event.phase==='ready' && event.orderOrdinal===game.stats.deploys)
    event.orderId=game.lastDeploy.id
  for(const actual of resolution.items || []) if(actual.id!=='heart-engine' || !actual.triggered)
    recordItemEvent(game,{...actual,quantity:resolution.scoreTrace?.items.find(item=>item.id===actual.id)?.quantity},
      {orderId:game.lastDeploy.id,orderOrdinal:game.stats.deploys})
  ledger.energyLeft=game.energy
}

export function beginCombatStats(game) {
  const ledger=ledgerFor(game)
  if (ledger.started || ledger.ended) return
  ledger.started=true
  ledger.gate.battleStart=game.baseHp
  registerArmy(game)
}

function reportOf(game, ledger) {
  const current=copy(ledger)
  if(game.inheritance && Object.values(game.inheritance.levels).some(Boolean))current.openingBenefits=openingLines(game.inheritance)
  current.duration=Math.max(0,(game.waveTime || 0)-ledger.fromWaveTime)
  current.battleDuration=game.waveTime || 0
  if(ledger.started && !ledger.partial && game.encounterVersion===1){
    current.enemyForce={regular:game.spawnIndex,total:game.waveSpawned,
      summoned:game.lifeEvents.filter(e=>e.kind==='bell-summon').length,
      brood:ledger.enemyEvents.filter(e=>e.kind==='split').reduce((sum,e)=>sum+e.amount,0)}
  }
  current.energyLeft=game.energy
  current.gate.end=game.baseHp
  current.gate.netLoss=current.gate.start-current.gate.end
  current.gate.combatNetLoss=current.gate.battleStart===null?null:current.gate.battleStart-current.gate.end
  current.gate.untracked=current.gate.end-(current.gate.start-current.gate.damage+current.gate.repaired)
  current.formation=game.formation
  current.tacticsReport=copy(game.tacticsReport)
  current.fusionUses=copy(game.fusionUses)
  current.passiveEvents=copy(game.buildPassives?.events || [])
  current.lifeEvents=copy(game.lifeEvents || [])
  if(ledger.lifeVersion===1){current.lifeVersion=1;current.lifeStart=ledger.lifeStart;current.lifeEnd=game.baseHp;current.lifeMaxStart=ledger.lifeMaxStart;current.lifeMaxEnd=game.maxBaseHp}
  current.regimentReport=copy(game.waveReport)
  const status=!ledger.ended?'ongoing':ledger.result==='lost'?'defeat':game.mode!=='endless' && game.wave===(game.campaignLength || WAVES.length)?'victory':'wave-cleared'
  current.runOutcome={status,wave:game.wave,clearedWaves:game.stats.wavesCleared,
    terminal:['defeat','victory'].includes(status),finalWave:['defeat','victory'].includes(status)?game.wave:null}
  current.units.forEach(row=> {if(row.participated) row.alive=game.allies.some(u=>u.id===row.unitId && u.hp>0)})
  current.totals=[...current.units,...current.systems].reduce((sum,row)=> {
    for(const key of Object.keys(sum)) sum[key]+=row[key]
    return sum
  },tally())
  const orders=new Map()
  for(const order of current.orders) {
    const key=order.key+'/'+order.target+'/'+(order.secondary || '')
    const entry=orders.get(key) || {key:order.key,name:order.name,target:order.target,secondary:order.secondary,count:0,cost:0}
    entry.count++;entry.cost+=order.cost;orders.set(key,entry)
  }
  current.majorOrders=[...orders.values()].sort((a,b)=>b.count-a.count).slice(0,5)
  delete current.pendingKills
  delete current.creditedKills
  return current
}

export function finishCombatStats(game,result) {
  const ledger=ledgerFor(game)
  if (ledger.ended) return game.lastCombatReport
  registerArmy(game)
  ledger.ended=true;ledger.result=result
  game.lastCombatReport=reportOf(game,ledger)
  return game.lastCombatReport
}

export function combatSummary(game) {
  if (game.combatLedger?.ended) return game.lastCombatReport
  return game.combatLedger ? reportOf(game,game.combatLedger) : null
}

// Rewards extend the current wave's factual timeline after combat has ended.
// Reuse the frozen battle rows: regrouped soldiers must not become survivors
// retroactively, and the new object lets local history replace this wave.
export function syncPostWaveRewardReport(game) {
  const report=game.lastCombatReport,ledger=game.combatLedger
  if(!ledger?.ended || !report?.ended || report.wave!==game.wave ||
      report.battleId!==game.battleId || report.waveId!==ledger.waveId)return report || null
  const lifeEvents=copy(game.lifeEvents || []),passiveEvents=copy(game.buildPassives?.events || [])
  if(report.lifeVersion===1)game.lastCombatReport={...report,lifeEvents,passiveEvents,lifeEnd:game.baseHp,lifeMaxEnd:game.maxBaseHp}
  else {
    const merged=new Map([...(report.passiveEvents || []),...passiveEvents].map(event=>[event.eventId,event]))
    const postWaveLife=lifeEvents.length?{lifeVersion:1,wave:game.wave,lifeStart:lifeEvents[0].before,lifeMaxStart:lifeEvents[0].maxBefore,
      lifeEnd:game.baseHp,lifeMaxEnd:game.maxBaseHp,lifeEvents}:report.postWaveLife
    game.lastCombatReport={...report,passiveEvents:copy([...merged.values()]),...(postWaveLife?{postWaveLife}:{})}
  }
  return game.lastCombatReport
}

export function migrateCombatStats(game, original) {
  if (original.combatLedger) return
  initializeCombatStats(game,{partial:true})
  if(game.phase==='battle') beginCombatStats(game)
  if(['shop','won','lost','retired'].includes(game.phase)) finishCombatStats(game,game.phase==='lost'?'lost':'cleared')
}

function validRow(row, system=false) {
  return !!row && text(system?row.id:row.unitId) && text(row.name) && Object.keys(tally()).every(key=>safe(row[key])) &&
    Number.isSafeInteger(row.kills) && Number.isSafeInteger(row.deaths) &&
    (system || text(row.appearanceId) && text(row.type) && text(row.jobId) && text(row.jobLabel) && text(row.qualityLabel) &&
      Number.isSafeInteger(row.grade) && row.grade>=0 && row.grade<=6 && ['echo','participated','alive'].every(k=>typeof row[k]==='boolean'))
}

function validRecruitment(value) {
  return !!value && ['fielded','reserve','training','unresolved'].includes(value.status) && text(value.profession) &&
    Number.isSafeInteger(value.grade) && value.grade>=0 && value.grade<=6 && Number.isSafeInteger(value.minimumGrade) && value.minimumGrade>=0 && value.minimumGrade<=value.grade &&
    Number.isSafeInteger(value.level) && value.level>=1 && value.level<=3 && text(value.appearanceId) &&
    [value.recruitId,value.recipientId].every(id=>id===null || text(id)) && text(value.recipientName) && safe(value.plannedXp) && safe(value.xpGain)
}

function validItemActual(value) {
  return value && TRACKED_ITEMS.includes(value.id) && typeof value.triggered==='boolean' && typeof value.effective==='boolean' &&
    (value.quantity===undefined || Number.isSafeInteger(value.quantity) && value.quantity>=0) &&
    (!value.effective || value.triggered) && text(value.reason) && value.effects && !Array.isArray(value.effects) && Object.values(value.effects).every(safe)
}

export function validOrderScoreTrace(value,full=false) {
  const card=c=>c && Object.hasOwn(SUITS,c.suit) && RANKS.includes(c.rank)
  return !!value && value.version===1 && value.mode==='resolved' && text(value.id) &&
    value.hand && Object.hasOwn(ORDER_BOOK,value.hand.key) && text(value.hand.name) && Number.isSafeInteger(value.hand.level) && value.hand.level>=1 && value.hand.level<=3 &&
    Array.isArray(value.scoringCards) && value.scoringCards.length>=1 && value.scoringCards.length<=5 && value.scoringCards.every(c=>card(c) && safe(c.points)) &&
    Array.isArray(value.nonScoringCards) && value.nonScoringCards.length<=5 && value.nonScoringCards.every(card) &&
    value.scoringCards.length+value.nonScoringCards.length<=5 &&
    ['chipsBeforeMult','mult','finalScore'].every(k=>safe(value[k])) &&
    (!value.finalBonus || safe(value.finalBonus.percent) && value.finalBonus.percent<=1+Math.max(BUILD_PASSIVE_BY_ID['same-hand'].effect.percent,BUILD_PASSIVE_BY_ID['varied-hand'].effect.percent) && safe(value.finalBonus.amount) && text(value.finalBonus.source) && value.finalBonus.amount===Math.floor(value.chipsBeforeMult*value.mult*(1+value.finalBonus.percent))-value.chipsBeforeMult*value.mult &&
      (value.finalBonus.sources===undefined || Array.isArray(value.finalBonus.sources)&&value.finalBonus.sources.length>0&&value.finalBonus.sources.length<=3&&new Set(value.finalBonus.sources.map(row=>row?.id)).size===value.finalBonus.sources.length&&value.finalBonus.sources.every(row=>row&&['wave-first-score','same-hand','varied-hand'].includes(row.id)&&text(row.label)&&safe(row.percent)&&row.percent<=1)&&Math.abs(value.finalBonus.sources.reduce((sum,row)=>sum+row.percent,0)-value.finalBonus.percent)<1e-8)) &&
    value.chipsBeforeMult*value.mult+(value.finalBonus?.amount || 0)===value.finalScore &&
    Array.isArray(value.chipBonuses) && value.chipBonuses.length<=20 && value.chipBonuses.every(r=>r && Object.hasOwn(JOKER_BY_ID,r.id) && safe(r.delta) && safe(r.quantity)) &&
    value.quality && [value.quality.floor,value.quality.rolled].every(n=>Number.isSafeInteger(n) && n>=0 && n<=6) && value.quality.rolled>=value.quality.floor &&
    value.recruit && text(value.recruit.profession) && text(value.recruit.summary) && safe(value.recruit.actualCount) && safe(value.recruit.xp) &&
    typeof value.recruit.reserve==='boolean' && typeof value.recruit.overflow==='boolean' &&
    (value.recruit.receiver===null || value.recruit.receiver && text(value.recruit.receiver.id) && text(value.recruit.receiver.name)) &&
    value.order && value.order.sourceScore===value.finalScore && value.order.bonus && Object.entries(value.order.bonus).every(([key,n])=>['force','shield','vitality','haste'].includes(key) && safe(n)) &&
    (value.passives===undefined || Array.isArray(value.passives)&&value.passives.length<=12&&new Set(value.passives.map(row=>row?.id)).size===value.passives.length&&value.passives.every(row=>row&&Object.hasOwn(BUILD_PASSIVE_BY_ID,row.id)&&text(row.label)&&text(row.reason)&&typeof row.eligible==='boolean'&&typeof row.applied==='boolean'&&(!row.actual||typeof row.actual.triggered==='boolean'&&typeof row.actual.effective==='boolean'&&text(row.actual.reason)&&row.actual.effects&&Object.values(row.actual.effects).every(safe)))) &&
    Array.isArray(value.items) && value.items.length<=6 && new Set(value.items.map(item=>item?.id)).size===value.items.length && value.items.every(r=>r && TRACKED_ITEMS.includes(r.id) && safe(r.quantity) && (r.actual===null || validItemActual(r.actual) && r.actual.id===r.id)) &&
    (value.steps===undefined || Array.isArray(value.steps) && value.steps.length<=64 && value.steps.every(step=>step && text(step.kind) && text(step.id) && text(step.label))) &&
    (value.selectedCards===undefined || Array.isArray(value.selectedCards) && value.selectedCards.length<=5 && value.selectedCards.every(c=>card(c) && text(c.id) && typeof c.scoring==='boolean')) &&
    (!full || Array.isArray(value.selectedCards) && value.selectedCards.length>=1 && Array.isArray(value.steps) &&
      ['baseChips','levelChips','baseMult','levelMult','mult'].every(key=>safe(value.hand[key])) && text(value.quality.name) &&
      Array.isArray(value.quality.odds) && value.quality.odds.length<=7 && value.quality.odds.every(row=>row && Number.isSafeInteger(row.grade) && row.grade>=0 && row.grade<=6 && text(row.name) && safe(row.chance) && row.chance<=100) &&
      text(value.order.label) && safe(value.order.crownMultiplier) &&
      value.items.every(item=>text(item.label) && text(item.reason) && text(item.condition) && ['chips','muster','afterOrder','combat'].includes(item.phase) &&
        typeof item.eligible==='boolean' && typeof item.applied==='boolean' && item.potential && Object.values(item.potential).every(safe)) &&
      value.chipBonuses.every(item=>text(item.label)) &&
      value.steps.every(step=>['delta','chips','mult','total'].every(key=>step[key]===undefined || safe(step[key]))))
}

export function discardInvalidScoreMetadata(container) {
  if(!container || typeof container!=='object') return container
  for(const orders of [container.orders,container.combatLedger?.orders,container.lastCombatReport?.orders]) {
    if(Array.isArray(orders)) for(const order of orders) if(order?.scoreTrace!==undefined && !validOrderScoreTrace(order.scoreTrace)) delete order.scoreTrace
  }
  if(container.lastDeploy?.scoreTrace!==undefined && !validOrderScoreTrace(container.lastDeploy.scoreTrace,true)) delete container.lastDeploy.scoreTrace
  return container
}
const validLifeEvent=row=>row&&text(row.id)&&text(row.source)&&text(row.sourceId)&&
  ['loss','heal','max','failure','end','bell-summon','bell-blocked','bell-kill','bell-breach','bell-timeout'].includes(row.kind)&&
  ['before','after','amount','maxBefore','maxAfter','at'].every(key=>safe(row[key]))&&Number.isSafeInteger(row.wave)&&row.wave>=1
function validEnemyEvent(e) {
  if(!e || !safe(e.at) || !text(e.actor) || !['banner','hunter','splitter','brood','cantor'].includes(e.type))return false
  switch(e.kind) {
    case 'guard': return e.type==='banner' && text(e.target) && safe(e.amount)
    case 'hunt': return e.type==='hunter' && text(e.target) && text(e.name)
    case 'bonus': return e.type==='hunter' && text(e.target) && safe(e.amount)
    case 'split': return e.type==='splitter' && Array.isArray(e.children) && e.children.length<=2 &&
      new Set(e.children).size===e.children.length && e.children.every(text) && e.amount===e.children.length
    case 'heal': return e.type==='cantor' && text(e.target) && safe(e.amount) && e.amount>0
    case 'no-target': return e.type==='cantor' && e.amount===0
    case 'windup': case 'interrupt': return e.type==='cantor'
    case 'strike': return ['splitter','brood'].includes(e.type) && text(e.target) && safe(e.amount) && safe(e.absorbed) &&
      typeof e.killed==='boolean' && (e.parent===undefined || e.type==='brood' && text(e.parent))
    case 'hit': return text(e.source) && safe(e.amount)
    case 'kill': return e.parent===undefined || e.type==='brood' && text(e.parent)
    default: return false
  }
}

export function validCombatRecord(value, ledger=false) {
  if(value?.mode!==undefined && !['endless','standard'].includes(value.mode))return false
  if(value?.enemyEvents!==undefined && (!Array.isArray(value.enemyEvents) || !value.enemyEvents.every(validEnemyEvent)))return false
  if(value?.passiveEvents!==undefined&&(!Array.isArray(value.passiveEvents)||!value.passiveEvents.every(validBuildPassiveEvent)))return false
  if(value?.lifeVersion!==undefined&&(value.lifeVersion!==1||!safe(value.lifeStart)||!safe(value.lifeMaxStart)||value.lifeStart>value.lifeMaxStart ||
      !ledger&&(!safe(value.lifeEnd)||!safe(value.lifeMaxEnd)||value.lifeEnd>value.lifeMaxEnd)))return false
  if(value?.lifeEvents!==undefined&&(!Array.isArray(value.lifeEvents)||!value.lifeEvents.every(validLifeEvent)))return false
  if(value?.postWaveLife!==undefined){
    const post=value.postWaveLife
    if(!post || post.lifeVersion!==1 || post.wave!==value.wave || !['lifeStart','lifeMaxStart','lifeEnd','lifeMaxEnd'].every(key=>safe(post[key])) ||
      post.lifeStart>post.lifeMaxStart || post.lifeEnd>post.lifeMaxEnd || !Array.isArray(post.lifeEvents) || !post.lifeEvents.length ||
      !post.lifeEvents.every(row=>validLifeEvent(row)&&row.wave===post.wave))return false
  }
  if(!value || value.version!==1 || ![value.runId,value.waveId,value.seed,value.doctrine,value.difficulty].every(text) ||
    !Number.isSafeInteger(value.wave) || value.wave<1 || value.mode!=='endless' && value.wave>WAVES.length || !Number.isSafeInteger(value.battleId) || value.battleId<1 ||
    value.waveId!==identity({battleId:value.battleId,wave:value.wave},value.runId) ||
    !['partial','started','ended'].every(k=>typeof value[k]==='boolean') || ![null,'cleared','lost'].includes(value.result) ||
    value.ended!==(value.result!==null) ||
    !safe(value.fromWaveTime) || !safe(value.duration) || !safe(value.energyStart) || !safe(value.energyLeft) ||
    (value.battleDuration!==undefined && (!safe(value.battleDuration) || value.battleDuration<value.duration)) ||
    !value.gate || !['start','end','damage','repaired'].every(k=>safe(value.gate[k])) ||
    !(value.gate.battleStart===null || safe(value.gate.battleStart)) || !Number.isFinite(value.gate.untracked) ||
    !Array.isArray(value.units) || value.units.length>2048 || !value.units.every(r=>validRow(r)) ||
    new Set(value.units.map(r=>r.unitId)).size!==value.units.length ||
    !Array.isArray(value.systems) || value.systems.length>100 || !value.systems.every(r=>validRow(r,true)) ||
    new Set(value.systems.map(r=>r.id)).size!==value.systems.length ||
    !Array.isArray(value.orders) || value.orders.length>2048 || !value.orders.every(o=>o &&
      [o.id,o.key,o.name,o.target].every(text) && (o.secondary===null || text(o.secondary)) &&
      ['ready','battle'].includes(o.phase) && ['score','cost','at','energyLeft'].every(k=>safe(o[k])) &&
      (o.recruitment===undefined || validRecruitment(o.recruitment)) &&
      (o.scoreTrace===undefined || validOrderScoreTrace(o.scoreTrace))) ||
    new Set(value.orders.map(o=>o.id)).size!==value.orders.length) return false
  if((value.formation!==undefined && !Object.hasOwn(FORMATION_BY_ID,value.formation)) ||
    (value.tacticsReport!==undefined && (!value.tacticsReport || Array.isArray(value.tacticsReport) ||
      !['prevented','extraDamage','tolls','gateDamage','interrupts','bounty'].every(key=>safe(value.tacticsReport[key])))) ||
    (value.fusionUses!==undefined && (!value.fusionUses || Array.isArray(value.fusionUses) ||
      !Object.entries(value.fusionUses).every(([id,count])=>Object.hasOwn(FUSION_BY_ID,id) && Number.isSafeInteger(count) && count>=0))) ||
    (value.regimentReport!==undefined && (!value.regimentReport || Array.isArray(value.regimentReport) ||
      !['knight','ranger','healer','mage'].every(type=>safe(value.regimentReport[type]?.damage) && safe(value.regimentReport[type]?.healed)))) ||
    !['preparationDamage','preparationRepaired','battleDamage','battleRepaired'].every(key=>value.gate[key]===undefined || safe(value.gate[key])) ||
    (value.gate.combatNetLoss!==undefined && value.gate.combatNetLoss!==null &&
      (!Number.isFinite(value.gate.combatNetLoss) || value.gate.battleStart===null ||
        Math.abs(value.gate.combatNetLoss-value.gate.battleStart+value.gate.end)>1e-6)) ||
    (value.gate.sources!==undefined && (!value.gate.sources || Array.isArray(value.gate.sources) ||
      Object.keys(value.gate.sources).length!==4 || !['bell','breach','timeout','unknown'].every(key=>safe(value.gate.sources[key])) ||
      Math.abs(Object.values(value.gate.sources).reduce((sum,n)=>sum+n,0)-value.gate.damage)>1e-6)) ||
    (value.itemEvents!==undefined && (!Array.isArray(value.itemEvents) || value.itemEvents.length>16384 || !value.itemEvents.every((event,index)=>
      validItemActual(event) && event.index===index && safe(event.at) && ['ready','battle'].includes(event.phase) &&
      (event.orderId===null || text(event.orderId)) && (event.orderOrdinal===null || Number.isSafeInteger(event.orderOrdinal) && event.orderOrdinal>=0) &&
      Array.isArray(event.targetIds) && event.targetIds.length<=100 && event.targetIds.every(text)))) ||
    (value.runOutcome!==undefined && (!value.runOutcome || !['ongoing','defeat','victory','retired','wave-cleared'].includes(value.runOutcome.status) ||
      value.runOutcome.wave!==value.wave || !Number.isSafeInteger(value.runOutcome.clearedWaves) || value.runOutcome.clearedWaves<0 || value.runOutcome.clearedWaves>value.wave ||
      value.runOutcome.terminal!==['defeat','victory','retired'].includes(value.runOutcome.status) ||
      value.runOutcome.finalWave!==(value.runOutcome.terminal?value.wave:null)))) return false
  if(ledger) return Array.isArray(value.pendingKills) && value.pendingKills.length<=100 &&
    value.pendingKills.every(k=>k && text(k.targetId) && (k.unitId===null || text(k.unitId)) && (k.systemId===null || text(k.systemId)) &&
      (k.unitId ? value.units.some(r=>r.unitId===k.unitId) : value.systems.some(r=>r.id===k.systemId))) &&
    Array.isArray(value.creditedKills) && value.creditedKills.length<=100 && value.creditedKills.every(text) &&
    new Set(value.creditedKills).size===value.creditedKills.length
  return value.ended && !!value.totals && Object.keys(tally()).every(k=>safe(value.totals[k]) &&
    Math.abs(value.totals[k]-[...value.units,...value.systems].reduce((sum,row)=>sum+row[k],0))<1e-6) &&
    Number.isFinite(value.gate.netLoss) && Math.abs(value.gate.netLoss-value.gate.start+value.gate.end)<1e-6 &&
    Array.isArray(value.majorOrders) && value.majorOrders.length<=5 && value.majorOrders.every(order=>order &&
      [order.key,order.name,order.target].every(text) && (order.secondary===null || text(order.secondary)) &&
      Number.isSafeInteger(order.count) && order.count>0 && safe(order.cost))
}

export function validCombatStats(game) {
  if(game.combatLedger==null && game.lastCombatReport==null) return true
  const ledger=game.combatLedger
  return validCombatRecord(ledger,true) && ledger.wave===game.wave && ledger.battleId===game.battleId &&
    (ledger.mode || 'standard')===(game.mode || 'standard') && ledger.seed===String(game.seed) && ledger.doctrine===game.doctrine && ledger.difficulty===(game.difficulty || 'standard') &&
    ledger.fromWaveTime<=game.waveTime &&
    (ledger.ended ? !!game.lastCombatReport && validCombatRecord(game.lastCombatReport) &&
      (game.lastCombatReport.mode || 'standard')===(ledger.mode || 'standard') && game.lastCombatReport.waveId===ledger.waveId && ['shop','won','lost','retired'].includes(game.phase) &&
      ledger.result===(game.phase==='lost'?'lost':'cleared') : game.lastCombatReport==null)
}
