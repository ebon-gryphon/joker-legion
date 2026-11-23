import { getCardDesign } from './cardCatalog.js'
import { JOBS } from './jobs.js'
import { QUALITIES } from './quality.js'
import { WAVES } from './campaignRules.js'
import { soldierIdentity } from './soldierIdentity.js'
import { FORMATION_BY_ID } from './tactics.js'
import { FUSION_BY_ID } from './forge.js'

const copy = value => JSON.parse(JSON.stringify(value))
const tally = () => ({damage:0, healed:0, taken:0, absorbed:0, kills:0, deaths:0})
const fallbackRunId = g => JSON.stringify([g.seed,g.doctrine,g.difficulty || 'standard'])
const identity = (g,runId) => JSON.stringify([runId,g.battleId,g.wave])
const safe = n => Number.isFinite(n) && n >= 0 && n <= 1e12
const text = s => typeof s === 'string' && s.length <= 500

export function initializeCombatStats(game, {runId, partial = false} = {}) {
  const id = runId || game.combatLedger?.runId || fallbackRunId(game)
  game.combatLedger = {
    version:1, runId:id, waveId:identity(game,id), seed:String(game.seed), doctrine:game.doctrine,
    difficulty:game.difficulty || 'standard', wave:game.wave, battleId:game.battleId,
    partial, started:game.phase==='battle', ended:false, result:null, fromWaveTime:game.waveTime || 0,
    duration:0, gate:{start:game.baseHp,battleStart:game.phase==='battle'?game.baseHp:null,end:game.baseHp,damage:0,repaired:0,untracked:0,
      preparationDamage:0,preparationRepaired:0,battleDamage:0,battleRepaired:0},
    energyStart:game.energy, energyLeft:game.energy, units:[], systems:[], orders:[], pendingKills:[], creditedKills:[],
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

export function recordGateDamage(game, amount) {
  const ledger=ledgerFor(game)
  if (!ledger.ended) {
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
export function recordOrder(game, preview, secondary) {
  const ledger=ledgerFor(game)
  if (ledger.ended || ledger.orders.some(order=>order.id===game.lastDeploy.id)) return
  registerArmy(game)
  ledger.orders.push({id:game.lastDeploy.id,key:preview.key,name:preview.name,target:preview.target,
    secondary:secondary || null,score:preview.score.total,cost:preview.cost,phase:game.phase,
    at:game.waveTime || 0,energyLeft:game.energy})
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
  current.duration=Math.max(0,(game.waveTime || 0)-ledger.fromWaveTime)
  current.battleDuration=game.waveTime || 0
  current.energyLeft=game.energy
  current.gate.end=game.baseHp
  current.gate.netLoss=current.gate.start-current.gate.end
  current.gate.combatNetLoss=current.gate.battleStart===null?null:current.gate.battleStart-current.gate.end
  current.gate.untracked=current.gate.end-(current.gate.start-current.gate.damage+current.gate.repaired)
  current.formation=game.formation
  current.tacticsReport=copy(game.tacticsReport)
  current.fusionUses=copy(game.fusionUses)
  current.regimentReport=copy(game.waveReport)
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

export function migrateCombatStats(game, original) {
  if (original.combatLedger) return
  initializeCombatStats(game,{partial:true})
  if(game.phase==='battle') beginCombatStats(game)
  if(['shop','won','lost'].includes(game.phase)) finishCombatStats(game,game.phase==='lost'?'lost':'cleared')
}

function validRow(row, system=false) {
  return !!row && text(system?row.id:row.unitId) && text(row.name) && Object.keys(tally()).every(key=>safe(row[key])) &&
    Number.isSafeInteger(row.kills) && Number.isSafeInteger(row.deaths) &&
    (system || text(row.appearanceId) && text(row.type) && text(row.jobId) && text(row.jobLabel) && text(row.qualityLabel) &&
      Number.isSafeInteger(row.grade) && row.grade>=0 && row.grade<=6 && ['echo','participated','alive'].every(k=>typeof row[k]==='boolean'))
}
export function validCombatRecord(value, ledger=false) {
  if(!value || value.version!==1 || ![value.runId,value.waveId,value.seed,value.doctrine,value.difficulty].every(text) ||
    !Number.isSafeInteger(value.wave) || value.wave<1 || value.wave>WAVES.length || !Number.isSafeInteger(value.battleId) || value.battleId<1 ||
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
      ['ready','battle'].includes(o.phase) && ['score','cost','at','energyLeft'].every(k=>safe(o[k]))) ||
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
        Math.abs(value.gate.combatNetLoss-value.gate.battleStart+value.gate.end)>1e-6))) return false
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
    ledger.seed===String(game.seed) && ledger.doctrine===game.doctrine && ledger.difficulty===(game.difficulty || 'standard') &&
    ledger.fromWaveTime<=game.waveTime &&
    (ledger.ended ? !!game.lastCombatReport && validCombatRecord(game.lastCombatReport) &&
      game.lastCombatReport.waveId===ledger.waveId && ['shop','won','lost'].includes(game.phase) &&
      ledger.result===(game.phase==='lost'?'lost':'cleared') : game.lastCombatReport==null)
}
