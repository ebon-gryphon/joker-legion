import { QUALITIES } from './quality.js'
import { JOBS } from './jobs.js'
import { professionId,professionJobs } from './professionFusion.js'
import { soldierIdentity } from './soldierIdentity.js'
const labels={atk:'攻击',heal:'治疗',shield:'护盾',period:'行动间隔',maxHp:'生命上限'}
export const presentationNumber=(value,stat)=>Number.isFinite(value)?Number(value.toFixed(stat==='period'?3:1)):'未记录'
export function recruitmentView(receipt,{revealed=true,qualityVisible=true,kind='recruit'}={}) {
  if(!revealed || !qualityVisible)return {revealed:false,tone:'#b69b78',headline:'征募结果待揭晓'}
  const facts=receipt?.recruitment || receipt
  if(!facts)return null
  const fusion=kind==='fusion' || facts.kind==='ascend' || receipt?.kind==='ascend'
  const status=facts.status || (facts.placement==='field'?'fielded':facts.placement==='reserve'?'reserve':'unknown')
  const grade=Number.isInteger(facts.grade)?facts.grade:null
  const quality=facts.quality || QUALITIES[grade]?.name || '品质未记录'
  const stats=facts.actualStats || facts.after || null
  const rows=stats?Object.entries(labels).filter(([key])=>Number.isFinite(stats[key]) && (key!=='heal' || stats[key]>0)).map(([stat,label])=>({
    stat,label,before:Number.isFinite(facts.before?.[stat])?facts.before[stat]:null,after:stats[stat]})):[]
  return {revealed:true,fusion,status,grade,quality,tone:QUALITIES[grade]?.color || '#b69b78',
    headline:fusion?'融合升品':status==='fielded'?'新兵正式入阵':status==='reserve'?'已进入候补':status==='training'?'满编转为集训':'征募结果',
    name:facts.name || '身份未记录',profession:facts.profession || '',unitId:facts.unitId || null,
    suit:facts.identity?.suit || '',rank:facts.identity?.rank || '',level:facts.level,
    statBonus:Number.isFinite(facts.statBonus)?facts.statBonus:null,statBonusSource:facts.statBonusSource || '',
    reason:facts.reason || (status==='reserve'?'候补成员尚未占用战场兵位。':status==='training'?'本手转为经验，没有新增战场成员。':''),
    recipient:facts.recipient || null,xpGain:Number.isFinite(facts.xpGain)?facts.xpGain:null,
    rows,gains:Array.isArray(facts.gains)?facts.gains:[]}
}
export function orderRecipientViews(receipt,{revealed=true}={}) {
  if(!revealed)return []
  return (receipt?.orderRecipients || []).map(unit=>({id:unit.id,name:unit.name,profession:unit.profession,role:unit.role,isNew:!!unit.isNew,
    reason:unit.reason,scope:unit.scope,
    effects:(unit.effects || []).filter(effect=>Number.isFinite(effect.after) && (unit.isNew?effect.after!==0:Number.isFinite(effect.delta) && effect.delta!==0)).map(effect=>({
      stat:effect.stat,label:effect.label || labels[effect.stat] || effect.stat,before:effect.before,after:effect.after,
      delta:unit.isNew || !Number.isFinite(effect.delta)?null:effect.delta,
      text:unit.isNew || !Number.isFinite(effect.before)?'结算后 '+presentationNumber(effect.after,effect.stat):
        presentationNumber(effect.before,effect.stat)+' → '+presentationNumber(effect.after,effect.stat),
      deltaText:unit.isNew || !Number.isFinite(effect.before) || !Number.isFinite(effect.delta)?'':
        '（'+(effect.delta>0?'＋':'−')+presentationNumber(Math.abs(effect.delta),effect.stat)+(effect.stat==='period'?'秒':'')+'）',
      unit:effect.stat==='period'?' 秒':''}))}))
}
export function orderRecipientHeading(receipt) {
  const order=receipt?.order
  return {title:order?.name?order.name+(order.targetName?' → '+order.targetName:''):'本手实际受令成员',
    sourceScore:Number.isFinite(order?.sourceScore)?order.sourceScore:null}
}

/** A read-only composition of committed recruitment/fusion facts, never a reconstructed unit. */
export function highTierRevealView(receipt,{actualUnit=null,revealed=true,qualityVisible=true,kind='recruit'}={}) {
  const view=recruitmentView(receipt,{revealed,qualityVisible,kind})
  if(!view || !view.revealed)return view
  const facts=receipt?.recruitment || receipt
  const candidate=actualUnit || facts.actualUnit || receipt?.actualUnit || null
  const unit=candidate && (!view.unitId || candidate.id===view.unitId) && candidate.grade===view.grade?candidate:null
  const identity=unit?soldierIdentity(unit):null
  const primaryId=unit?professionId(unit):null
  const jobs=unit?professionJobs(unit):[...new Set((facts.fusionJobs || []).filter(id=>Object.hasOwn(JOBS,id)))]
  const primary=JOBS[primaryId]?.name || view.profession
  const inherited=jobs.filter(id=>id!==primaryId).map(id=>({id,name:JOBS[id].name,skill:JOBS[id].skill}))
  const allLabels={...labels,hp:'当前生命',range:'射程',speed:'移动速度',statBonus:'征召属性加成'}
  const recorded=facts.actualStats || facts.after || {}
  const rows=Object.entries(allLabels).filter(([stat])=>Number.isFinite(recorded[stat] ?? unit?.[stat])).map(([stat,label])=>{
    const after=recorded[stat] ?? unit[stat],before=Number.isFinite(facts.before?.[stat])?facts.before[stat]:null
    const delta=before===null?null:after-before
    return {stat,label,before,after,delta,unit:stat==='period'?'秒':stat==='statBonus'?'%':'',
      beforeText:before===null?null:presentationNumber(before,stat),afterText:presentationNumber(after,stat),
      deltaText:delta===null || presentationNumber(delta,stat)===0?'':(delta>0?'＋':'−')+presentationNumber(Math.abs(delta),stat)+(stat==='period'?'秒':'')}
  })
  const priority=['atk','heal','maxHp','shield','period']
  const changed=priority.map(stat=>rows.find(row=>row.stat===stat)).filter(row=>row?.deltaText)
  const observed=priority.map(stat=>rows.find(row=>row.stat===stat)).filter(row=>row && row.after!==0)
  return {...view,actualUnit:unit,name:identity?.name || view.name,primary,inherited,rows,
    keyChanges:(facts.before?changed:observed).slice(0,3),
    gradeBefore:Number.isInteger(facts.gradeBefore)?facts.gradeBefore:null,
    previousQuality:QUALITIES[facts.gradeBefore]?.name || '',
    destination:view.status==='reserve'?'候补席 · 尚未上阵':view.status==='fielded'?(view.fusion?'原位升品 · 继续在场':'正式入阵'):
      view.status==='training'?'转为集训 · 没有新增士兵':'去向未记录'}
}
