import { JOKER_BY_ID } from './campaignRules.js'

export const ITEM_EFFECT_LABELS={chips:'筹码',shield:'赋予护盾',healed:'友军有效治疗',lifeHealed:'生命恢复',gateRepaired:'旧制修复',
  starGain:'额外星级',xpGain:'额外经验',damage:'实际伤害',shieldDamage:'消耗敌盾'}
const DISPLAY_EFFECT_LABELS={...ITEM_EFFECT_LABELS,energyRefund:'返还军令',actualSpent:'实际军令支出',
  attackGain:'实际攻击增加',healGain:'实际治疗力增加',healthGain:'实际生命上限增加',periodReduction:'实际行动间隔缩短',extraHealing:'其中额外有效治疗',scorePercent:'最终分加成',orderPercent:'战令加成',percent:'永久加成',
  finalScore:'本手最终分',totalXp:'实际总经验',activated:'本波能力激活',arrows:'追加箭数',targets:'实际目标'}

export function actualEffectText(effects={}) {
  return Object.entries(DISPLAY_EFFECT_LABELS).filter(([key])=>Number.isFinite(effects[key]) && effects[key]!==0)
    .map(([key,label])=>label+' '+Number((['scorePercent','orderPercent','percent'].includes(key)?effects[key]*100:effects[key]).toFixed(key==='periodReduction'?3:1))+(['scorePercent','orderPercent','percent'].includes(key)?'%':key==='periodReduction'?' 秒':'')).join(' · ') || '实际收益 0'
}

// A view over recorded effects, never a replay or a second score calculation.
export function itemEventGroups(combat) {
  const groups=new Map()
  for(const event of combat?.itemEvents || []) {
    if(!event?.id || event.quantity===0) continue
    const group=groups.get(event.id) || {id:event.id,name:JOKER_BY_ID[event.id]?.name || event.id,
      triggers:0,effective:0,effects:{},events:[]}
    group.triggers+=Number(event.triggered)
    group.effective+=Number(event.effective)
    for(const key of Object.keys(ITEM_EFFECT_LABELS)) if(Number.isFinite(event.effects?.[key]))
      group.effects[key]=(group.effects[key] || 0)+event.effects[key]
    group.events.push(event);groups.set(event.id,group)
  }
  return [...groups.values()]
}

export function gateSourceRows(combat) {
  if(!combat?.gate?.sources) return null
  return [['bell','旧制钟击'],['breach','旧制敌军突破'],['timeout','旧制超时残敌'],['unknown','旧制未分类损伤']]
    .map(([id,label])=>({id,label,amount:combat.gate.sources[id] || 0})).filter(row=>row.amount>0)
}

export function runOutcomeText(combat) {
  const outcome=combat?.runOutcome
  if(!outcome) return null
  if(outcome.status==='retired') return '主动结束无尽挑战，守住第 '+outcome.wave+' 波。'
  if(outcome.status==='defeat') return '第 '+outcome.finalWave+' 波失守，已守住 '+outcome.clearedWaves+' 波。'
  if(outcome.status==='victory') return '第 '+outcome.finalWave+' 波完成远征，共守住 '+outcome.clearedWaves+' 波。'
  if(outcome.status==='wave-cleared') return '已守住 '+outcome.clearedWaves+' 波，远征继续。'
  return '第 '+outcome.wave+' 波进行中。'
}
