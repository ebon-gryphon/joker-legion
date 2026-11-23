import { ORDER_BOOK, scoreCardPoints, rankOf } from './orders.js'
import { QUALITIES } from './quality.js'
import { LEADER_ODDS } from './recruitment.js'
import { itemTrace, scoreContributionRows } from './itemTrace.js'

const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
function freeze(value) {if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
function qualityOdds(floor) {
  if (floor>=4) return [{grade:floor,name:QUALITIES[floor].name,chance:100}]
  const {rare,epic,legend}=LEADER_ODDS[floor],rows=[{grade:floor,chance:100-rare-epic-legend}]
  if(rare) rows.push({grade:2,chance:rare})
  if(epic) rows.push({grade:3,chance:epic})
  if(legend) rows.push({grade:4,chance:legend})
  return rows.map(row=>({...row,name:QUALITIES[row.grade].name}))
}
function recruitSummary(plan,mode,xp) {
  if(plan.waiting) return '上阵已满，传说领队进入候补，保留身份、品质与星级。'
  if(plan.actualUnits>0) return plan.profession+' ×'+plan.actualUnits+' 入阵，征召属性 +'+plan.statBonus+'%。'
  if(plan.trainingXp>0 && xp===0) return '上阵已满，接收者经验已达 999 上限，本手实际可得经验为 0。'
  return (mode==='preview'?'按当前保底品质：':'')+'上阵已满，实际可得 '+xp+' 经验给'+(plan.trainerName || '接收者')+'。'
}

export function buildScoreTrace(game,plan,{cards,scoring,mode='preview'}={}) {
  if(!plan?.key || !cards?.length || !scoring?.length) return null
  const rule=ORDER_BOOK[plan.key],levelChips=(plan.level-1)*rule.chipGain
  let chips=rule.chips+levelChips
  const steps=[{kind:'base',id:'base',label:rule.name+' Lv.'+plan.level+' 基础与研习',delta:chips,chips}]
  const scoringCards=scoring.map(card=>({id:card.id,suit:card.suit,rank:card.rank,points:scoreCardPoints(card)}))
  for(const card of scoringCards){chips+=card.points;steps.push({kind:'card',id:card.id,label:card.suit+card.rank,delta:card.points,chips})}
  const chipBonuses=scoreContributionRows(game,scoring,plan.key,plan.containsPair).map(row=>{
    chips+=row.delta
    const entry={...row,runningChips:chips}
    if(row.applied) steps.push({kind:'item',id:'item-'+row.id,itemId:row.id,label:row.label,delta:row.delta,chips})
    return entry
  })
  // The trace explains the accepted plan; it never rolls a grade or awards a score.
  if(chips!==plan.score.chips || chips*plan.score.mult!==plan.score.total) throw new Error('Score trace disagrees with the authoritative hand score')
  steps.push({kind:'multiply',id:'multiply',label:'牌谱倍率',chips,mult:plan.score.mult,total:plan.score.total})
  const floor=plan.grade,rolled=mode==='resolved'?plan.captainGrade:undefined
  const quality={floor,name:QUALITIES[floor].name,odds:qualityOdds(floor),...(rolled===undefined?{}:{rolled,rolledName:QUALITIES[rolled].name})}
  const receiver=plan.trainerId?{id:plan.trainerId,name:plan.trainerName}:null
  const trainer=(game.allies || []).find(unit=>unit.id===plan.trainerId)
  const cappedXp=plan.actualUnits===0 && !plan.waiting?Math.min(plan.trainingXp,Math.max(0,999-(trainer?.trainingXp || 0))):plan.trainingXp
  const rankCounts=new Map()
  for(const card of scoring)rankCounts.set(card.rank,(rankCounts.get(card.rank) || 0)+1)
  const naturalSource=[...rankCounts].map(([rank,count])=>rank+'×'+count+'（每张征召按 '+rankOf({rank})+' 点）').join('、')
  const statBonusSource=naturalSource+'，使新兵生命、攻击与治疗获得 +'+plan.statBonus+'% 征召加成。评分牌点共 '+plan.points+'，J/Q/K 按10、A按11计分，征召则按11/12/13/14。'+(plan.strengthDetail?' '+plan.strengthDetail+'。':'')
  const recruit={profession:plan.profession,statBonus:plan.statBonus,count:plan.count,actualCount:plan.actualUnits,reserve:!!plan.waiting,overflow:plan.actualUnits===0,
    xp:cappedXp,plannedXp:plan.trainingXp,statBonusSource,receiver,summary:recruitSummary(plan,mode,cappedXp),legendaryAlternative:mode==='preview' && !plan.waiting && plan.actualUnits===0 && floor<4?'若本手随机升为传说，会进入候补而不是转训；正式出牌后才揭晓。':null}
  steps.push({kind:'outcome',id:'quality',label:mode==='resolved'?'揭晓 '+quality.rolledName:'保底 '+quality.name,total:plan.score.total})
  steps.push({kind:'outcome',id:'muster',label:recruit.summary,total:plan.score.total})
  return freeze({version:1,id:JSON.stringify([String(game.seed),(game.stats?.deploys || 0)+1]),mode,
    hand:{key:plan.key,name:plan.name,level:plan.level,baseChips:rule.chips,levelChips,baseMult:rule.mult,levelMult:(plan.level-1)*rule.multGain,mult:plan.score.mult},
    selectedCards:cards.map(card=>({id:card.id,suit:card.suit,rank:card.rank,scoring:plan.scoringIds.includes(card.id)})),scoringCards,
    nonScoringCards:cards.filter(card=>!plan.scoringIds.includes(card.id)).map(card=>({id:card.id,suit:card.suit,rank:card.rank,reason:'不属于本手最高牌型，不贡献点数或按计分牌触发的道具。'})),
    chipBonuses,chipsBeforeMult:chips,mult:plan.score.mult,finalScore:plan.score.total,quality,recruit,
    order:{sourceScore:plan.score.total,crownMultiplier:plan.containsFlush && game.jokers.some(item=>item.id==='flush-crown')?1.25:1,bonus:{...plan.bonus},label:plan.description},
    items:itemTrace(game,plan,{scoring}),steps})
}

export function resolveScoreTrace(trace,{recruit,items=[]}={}) {
  if(!trace || trace.version!==1) return null
  const result=copy(trace);result.mode='resolved'
  if(recruit) result.recruit={...result.recruit,...copy(recruit),legendaryAlternative:null}
  result.items=result.items.map(item=>{
    const actual=items.find(entry=>entry.id===item.id)
    if(actual) return {...item,actual:copy(actual.actual || actual)}
    if(item.phase==='chips' && item.quantity>0) return {...item,actual:{id:item.id,triggered:item.applied,effective:item.potential?.chips>0,reason:item.reason,effects:{chips:item.potential?.chips || 0}}}
    return item
  })
  const muster=result.steps.find(step=>step.id==='muster') || {kind:'outcome',id:'muster',total:result.finalScore}
  muster.label=result.recruit.summary
  // Outcome steps carry measured effects, never chip deltas or a second score.
  result.steps=result.steps.filter(step=>step.id!=='muster' && !['order','relic'].includes(step.kind))
  const relic=id=>{
    const item=result.items.find(item=>item.id===id)
    if(!item?.actual?.triggered)return null
    const actual=item.actual,effects=actual.effects || {},parts=[]
    if(effects.starGain>0)parts.push('升星 +'+effects.starGain)
    if(effects.xpGain>0)parts.push('额外经验 +'+effects.xpGain)
    if(effects.shield>0)parts.push('护盾 +'+effects.shield)
    if(Object.hasOwn(effects,'healed'))parts.push('有效治疗 '+Number(effects.healed.toFixed(1)))
    if(Object.hasOwn(effects,'gateRepaired'))parts.push('实际修城 '+Number(effects.gateRepaired.toFixed(1)))
    if(Object.hasOwn(effects,'damage'))parts.push('实际生命伤害 '+Number(effects.damage.toFixed(1)))
    if(effects.shieldDamage>0)parts.push('破盾 '+Number(effects.shieldDamage.toFixed(1)))
    return {kind:'relic',id:'relic-'+id,itemId:id,label:item.label+' · '+(parts.length?parts.join(' · '):actual.reason),
      effects:copy(effects),effective:actual.effective,reason:actual.reason}
  }
  const third=relic('third-act');if(third)result.steps.push(third)
  result.steps.push(muster,{kind:'order',id:'order',label:result.order.label,sourceScore:result.finalScore,bonus:copy(result.order.bonus)})
  for(const id of ['iron-banner','red-echo','heart-engine']) {const step=relic(id);if(step)result.steps.push(step)}
  return freeze(result)
}
