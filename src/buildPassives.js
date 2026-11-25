import {lastingStat} from './standingArmy.js'
import {ORDER_BOOK} from './orders.js'
import {QUALITIES} from './quality.js'

const describe=(template,effect)=>template.replace(/\{(\w+)\}/g,(_,key)=>key==='percent'?Number((effect.percent*100).toFixed(4)):
  key==='waveUse'?(effect.perWave===1?'首次':'前'+effect.perWave+'次'):key==='minGradeName'?QUALITIES[effect.minGrade]?.name || effect.minGrade:effect[key])
const define=(id,name,icon,effect,description)=>Object.freeze({id,name,icon,weight:5,unique:true,
  effect:Object.freeze({kind:'buildPassive',passiveId:id,...effect}),descriptionTemplate:description,description:describe(description,effect)})
export const BUILD_PASSIVES=Object.freeze([
  define('same-hand','连奏','♫',{percent:.20},'同波连续相同成功牌型，从第二手起最终分 +{percent}%；变换牌型重置。'),
  define('varied-hand','变奏','♬',{percent:.20},'与同波上一成功手牌型不同，最终分 +{percent}%；首手不触发。'),
  define('five-card-order','五牌军势','Ⅴ',{percent:.25,cards:5,perWave:1},'每波{waveUse}成功出 {cards} 张牌，该手战令数值 +{percent}%，逐项四舍五入；先于主将军令。'),
  define('light-march','轻装进发','↶',{refund:1,perWave:2,maxCards:2},'成功出至多 {maxCards} 张牌返还 {refund} 实际支出军令，每波至多 {perWave} 次；免费手不消耗次数。'),
  define('spade-law','黑桃铁律','♠',{shield:18,minScoring:2,perWave:1},'每波{waveUse}至少 {minScoring} 张计分黑桃，触发时在场铁卫各获得 {shield} 护盾。'),
  define('heart-oath','红桃誓约','♥',{percent:.20,minScoring:2,perWave:1},'每波{waveUse}至少 {minScoring} 张计分红心，本波牧师战团治疗 +{percent}%，含之后入阵成员；实际收益受缺血限制。'),
  define('club-hunt','梅花猎令','♣',{percent:.60,minScoring:2,perWave:1},'每波{waveUse}至少 {minScoring} 张计分梅花，本波每位游侠首次基础攻击追加一支 {percent}% 攻击箭。'),
  define('diamond-return','方片回流','♦',{perCard:1,cap:3,minScoring:1,perWave:1},'每波{waveUse}至少 {minScoring} 张计分方片，每张返还 {perCard} 军令，最多 {cap} 且不超过实际支出；先结算轻装进发。'),
  define('fusion-code','融合军规','⚒',{percent:.12},'当前及未来异职业融合兵永久攻疗 +{percent}%，与精兵协议按同一永久基础加法合并，不含临时战令。'),
  define('captain-orders','主将军令','⚑',{percent:.30},'主将所在战团受令时，仅主将收到该次实际战令数值 +{percent}%，逐项四舍五入。'),
  define('reserve-instructor','候补教官','▤',{percent:.50},'仅满编转训的计划经验 +{percent}%（向下取整），实际受 999 上限限制；传说候补不触发。'),
  define('elite-pact','精兵协议','♛',{percent:.10,minGrade:4},'当前及未来{minGradeName}以上士兵永久攻疗 +{percent}%，与融合军规按同一永久基础加法合并。'),
])
export const BUILD_PASSIVE_BY_ID=Object.freeze(Object.fromEntries(BUILD_PASSIVES.map(row=>[row.id,row])))
const rule=id=>BUILD_PASSIVE_BY_ID[id].effect
export function describeBuildPassive(id,effect={}){const row=Object.hasOwn(BUILD_PASSIVE_BY_ID,id)?BUILD_PASSIVE_BY_ID[id]:null;return row?describe(row.descriptionTemplate,{...row.effect,...effect}):''}
const useFlags={'five-card-order':'fiveCardUsed','spade-law':'spadeLawUsed','heart-oath':'heartOathUsed','club-hunt':'clubHuntUsed','diamond-return':'diamondReturnUsed'}
const counterState=()=>({fiveCardUsed:false,lightMarchUses:0,spadeLawUsed:false,heartOathUsed:false,clubHuntUsed:false,diamondReturnUsed:false,clubShots:[],uses:{}})
const uses=(c,id,flag)=>c.uses?.[id] ?? Number(c[flag])
const available=(c,id,flag)=>uses(c,id,flag)<rule(id).perWave
function consume(c,id,flag){const next=uses(c,id,flag)+1;c[flag]=true;(c.uses ??= {})[id]=next}
const copy=value=>JSON.parse(JSON.stringify(value))
const formalArmy=game=>[...(game.allies || []),...(game.reserves || []),...(game.casualties || [])].filter(unit=>unit.echoUntil==null)
export function createBuildState(wave=1){return {version:1,ids:[],counts:Object.fromEntries(BUILD_PASSIVES.map(row=>[row.id,0])),wave:{number:wave,previousHand:null,counters:counterState()},events:[]}}
export const hasBuildPassive=(game,id)=>!!game.buildPassives?.ids?.includes(id)
const waveState=game=>game.buildPassives?.wave?.number===game.wave?game.buildPassives.wave:{number:game.wave,previousHand:null,counters:counterState()}
export function resetBuildWave(game){game.buildPassives ??= createBuildState(game.wave);game.buildPassives.wave={number:game.wave,previousHand:null,counters:counterState()};game.buildPassives.events=[]}
function stateFor(game){if(!game.buildPassives)game.buildPassives=createBuildState(game.wave);if(game.buildPassives.wave.number!==game.wave)resetBuildWave(game);return game.buildPassives}
export function validBuildState(state){
  if(!state || state.version!==1 || !Array.isArray(state.ids) || state.ids.length>BUILD_PASSIVES.length || new Set(state.ids).size!==state.ids.length || !state.ids.every(id=>Object.hasOwn(BUILD_PASSIVE_BY_ID,id)))return false
  if(!state.counts || !BUILD_PASSIVES.every(row=>Number.isSafeInteger(state.counts[row.id])&&state.counts[row.id]>=0))return false
  const wave=state.wave,c=wave?.counters
  return !!wave && Number.isSafeInteger(wave.number)&&wave.number>=1&&(wave.previousHand===null || Object.hasOwn(ORDER_BOOK,wave.previousHand)) && !!c &&
    ['fiveCardUsed','spadeLawUsed','heartOathUsed','clubHuntUsed','diamondReturnUsed'].every(key=>typeof c[key]==='boolean') &&
    Number.isSafeInteger(c.lightMarchUses)&&c.lightMarchUses>=0&&c.lightMarchUses<=rule('light-march').perWave && Array.isArray(c.clubShots)&&c.clubShots.every(id=>typeof id==='string')&&new Set(c.clubShots).size===c.clubShots.length &&
    (c.uses===undefined || c.uses&&typeof c.uses==='object'&&!Array.isArray(c.uses)&&Object.entries(c.uses).every(([id,n])=>Object.hasOwn(useFlags,id)&&Number.isSafeInteger(n)&&n>=0&&n<=rule(id).perWave&&Boolean(n)===c[useFlags[id]])) &&
    Array.isArray(state.events)&&state.events.every(event=>validBuildPassiveEvent(event)&&state.ids.includes(event.id)&&event.wave===wave.number)
}
export function validBuildPassiveEvent(event){
  const safe=n=>Number.isFinite(n)&&n>=0&&n<=1e12,str=s=>typeof s==='string'&&s.length<=1000
  return !!event&&Object.hasOwn(BUILD_PASSIVE_BY_ID,event.id)&&str(event.eventId)&&Number.isSafeInteger(event.wave)&&event.wave>=1&&safe(event.at)&&
    typeof event.triggered==='boolean'&&typeof event.effective==='boolean'&&(!event.effective||event.triggered)&&str(event.reason)&&
    Array.isArray(event.targetIds)&&event.targetIds.every(str)&&(event.unitId===undefined||str(event.unitId))&&(event.orderId===undefined||event.orderId===null||str(event.orderId))&&
    event.effects&&typeof event.effects==='object'&&!Array.isArray(event.effects)&&Object.values(event.effects).every(safe)
}
export function recordBuildPassiveEvent(game,id,{triggered=true,effective=false,reason='',effects={},...details}={}){
  if(!Object.hasOwn(BUILD_PASSIVE_BY_ID,id))return null
  const state=stateFor(game),event={id,eventId:game.wave+'/'+(state.events.length+1)+'/'+id,wave:game.wave,at:game.waveTime || 0,
    targetIds:[],...details,triggered,effective,reason,effects:copy(effects)}
  state.events.push(event);if(triggered)state.counts[id]=(state.counts[id] || 0)+1
  return event
}

const fused=unit=>!!unit.fusion || (unit.fusionJobs?.length || 0)>1
export function buildUnitPercent(game,unit){return (hasBuildPassive(game,'fusion-code')&&fused(unit)?rule('fusion-code').percent:0)+(hasBuildPassive(game,'elite-pact')&&unit.grade>=rule('elite-pact').minGrade?rule('elite-pact').percent:0)}
export function validBuildUnitStats(unit){const s=unit?.buildPassiveStats,a=rule('fusion-code').percent,b=rule('elite-pact').percent;return !s || [0,a,b,a+b].some(n=>Math.abs(n-s.percent)<1e-9)&&['atk','heal'].every(key=>Number.isSafeInteger(s[key])&&s[key]>=0&&Math.max(0,Math.round((lastingStat(unit,key)-s[key])*s.percent))===s[key])}
export const unmodifiedBuildStat=(unit,key)=>lastingStat(unit,key)-(['atk','heal'].includes(key)?unit.buildPassiveStats?.[key] || 0:0)
export function previewBuildUnitStats(game,unit,{clean=false}={}){
  const percent=buildUnitPercent(game,unit),old=clean?null:unit.buildPassiveStats
  const result={},ledger={percent,atk:0,heal:0}
  for(const key of ['atk','heal']){
    const current=(unit[key] || 0)-(old?.[key] || 0),base=current-(unit.waveBonus?.[key] || 0)
    ledger[key]=Math.max(0,Math.round(base*percent));result[key]=current+ledger[key]
  }
  if(percent || old)result.buildPassiveStats=ledger
  return result
}
function percentIds(percent){const close=n=>Math.abs(n-percent)<1e-9,a=rule('fusion-code').percent,b=rule('elite-pact').percent;return ['fusion-code','elite-pact'].filter(id=>close(a+b)||close(rule(id).percent))}
export function syncBuildUnitStats(game,unit,{clean=false,previous,reason='永久属性同步'}={}){
  if(unit.side!=='ally' || unit.echoUntil!=null)return unit
  const old=previous || unit.buildPassiveStats || {percent:0,atk:0,heal:0},next=previewBuildUnitStats(game,unit,{clean})
  Object.assign(unit,next)
  const ledger=unit.buildPassiveStats || {percent:0,atk:0,heal:0}
  const ids=percentIds(ledger.percent),newIds=ids.filter(id=>!percentIds(old.percent).includes(id)),receivers=newIds.length?newIds:ids
  const gains=Object.fromEntries(receivers.map(id=>[id,{attackGain:0,healGain:0}])),weight=receivers.reduce((sum,id)=>sum+BUILD_PASSIVE_BY_ID[id].effect.percent,0)
  for(const [stat,field] of [['atk','attackGain'],['heal','healGain']]){
    const total=Math.max(0,ledger[stat]-(old[stat] || 0));let assigned=0
    receivers.forEach((id,index)=>{const amount=index===receivers.length-1?total-assigned:Math.round(total*BUILD_PASSIVE_BY_ID[id].effect.percent/weight);gains[id][field]=amount;assigned+=amount})
  }
  for(const id of receivers){
    const {attackGain,healGain}=gains[id]
    if(attackGain>0 || healGain>0 || newIds.includes(id))recordBuildPassiveEvent(game,id,{effective:attackGain>0||healGain>0,unitId:unit.id,targetIds:[unit.id],
      reason:attackGain>0||healGain>0?reason:'符合持续加成条件，但本次统一取整后没有额外攻疗收益。',effects:{attackGain,healGain,percent:BUILD_PASSIVE_BY_ID[id].effect.percent}})
  }
  return unit
}
export function withBuildStatMutation(game,unit,change){
  const old=unit.buildPassiveStats
  if(old){unit.atk-=old.atk;unit.heal-=old.heal;delete unit.buildPassiveStats}
  const result=change()
  syncBuildUnitStats(game,unit,{clean:true,previous:old,reason:'培养或永久奖励后同步；未重复乘临时战令'})
  return result
}
export function acquireBuildPassive(game,id){
  if(!Object.hasOwn(BUILD_PASSIVE_BY_ID,id) || hasBuildPassive(game,id))return false
  const state=stateFor(game);state.ids.push(id)
  if(['fusion-code','elite-pact'].includes(id))for(const unit of formalArmy(game))syncBuildUnitStats(game,unit,{reason:'领取'+BUILD_PASSIVE_BY_ID[id].name+'后同步当前正式军团'})
  return true
}

export function scoreBuildBonuses(game,key){
  const previous=waveState(game).previousHand
  return ['same-hand','varied-hand'].filter(id=>hasBuildPassive(game,id)).map(id=>({id,name:BUILD_PASSIVE_BY_ID[id].name,percent:rule(id).percent,
    applied:!!previous&&(id==='same-hand'?previous===key:previous!==key),
    reason:!previous?'本波尚无上一成功牌型。':id==='same-hand'?(previous===key?'与上一成功牌型相同。':'本手变换牌型，连奏重置。'):(previous!==key?'与上一成功牌型不同。':'与上一成功牌型相同，变奏未触发。')}))
}
export const scaleBuildOrder=(bonus,factor)=>Object.fromEntries(Object.entries(bonus).map(([key,value])=>[key,Math.round(value*factor)]))
export function planBuildPassives(game,{key,cards,scoring,cost,trainingXp=0,waiting=false,trainer=null}={}){
  const c=waveState(game).counters,suits=Object.fromEntries(['♠','♥','♣','♦'].map(suit=>[suit,scoring.filter(card=>card.suit===suit).length]))
  const fiveRule=rule('five-card-order'),lightRule=rule('light-march'),diamondRule=rule('diamond-return'),instructorRule=rule('reserve-instructor')
  const five=hasBuildPassive(game,'five-card-order')&&available(c,'five-card-order','fiveCardUsed')&&cards.length===fiveRule.cards
  let remaining=cost
  const light=hasBuildPassive(game,'light-march')&&cards.length<=lightRule.maxCards&&c.lightMarchUses<lightRule.perWave&&cost>0?Math.min(lightRule.refund,remaining):0;remaining-=light
  const diamond=hasBuildPassive(game,'diamond-return')&&available(c,'diamond-return','diamondReturnUsed')&&suits['♦']>=diamondRule.minScoring
  const diamondRefund=diamond?Math.min(diamondRule.cap,suits['♦']*diamondRule.perCard,remaining):0
  const instructor=hasBuildPassive(game,'reserve-instructor')&&!waiting&&!!trainer&&trainingXp>0
  const boostedXp=instructor?Math.floor(trainingXp*(1+instructorRule.percent)):trainingXp,xpSpace=Math.max(0,999-(trainer?.trainingXp || 0)),extraXp=Math.max(0,Math.min(xpSpace,boostedXp)-Math.min(xpSpace,trainingXp))
  const rows=(game.buildPassives?.ids || []).map(id=>({id,label:BUILD_PASSIVE_BY_ID[id].name,eligible:false,applied:false,reason:'本手未满足此被动的触发条件。'}))
  const set=(id,applied,reason,potential={})=>{const row=rows.find(row=>row.id===id);if(row)Object.assign(row,{eligible:applied,applied,reason,potential})}
  for(const row of scoreBuildBonuses(game,key))set(row.id,row.applied,row.reason,{scorePercent:row.applied?row.percent:0})
  set('five-card-order',five,!available(c,'five-card-order','fiveCardUsed')?'本波五牌军势次数已用完。':five?'本手 '+fiveRule.cards+' 张成功出牌，战令先逐项 +'+fiveRule.percent*100+'%。':'本手不符合 '+fiveRule.cards+' 张条件。',{orderPercent:five?fiveRule.percent:0})
  set('light-march',light>0,cost===0?'本手免费，未支出军令且不消耗轻装次数。':c.lightMarchUses>=lightRule.perWave?'本波 '+lightRule.perWave+' 次轻装退款已用完。':cards.length>lightRule.maxCards?'本手超过 '+lightRule.maxCards+' 张。':'返还实际支出军令。',{energyRefund:light})
  for(const [id,flag,suit,label,field,value] of [
    ['spade-law','spadeLawUsed','♠','黑桃','shield',rule('spade-law').shield],
    ['heart-oath','heartOathUsed','♥','红桃','healingPercent',rule('heart-oath').percent],
    ['club-hunt','clubHuntUsed','♣','梅花','attackPercent',rule('club-hunt').percent],
  ])set(id,available(c,id,flag)&&suits[suit]>=rule(id).minScoring,!available(c,id,flag)?'本波'+BUILD_PASSIVE_BY_ID[id].name+'次数已用完。':'至少 '+rule(id).minScoring+' 张计分'+label+'时触发。',{[field]:value})
  set('diamond-return',diamond,!available(c,'diamond-return','diamondReturnUsed')?'本波方片机会已用完。':suits['♦']<diamondRule.minScoring?'本手计分方片不足 '+diamondRule.minScoring+' 张。':cost===0?'本手免费，消耗方片机会但实际返还 0。':light?'先结算轻装，再返还本手剩余实际支出。':'按计分方片与实际支出返还。',{energyRefund:diamondRefund})
  set('reserve-instructor',instructor,waiting?'本手传说进入候补，不是转训。':!trainer?'本手未满编转训。':extraXp?'转训经验 +'+instructorRule.percent*100+'%，实际受999经验上限限制。':'受999经验上限截断，本次实际额外经验0。',{xpGain:extraXp})
  for(const id of ['fusion-code','elite-pact'])set(id,false,'持续作用于符合条件的当前及未来士兵永久基础，不在本手重复相乘。')
  set('captain-orders',false,'正式受令时，仅在目标战团的主将获得该次战令数值 +'+rule('captain-orders').percent*100+'%。')
  return {rows,five,light,diamond,diamondRefund,suits,orderFactor:five?1+fiveRule.percent:1,baseTrainingXp:trainingXp,trainingXp:boostedXp,instructor}
}

export function commitBuildPassives(game,plan,{trainer=null,trainingBefore=0,trainingAfter=0,orderId=null}={}){
  const state=stateFor(game),c=state.wave.counters,p=plan.buildPlan,events=[]
  if(!p)return events
  const emit=(id,details)=>events.push(recordBuildPassiveEvent(game,id,{orderId,...details}))
  for(const row of scoreBuildBonuses(game,plan.key))if(row.applied)emit(row.id,{effective:true,reason:row.reason,effects:{scorePercent:row.percent,finalScore:plan.score.total}})
  if(p.five){consume(c,'five-card-order','fiveCardUsed');emit('five-card-order',{effective:true,reason:'先放大本手实际战令，再单独结算主将军令。',effects:{orderPercent:rule('five-card-order').percent}})}
  for(const [id,amount] of [['light-march',p.light],['diamond-return',p.diamondRefund]]){
    if(id==='light-march'&&!amount || id==='diamond-return'&&!p.diamond)continue
    if(id==='light-march')c.lightMarchUses++;else consume(c,'diamond-return','diamondReturnUsed')
    const before=game.energy;game.energy=Math.min(game.maxEnergy,game.energy+amount);const gained=game.energy-before
    emit(id,{effective:gained>0,reason:gained>0?'返还本手真实支出的军令。':'本手无剩余实际支出，返还0；首次方片机会已用。',effects:{energyRefund:gained,actualSpent:plan.cost}})
  }
  if(hasBuildPassive(game,'spade-law')&&available(c,'spade-law','spadeLawUsed')&&p.suits['♠']>=rule('spade-law').minScoring){
    consume(c,'spade-law','spadeLawUsed');const units=game.allies.filter(unit=>unit.hp>0&&unit.type==='knight'),shield=rule('spade-law').shield
    for(const unit of units)unit.shield=(unit.shield || 0)+shield
    emit('spade-law',{effective:units.length>0,targetIds:units.map(unit=>unit.id),reason:units.length?'在场铁卫实际获得护盾。':'满足条件，但在场没有铁卫，实际赋盾0。',effects:{shield:shield*units.length,targets:units.length}})
  }
  for(const [id,flag,suit] of [['heart-oath','heartOathUsed','♥'],['club-hunt','clubHuntUsed','♣']])if(hasBuildPassive(game,id)&&available(c,id,flag)&&p.suits[suit]>=rule(id).minScoring){
    consume(c,id,flag);emit(id,{effective:true,reason:'已激活本波当前及未来对应战团；实际治疗或箭伤另行记录。',effects:{activated:1}})
  }
  if(p.instructor){const actual=Math.max(0,trainingAfter-trainingBefore),without=Math.min(p.baseTrainingXp,Math.max(0,999-trainingBefore)),extra=Math.max(0,actual-without)
    emit('reserve-instructor',{effective:extra>0,unitId:trainer?.id,targetIds:trainer?[trainer.id]:[],reason:extra?'记录满编转训实际额外经验。':'接收者经验已封顶，本次额外经验0。',effects:{xpGain:extra,totalXp:actual}})
  }
  state.wave.previousHand=plan.key
  return events
}
export function heartOathMultiplier(game,source){return hasBuildPassive(game,'heart-oath')&&waveState(game).counters.heartOathUsed&&source?.side==='ally'&&source.type==='healer'?1+rule('heart-oath').percent:1}
export function applyBuildPassiveAttack(game,unit,target,{damageUnit,launchMissile}){
  if(!hasBuildPassive(game,'club-hunt') || unit.side!=='ally' || unit.type!=='ranger' || unit.hp<=0)return null
  const c=stateFor(game).wave.counters
  if(!c.clubHuntUsed || c.clubShots.includes(unit.id))return null
  c.clubShots.push(unit.id)
  const shield=target.shield || 0,requested=unit.atk*rule('club-hunt').percent,flight=launchMissile(game,unit,target,'attack','#9bc58e')
  const damage=damageUnit(game,target,requested,flight,unit),shieldDamage=shield-(target.shield || 0)
  return recordBuildPassiveEvent(game,'club-hunt',{effective:damage>0||shieldDamage>0,unitId:unit.id,targetIds:[target.id],reason:damage>0?'首次真实基础攻击追加一支'+rule('club-hunt').percent*100+'%攻击箭。':target.hp<=0?'基础攻击已击倒目标，追加箭没有虚构生命伤害。':'追加箭被护盾吸收。',effects:{damage,shieldDamage,requested,arrows:1}})
}
