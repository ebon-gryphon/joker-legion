import { soldierIdentity } from './soldierIdentity.js'
import { QUALITIES } from './quality.js'
import { REGIMENTS,ORDER_BOOK } from './orders.js'

const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
const finite=value=>Number.isFinite(value)?value:null
const statsOf=unit=>unit?Object.fromEntries(['atk','heal','shield','period','maxHp'].map(key=>[key,finite(unit[key])])):null
const statsLabels={atk:'攻击',heal:'治疗',shield:'护盾',period:'行动间隔',maxHp:'生命上限'}
const members=game=>[...(game?.allies || []),...(game?.reserves || [])]
const quantity=value=>Number.isFinite(value)?value:0
const rounded=value=>Math.round(quantity(value)*10)/10
function freeze(value){if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}

// Presentation receives committed snapshots; it never invokes an engine action.
export function deriveDeployFacts(before,after) {
  const last=after?.lastDeploy
  if(!before || !last?.id || last.id===before.lastDeploy?.id || !(after.stats?.deploys>before.stats?.deploys))return null
  const order=after.combatLedger?.orders?.find(row=>row.id===last.id)
  const trace=last.scoreTrace || order?.scoreTrace || null
  const recruitment=order?.recruitment || {}
  const oldIds=new Set(members(before).map(unit=>unit.id))
  const field=(after.allies || []).filter(unit=>!oldIds.has(unit.id) && unit.echoUntil==null)
  const reserve=(after.reserves || []).filter(unit=>!oldIds.has(unit.id))
  const unit=field[0] || reserve[0] || null
  const status=field.length?'fielded':reserve.length?'reserve':recruitment.status==='training' || trace?.recruit?.overflow && !trace?.recruit?.reserve?'training':'unknown'
  const recipientId=recruitment.recipientId || trace?.recruit?.receiver?.id || null
  const recipient=members(after).find(unit=>unit.id===recipientId)
  const previousRecipient=members(before).find(unit=>unit.id===recipientId)
  const identity=soldierIdentity(unit || {appearanceId:recruitment.appearanceId || last.leadFace})
  const grade=unit?.grade ?? recruitment.grade ?? trace?.quality?.rolled ?? last.captainGrade ?? null
  const xpGain=finite(recruitment.xpGain) ?? finite(trace?.recruit?.xp)
  const actualStats=statsOf(unit)
  const target=order?.target || last.target,secondary=order?.secondary || null
  const targets=[target,secondary].filter(Boolean)
  const orderRecipients=(after.allies || []).filter(unit=>unit.hp>0 && targets.includes(unit.type)).map(unit=>{
    const old=members(before).find(member=>member.id===unit.id),prior=statsOf(old),current=statsOf(unit),identity=soldierIdentity(unit)
    return {id:unit.id,name:identity.name,profession:identity.profession,type:unit.type,role:unit.type===target?'primary':'secondary',isNew:!old,
      before:prior,after:current,effects:Object.keys(statsLabels).map(stat=>({stat,label:statsLabels[stat],before:prior?.[stat] ?? null,after:current[stat],
        delta:prior?.[stat]===null || !prior || current[stat]===null?null:current[stat]-prior[stat]})),scope:'whole-play',
      reason:old?'本手合计实得变化，可能同时包含战令、搭档、加冕或其他本手效果。':'本手新兵，显示正式结算后的当前属性；没有可靠出牌前属性，变化量不记为 0。'}
  })
  return freeze({orderId:last.id,wave:after.wave,score:last.score,
    recruitment:{status,unitId:unit?.id || null,name:identity.name,profession:unit?identity.profession:recruitment.profession || trace?.recruit?.profession || last.profession || '',
      grade,quality:QUALITIES[grade]?.name || '',level:unit?.level ?? recruitment.level ?? null,statBonus:unit?.statBonus ?? trace?.recruit?.statBonus ?? last.statBonus ?? null,
      statBonusSource:trace?.recruit?.statBonusSource || '',identity:{appearanceId:unit?.appearanceId || recruitment.appearanceId || last.leadFace || null,suit:identity.suit,rank:identity.rank},
      actualStats,count:field.length,reserveCount:reserve.length,recipient:recipient?{id:recipient.id,name:soldierIdentity(recipient).name,
        xpBefore:finite(previousRecipient?.trainingXp),xpAfter:finite(recipient.trainingXp)}:null,xpGain,
      reason:trace?.recruit?.summary || (status==='fielded'?'正式新兵已经入阵。':status==='reserve'?'正式新兵进入候补，尚未占用战场兵位。':status==='training'?'本手满编，按真实记录转为集训。':'缺少足够记录，未推断征募分支。')},
    order:{target,targetName:REGIMENTS[target]?.name || target,secondary,name:ORDER_BOOK[last.key]?.order || '',label:trace?.order?.label || last.squad || '',bonus:copy(trace?.order?.bonus || {}),sourceScore:trace?.order?.sourceScore ?? last.score},
    orderRecipients,items:copy(trace?.items || []),scoreTrace:copy(trace)})
}

export function deriveAscendFacts(before,after,leaderId) {
  if(!before || !after || !(after.fusions>before.fusions))return null
  const leader=members(after).find(unit=>unit.id===leaderId),old=members(before).find(unit=>unit.id===leaderId)
  const remaining=new Set(members(after).map(unit=>unit.id)),consumed=members(before).filter(unit=>!remaining.has(unit.id))
  if(!leader || !old || ![4,5].includes(old.grade) || leader.grade!==old.grade+1 || consumed.length!==1 || consumed[0].grade!==old.grade)return null
  const display=soldierIdentity(leader)
  return freeze({kind:'ascend',unitId:leader.id,name:display.name,profession:display.profession,gradeBefore:old.grade,grade:leader.grade,quality:display.quality,
    donorId:consumed[0].id,placement:(after.allies || []).some(unit=>unit.id===leader.id)?'field':'reserve',before:statsOf(old),after:statsOf(leader),
    armyUnitIds:(after.allies || []).filter(unit=>unit.hp>0).map(unit=>unit.id),source:'actual-quality-fusion'})
}

export function deriveReportHighlights(report,{limit=7,liveEvents=[]}={}) {
  if(!report)return []
  const rows=[],orders=report.orders || [],recruits=orders.map(order=>order.recruitment).filter(Boolean)
  const fielded=recruits.filter(row=>row.status==='fielded').length,reserve=recruits.filter(row=>row.status==='reserve').length
  const xp=recruits.filter(row=>row.status==='training').reduce((sum,row)=>sum+quantity(row.xpGain),0)
  if(recruits.length)rows.push({id:'recruitment',kind:'recruit',label:'征募兑现',detail:'实际入阵 '+fielded+' 名 · 候补 '+reserve+' 名 · 满编实际经验 '+rounded(xp)+'。'})
  const counts=new Map()
  for(const order of orders)for(const target of [order.target,order.secondary].filter(Boolean))counts.set(target,(counts.get(target) || 0)+1)
  for(const [type,count] of [...counts].sort((a,b)=>b[1]-a[1]).slice(0,2)) {
    const army=(report.units || []).filter(row=>row.type===type)
    const damage=army.reduce((sum,row)=>sum+quantity(row.damage),0),healed=army.reduce((sum,row)=>sum+quantity(row.healed),0)
    if(damage>0 || healed>0)rows.push({id:'regiment-'+type,kind:'regiment',label:(REGIMENTS[type]?.name || type)+' · '+count+' 手叠加战令',
      detail:'该战团本波实际伤害 '+rounded(damage)+'、有效治疗 '+rounded(healed)+'。包含成员已有能力与其他加成，不能当作某一手的额外伤害。'})
  }
  const absorbed=(report.units || []).reduce((sum,row)=>sum+quantity(row.absorbed),0)
  if(absorbed>0)rows.push({id:'shield',kind:'guard',label:'护盾实际挡伤',detail:'本波共吸收 '+rounded(absorbed)+' 伤害；包含各种护盾来源。'})
  const interrupts=quantity(report.tacticsReport?.interrupts),bell=quantity(report.gate?.sources?.bell)
  if(report.lifeVersion===1){
    const summons=(report.lifeEvents || []).filter(event=>event.wave===report.wave && event.kind==='bell-summon').length
    if(interrupts>0 || summons>0)rows.push({id:'bell',kind:'interrupt',label:'止钟与援军',detail:'真实打断鸣钟 '+interrupts+' 次 · 成功召唤援军 '+summons+' 次。鸣钟本身不扣生命，突破按逐次生命事件结算。'})
  }else if(interrupts>0 || bell>0)rows.push({id:'bell',kind:'interrupt',label:'旧制止钟记录',detail:'旧制打断鸣钟 '+interrupts+' 次 · 旧制钟击损失 '+rounded(bell)+'，不再计入新红心生命。'})
  const heart=(report.systems || []).find(row=>row.id==='heart-engine')
  if(heart?.damage>0)rows.push({id:'heart-engine',kind:'conversion',label:'荆棘圣杯实际兑现',detail:'有效治疗转化为 '+rounded(heart.damage)+' 点敌方生命损失。已计入总伤害，不重复相加。'})
  const queen=liveEvents.filter(event=>event.kind==='queen-interrupt' && event.actual && event.wave===report.wave)
  if(queen.length)rows.push({id:'queen-interrupt',kind:'interrupt',label:'皇后蓄力实际被打断',detail:'本会话捕获 '+queen.length+' 次明确的王庭震荡打断日志；不补入旧战报。'})
  if(report.partial)rows.push({id:'partial',kind:'caveat',label:'续档记录边界',detail:'摘要仅使用已有贡献记录，未给早先缺失的数据补造个人或单手归因。'})
  return freeze(rows.slice(0,Math.max(1,limit)))
}
