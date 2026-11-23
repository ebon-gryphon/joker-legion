import { deriveDeployFacts,deriveAscendFacts } from './presentationFacts.js'
import { REGIMENTS } from './orders.js'
const copy=value=>JSON.parse(JSON.stringify(value))
const amount=value=>Number.isFinite(value)?value:0
const waveKey=game=>game?.combatLedger?.waveId || JSON.stringify([game?.seed,game?.battleId,game?.wave])
const rowMap=game=>new Map((game?.combatLedger?.units || []).map(row=>[row.unitId,{damage:amount(row.damage),healed:amount(row.healed),absorbed:amount(row.absorbed)}]))

// Every mutable object here lives outside game and is deliberately absent from saves.
export function createPresentationController({enabled=true,maxRecent=8}={}) {
  let on=!!enabled,speed=1,key=null,baseline=null,serial=0,events=[],first=new Set(),ordersByUnit=new Map(),labels=new Map(),seenLogs=new Set(),cursor=0,interrupts=0
  const cap=Math.max(1,Math.min(16,maxRecent))
  function reset(game=null) {
    key=game?waveKey(game):null;baseline=game?rowMap(game):null;events=[];first=new Set();ordersByUnit=new Map();labels=new Map()
    seenLogs=new Set((game?.logs || []).map(row=>row.id));cursor=game?.combatLedger?.itemEvents?.length || 0;interrupts=amount(game?.tacticsReport?.interrupts)
  }
  function ensure(game){if(key!==waveKey(game))reset(game)}
  function emit(event){if(!on)return null;const value={id:'presentation-'+(++serial),...copy(event)};events=[...events,value].slice(-cap);return value}
  function onDeploy(before,after) {
    ensure(after)
    const receipt=deriveDeployFacts(before,after);if(!receipt)return null
    if(labels.has(receipt.orderId))return receipt
    labels.set(receipt.orderId,(receipt.order.name || receipt.order.label)+' · '+receipt.score+' 分')
    for(const unit of receipt.orderRecipients){const ids=ordersByUnit.get(unit.id) || [];ordersByUnit.set(unit.id,[...new Set([...ids,receipt.orderId])].slice(-12))}
    baseline=rowMap(after);cursor=after.combatLedger?.itemEvents?.length || 0;interrupts=amount(after.tacticsReport?.interrupts)
    emit({kind:'deploy',wave:after.wave,at:after.waveTime || 0,orderId:receipt.orderId,recruitment:receipt.recruitment,
      unitIds:receipt.orderRecipients.map(unit=>unit.id),label:receipt.recruitment.reason})
    return receipt
  }
  function onAscend(before,after,leaderId){ensure(after);const facts=deriveAscendFacts(before,after,leaderId);if(facts)emit({kind:'ascend',wave:after.wave,at:after.waveTime || 0,...facts,label:facts.quality+' · 正式品质融合'});return facts}
  function sample(game) {
    if(!game)return []
    ensure(game)
    const fresh=[],current=rowMap(game),ledger=game.combatLedger
    const push=event=>{const row=emit({wave:game.wave,at:game.waveTime || 0,...event});if(row)fresh.push(row)}
    if(baseline && ledger?.started) {
      const groups=new Map()
      for(const row of ledger.units || []) {
        const previous=baseline.get(row.unitId) || {damage:0,healed:0,absorbed:0}
        const ids=ordersByUnit.get(row.unitId)
        for(const [metric,kind] of [['damage','attack'],['healed','heal']]) {
          if(!ids?.length || amount(row[metric])<=previous[metric])continue
          const groupKey=row.type+'/'+kind;if(first.has(groupKey))continue
          const group=groups.get(groupKey) || {kind,type:row.type,unitIds:[],orderIds:new Set(),actualAmount:0}
          group.unitIds.push(row.unitId);ids.forEach(id=>group.orderIds.add(id));group.actualAmount+=amount(row[metric])-previous[metric];groups.set(groupKey,group)
        }
        if(amount(row.absorbed)>previous.absorbed && !first.has('guard/'+row.type)) {
          first.add('guard/'+row.type)
          push({kind:'guard',unitIds:[row.unitId],type:row.type,actual:true,actualAmount:amount(row.absorbed)-previous.absorbed,label:(REGIMENTS[row.type]?.name || row.type)+'护盾开始实际挡伤',reason:'实际吸收量包含所有护盾来源，不独占归因某一手。'})
        }
      }
      for(const [id,group] of groups) {
        first.add(id)
        push({...group,orderIds:[...group.orderIds],orderLabels:[...group.orderIds].map(id=>labels.get(id)).filter(Boolean),actual:true,
          label:(REGIMENTS[group.type]?.name || group.type)+'受令成员首次记录有效'+(group.kind==='heal'?'治疗':'伤害'),
          reason:'按本次采样间隔的真实贡献记录，含叠加战令、成员能力与其他加成，不能解释为某一手独自增加的伤害。'})
      }
    }
    const nextInterrupts=amount(game.tacticsReport?.interrupts)
    if(nextInterrupts>interrupts)push({kind:'bell-interrupt',actual:true,count:nextInterrupts-interrupts,label:'战前止钟令实际打断鸣钟',reason:'读取真实止钟计数，不分摊给某一手。'})
    interrupts=nextInterrupts
    for(const row of game.logs || [])if(!seenLogs.has(row.id)) {
      seenLogs.add(row.id)
      if(row.text?.includes('王庭震荡被打断'))push({kind:'queen-interrupt',actual:true,label:'王庭震荡实际被打断',reason:'来自本次新增的真实战斗日志，不从伤害或预警消失猜测。'})
    }
    const items=ledger?.itemEvents || []
    const heart=items.slice(cursor).filter(event=>event.id==='heart-engine' && event.triggered && (event.effects?.damage>0 || event.effects?.shieldDamage>0))
    if(heart.length && !first.has('heart-engine')){first.add('heart-engine');push({kind:'heart-engine',actual:true,count:heart.length,actualAmount:heart.reduce((n,event)=>n+amount(event.effects.damage),0),
      shieldDamage:heart.reduce((n,event)=>n+amount(event.effects.shieldDamage),0),unitIds:[],targetIds:[...new Set(heart.flatMap(event=>event.targetIds || []))],
      label:'有效治疗触发圣杯实际伤害',reason:'读取既有圣杯事件中的实际生命损失；每波只提示首次，完整收益见战报。'})}
    cursor=items.length;baseline=current
    return fresh
  }
  return {onDeploy,onAscend,sample,reset,setEnabled(value){on=!!value;if(!on)events=[]},setSpeed(value){speed=value===2?2:1},skip(){events=[]},
    getEvents(){return copy(events)},getSettings(){return {enabled:on,speed,maxRecent:cap}}}
}
