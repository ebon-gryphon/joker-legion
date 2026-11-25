import {DIFFICULTIES} from './tactics.js'
/** Authoritative player life; starting capacity comes from difficulty config. */
export const LIFE_RULES=Object.freeze({version:1,standard:DIFFICULTIES.standard.lifeMax,veteran:DIFFICULTIES.veteran.lifeMax,maxMultiplier:2,breachLoss:1,itemHeal:1,expansion:2})
export const initialLifeMax=difficulty=>(DIFFICULTIES[difficulty] || DIFFICULTIES.standard).lifeMax
export const lifeMaxCap=gameOrDifficulty=>initialLifeMax(typeof gameOrDifficulty==='string'?gameOrDifficulty:gameOrDifficulty?.difficulty)*LIFE_RULES.maxMultiplier

export function playerLifeView(game) {
  const current=game?.baseHp ?? 0,max=game?.maxBaseHp ?? initialLifeMax(game?.difficulty),failed=game?.lifeFailed===true
  return {current,max,failed,atZero:current===0 && !failed,
    warning:failed?'生命挑战已结束。':current===0?'生命为 0，不能再放入任何敌人。':''}
}

/** Every entry contains measured before/after values, including zero healing. */
export function recordLifeEvent(game,{kind,source,sourceId,unit,before=game.baseHp,after=game.baseHp,
  amount=Math.abs(after-before),maxBefore=game.maxBaseHp,maxAfter=game.maxBaseHp,...details}) {
  game.lifeEvents ??= []
  const event={id:`life-${game.battleId || 1}-${game.lifeEvents.length+1}`,wave:game.wave,at:game.waveTime || 0,
    kind,source:source || 'unknown',sourceId:sourceId || unit?.id || source || 'unknown',
    before,after,amount,maxBefore,maxAfter,
    ...(unit?{unitId:unit.id,unitType:unit.type,unitName:unit.name || unit.type,
      ...(unit.bellSourceId?{bellSourceId:unit.bellSourceId,summonedBy:'bellkeeper'}:{})}:{}),...details}
  game.lifeEvents.push(event)
  return event
}

export function failPlayerLife(game,{source='boss-timeout',sourceId,unit}={}) {
  if(game.lifeFailed)return null
  const before=game.baseHp
  game.baseHp=0;game.lifeFailed=true
  return recordLifeEvent(game,{kind:'failure',source,sourceId,unit,before,after:0,amount:before,failed:true})
}

/** Reaching zero is safe; another actual ordinary escape while at zero fails. */
export function losePlayerLife(game,{source='breach',sourceId,unit,boss=false}={}) {
  if(game.lifeFailed)return null
  if(boss)return failPlayerLife(game,{source,sourceId,unit})
  const before=game.baseHp,after=Math.max(0,before-LIFE_RULES.breachLoss)
  game.baseHp=after
  game.lifeFailed=before===0
  return recordLifeEvent(game,{kind:'loss',source,sourceId,unit,before,after,amount:before-after,
    attempted:LIFE_RULES.breachLoss,failed:game.lifeFailed})
}

export function healPlayerLife(game,amount,{source='restore-base',sourceId}={}) {
  if(!Number.isSafeInteger(amount) || amount<0)return 0
  const before=game.baseHp,healed=game.lifeFailed?0:Math.min(amount,Math.max(0,game.maxBaseHp-before))
  game.baseHp=before+healed
  recordLifeEvent(game,{kind:'heal',source,sourceId,before,after:game.baseHp,amount:healed,attempted:amount,
    ...(game.lifeFailed?{blocked:'failed'}:{})})
  return healed
}

export function expandLifeMax(game,amount,{source='life-expansion',sourceId,heal=0}={}) {
  if(!Number.isSafeInteger(amount) || amount<0)return 0
  const maxBefore=game.maxBaseHp,gain=Math.min(amount,Math.max(0,lifeMaxCap(game)-maxBefore))
  game.maxBaseHp=maxBefore+gain
  recordLifeEvent(game,{kind:'max',source,sourceId,amount:gain,maxBefore,maxAfter:game.maxBaseHp,attempted:amount})
  if(heal>=0 && Number.isFinite(heal))healPlayerLife(game,heal,{source,sourceId})
  return gain
}

export function recordBellEvent(game,kind,unit,details={}) {
  return recordLifeEvent(game,{kind,source:'bellkeeper',sourceId:unit?.bellSourceId || unit?.id,unit,amount:0,...details})
}

/** Preview only; a full-life first qualifying hand still spends that wave's use. */
export function lifeItemPreview(game,{scoring=[],containsFlush=false}={}) {
  const owned=id=>(game.jokers || []).some(item=>item.id===id && (item.quantity ?? 1)>0)
  const hearts=scoring.filter(card=>card.suit==='♥').length
  const fiveFlush=containsFlush && scoring.length===5 && scoring.every(card=>card.suit===scoring[0].suit)
  const one=(id,stateKey,condition)=>{
    const held=owned(id),used=game.lifeItemState?.[stateKey]===true,eligible=held && condition
    const available=eligible && !used && !game.lifeFailed,restored=available?Math.min(LIFE_RULES.itemHeal,Math.max(0,game.maxBaseHp-game.baseHp)):0
    const reason=!held?'未持有这件道具。':!condition?id==='red-echo'?'不足两张计分红心，不触发生命恢复。':'需要五张同花成功出牌才触发生命恢复。':
      used?'本波生命恢复机会已使用。':game.lifeFailed?'本局已失败，无法恢复生命。':restored>0?'首次满足条件，本波可恢复 '+LIFE_RULES.itemHeal+' 点生命。':'首次满足条件，但生命已满；本波恢复机会仍会消耗。'
    return {id,stateKey,owned:held,eligible,used,available,restored,reason}
  }
  return {redEchoLife:one('red-echo','redEchoUsed',hearts>=2),flushCrownLife:one('flush-crown','flushCrownUsed',fiveFlush)}
}
