import {energyLimit} from './legacyRun.js'
import { JOKERS, JOKER_BY_ID } from './campaignRules.js'
import { ORDER_BOOK, MAX_ORDER_LEVEL } from './orders.js'
import { random, gainGold, restoreBase, log } from './gameState.js'
import { gainCrystals } from './economy.js'
import { armyRewardAvailable, applyArmyReward } from './rewardModifiers.js'
import {LIFE_RULES,lifeMaxCap,expandLifeMax} from './playerLife.js'
import {BUILD_PASSIVES,hasBuildPassive,acquireBuildPassive} from './buildPassives.js'
import {syncPostWaveRewardReport} from './combatStats.js'

function freezeData(value) {
  if(value && typeof value==='object'){Object.values(value).forEach(freezeData);Object.freeze(value)}
  return value
}

const reward=(id,name,icon,category,weight,durationKey,effect,condition,description)=>({
  id,name,icon,category,direction:effect.kind==='buildPassive'?(['fusion-code','captain-orders','reserve-instructor','elite-pact'].includes(effect.passiveId)?'army':'poker'):['power','enlist','army'].includes(effect.kind)?'army':['maxDiscards','supply','next','handLevel'].includes(effect.kind)?'poker':'resource',
  weight,durationKey,duration:{instant:'立即',permanent:'永久',next:'下一波',mixed:'立即 / 下一波'}[durationKey],
  effect,condition,description,
})

// Definitions contain every amount and cap. Offers retain their concrete target
// so claiming never rolls another card-book key, item, recruit, or random number.
export const WAVE_REWARDS = Object.freeze([
  reward('repair','恢复生命','♥','life',10,'instant',{kind:'repair',amount:LIFE_RULES.expansion},'missing-life','恢复至多 {amount} 点生命。'),
  reward('power','淬炼军团','♠','recruit',8,'permanent',{kind:'power',amount:.08,cap:1},'recruit-power-room','之后征募的士兵基础属性永久提高 {percent}%。'),
  reward('supply','战地补给','◇','supply',10,'mixed',{kind:'supply',gold:6,discards:1,cap:6},'always','获得 {gold} 金币；下一波额外免费换牌 +{discards}。'),
  reward('enlist','收编枪兵','♠','recruit',7,'next',{kind:'enlist',pattern:'twoPair',cap:5},'enlist-room','下一波收编一名枪兵；满编时按征募规则转为集训经验。'),
  reward('discard-training','换牌教范','↺','permanent',5,'permanent',{kind:'maxDiscards',amount:1,cap:12},'max-discards-room','每波免费换牌次数永久 +{amount}，下波起生效。'),
  reward('energy-reservoir','军令储备','ϟ','permanent',5,'permanent',{kind:'maxEnergy',amount:2,cap:30},'max-energy-room','军令上限永久 +{amount}，并补充同等军令。'),
  reward('extra-hand','战前动员','✚','next-wave',7,'next',{kind:'next',bonus:'hands',amount:1,cap:3},'next-room','下一波额外出牌次数 +{amount}。'),
  reward('opening-score','开幕华彩','✦','next-wave',6,'next',{kind:'next',bonus:'firstScorePercent',amount:.25,cap:1},'next-room','下一波首次成功出牌的最终计分 +{percent}%，成功后消耗。'),
  reward('order-notes','牌谱心得','▤','hand-book',7,'permanent',{kind:'handLevel',amount:1,cap:MAX_ORDER_LEVEL},'available-book','{handName}牌谱提升 {amount} 级，最高 Lv.{cap}。'),
  reward('army-experience','全军集训','⚑','army',8,'permanent',{kind:'army',army:{experience:2,xpCap:999}},'formal-army-room','现有正式军团全体经验 +{experience}（含候补）。'),
  reward('army-attack','磨砺锋芒','⚔','army',7,'permanent',{kind:'army',army:{attackPercent:.06,attackCap:1}},'formal-army-room','现有正式军团攻击与治疗永久提高 {percent}%（含候补）。'),
  reward('army-health','强健军阵','♥','army',7,'permanent',{kind:'army',army:{healthPercent:.08,healthCap:2}},'formal-army-room','现有正式军团生命上限永久提高 {percent}%，保留当前生命比例（含候补）。'),
  reward('gate-masonry','生命上限提升','♥','life',5,'permanent',{kind:'gateMax',amount:LIFE_RULES.expansion,repair:LIFE_RULES.expansion,capMultiplier:LIFE_RULES.maxMultiplier},'life-capacity-room','生命上限永久 +{amount}，并恢复至多 {repair} 点生命。'),
  reward('crystal-purse','蓝水晶补给','◆','currency',10,'instant',{kind:'currency',crystals:4},'always','获得 {crystals} 蓝水晶。'),
  reward('item-cache','军需遗珍','▣','item',7,'instant',{kind:'item',quantity:1},'available-item','获得 {itemName} ×{quantity}。{itemDescription}'),
  reward('gold-purse','零用军饷','●','currency',12,'instant',{kind:'currency',gold:3},'always','获得 {gold} 金币。'),
  reward('gold-chest','充裕军饷','◉','currency',6,'instant',{kind:'currency',gold:12},'always','获得 {gold} 金币。'),
  reward('crystal-chest','蓝水晶宝匣','❖','currency',5,'instant',{kind:'currency',crystals:8},'always','获得 {crystals} 蓝水晶。'),
  reward('army-experience-greater','老兵授课','⚑','army',4,'permanent',{kind:'army',army:{experience:4,xpCap:999}},'formal-army-room','现有正式军团全体经验 +{experience}（含候补）。'),
  reward('army-attack-greater','百战锋芒','⚔','army',4,'permanent',{kind:'army',army:{attackPercent:.10,attackCap:1}},'formal-army-room','现有正式军团攻击与治疗永久提高 {percent}%（含候补）。'),
  reward('army-health-greater','坚韧军阵','♥','army',4,'permanent',{kind:'army',army:{healthPercent:.12,healthCap:2}},'formal-army-room','现有正式军团生命上限永久提高 {percent}%，保留当前生命比例（含候补）。'),
  reward('extra-hands-greater','紧急动员','✚','next-wave',4,'next',{kind:'next',bonus:'hands',amount:2,cap:3},'next-room','下一波额外出牌次数 +{amount}。'),
  reward('next-discards','斥候情报','↺','next-wave',7,'next',{kind:'next',bonus:'discards',amount:2,cap:6},'next-room','下一波额外免费换牌次数 +{amount}。'),
  reward('next-prints','备用印模','▥','next-wave',6,'next',{kind:'next',bonus:'prints',amount:2,cap:8},'next-room','下一波额外改印次数 +{amount}。'),
  ...BUILD_PASSIVES.map(passive=>reward(passive.id,passive.name,passive.icon,'build',passive.weight,'permanent',{kind:'buildPassive',passiveId:passive.id},'unowned-build',passive.description)),
].map(freezeData))

export const WAVE_REWARD_BY_ID = Object.freeze(Object.fromEntries(WAVE_REWARDS.map(definition=>[definition.id,definition])))
export const CURRENCY_REWARD_IDS = Object.freeze(WAVE_REWARDS.filter(definition=>definition.category==='currency').map(definition=>definition.id))
const cleanNumber=value=>Math.round(value*1e8)/1e8
const room=(cap,current)=>Math.max(0,cleanNumber(cap-(current || 0)))
const nextBonuses=game=>game.waveBonuses?.next || {}
const books=game=>Object.keys(ORDER_BOOK).filter(key=>(!ORDER_BOOK[key].secret || game.discoveredHands?.includes(key)) && (game.handLevels?.[key] ?? 1)<MAX_ORDER_LEVEL)
const items=game=>JOKERS.filter(item=>{
  const owned=(game.jokers || []).find(held=>held.id===item.id)
  return !owned || item.stackable && Number.isSafeInteger((owned.quantity ?? 1)+1)
})
const choose=(game,values)=>values[Math.floor(random(game)*values.length)]
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const plain=value=>value && typeof value==='object' && !Array.isArray(value)

function definitionAvailability(game,definition,payload) {
  const effect=definition.effect
  if(game.finalWaveCleared && ['next','enlist','supply'].includes(effect.kind))return {available:false,reason:'终幕已守住，没有下一波可使用此补给。'}
  if(effect.kind==='repair' && game.baseHp>=game.maxBaseHp)return {available:false,reason:'生命已满，无需恢复。请选择其他补给。'}
  if(effect.kind==='power' && room(effect.cap,game.upgrades?.power)<=0)return {available:false,reason:'征募强化已达上限。'}
  if(['maxDiscards','maxEnergy'].includes(effect.kind) && room(effect.cap,game[effect.kind])<=0)return {available:false,reason:'此项永久提升已达上限。'}
  if(effect.kind==='gateMax' && room(lifeMaxCap(game),game.maxBaseHp)<=0)return {available:false,reason:'生命上限已满。'}
  if(effect.kind==='buildPassive' && hasBuildPassive(game,effect.passiveId))return {available:false,reason:'本局已拥有此构筑奖励。'}
  if(effect.kind==='next' && room(effect.cap,nextBonuses(game)[effect.bonus])<=0)return {available:false,reason:'下一波此项补给已达上限。'}
  if(effect.kind==='enlist' && (nextBonuses(game).enlistPatterns?.length || 0)>=effect.cap)return {available:false,reason:'下一波收编名额已满。'}
  if(effect.kind==='army' && !armyRewardAvailable(game,effect.army))return {available:false,reason:'当前没有可获益的正式军团成员，或已达强化上限。'}
  if(effect.kind==='handLevel') {
    const available=books(game)
    if(!available.length)return {available:false,reason:'当前可用牌谱均已满级。'}
    if(payload && !available.includes(payload.handKey))return {available:false,reason:'这份牌谱已满级或尚未发现，无法领取。'}
  }
  if(effect.kind==='item') {
    const available=items(game)
    if(!available.length || payload && !available.some(item=>item.id===payload.itemId))return {available:false,reason:'这件道具已拥有且不可叠加，无法领取。'}
  }
  return {available:true,reason:''}
}

function makePayload(game,definition) {
  const effect=definition.effect
  if(effect.kind==='repair')return {amount:effect.amount}
  if(effect.kind==='power')return {amount:Math.min(effect.amount,room(effect.cap,game.upgrades?.power)),cap:effect.cap}
  if(['maxDiscards','maxEnergy'].includes(effect.kind))return {amount:Math.min(effect.amount,room(effect.cap,game[effect.kind])),cap:effect.cap}
  if(effect.kind==='gateMax')return {amount:Math.min(effect.amount,room(lifeMaxCap(game),game.maxBaseHp)),repair:effect.repair,cap:lifeMaxCap(game)}
  if(effect.kind==='buildPassive')return {passiveId:effect.passiveId}
  if(effect.kind==='supply')return {gold:effect.gold,discards:Math.min(effect.discards,room(effect.cap,nextBonuses(game).discards)),cap:effect.cap}
  if(effect.kind==='enlist')return {pattern:effect.pattern}
  if(effect.kind==='next')return {bonus:effect.bonus,amount:Math.min(effect.amount,room(effect.cap,nextBonuses(game)[effect.bonus])),cap:effect.cap}
  if(effect.kind==='handLevel')return {handKey:choose(game,books(game)),amount:effect.amount,cap:effect.cap}
  if(effect.kind==='item')return {itemId:choose(game,items(game)).id,quantity:effect.quantity}
  if(effect.kind==='army')return {...effect.army}
  if(effect.kind==='currency')return {...(effect.gold?{gold:effect.gold}:{}),...(effect.crystals?{crystals:effect.crystals}:{})}
  return null
}

function describe(definition,payload) {
  const item=JOKER_BY_ID[payload.itemId],values={...payload,
    percent:cleanNumber((payload.attackPercent || payload.healthPercent || payload.amount || 0)*100),
    handName:ORDER_BOOK[payload.handKey]?.name || '',itemName:item?.name || '',itemDescription:item?.description || '',
  }
  return definition.description.replace(/\{(\w+)\}/g,(_,key)=>String(values[key] ?? ''))
}

function offerFromPayload(definition,payload) {
  return {version:1,id:definition.id,name:definition.name,icon:definition.icon,category:definition.category,direction:definition.direction,
    effect:JSON.parse(JSON.stringify(definition.effect)),weight:definition.weight,condition:definition.condition,
    payload,description:describe(definition,payload),duration:definition.duration,durationKey:definition.durationKey}
}

/** Also usable for deterministic migration of the four former ordinary rewards. */
export function createRewardOffer(game,id,{allowUnavailable=false}={}) {
  const definition=WAVE_REWARD_BY_ID[id]
  if(!definition || !allowUnavailable && !definitionAvailability(game,definition).available)return null
  // A migration may keep a now-unusable fixed offer; random offers still require
  // a real eligible target and never receive an invented item or hidden hand key.
  if(definition.effect.kind==='handLevel' && !books(game).length || definition.effect.kind==='item' && !items(game).length)return null
  const payload=makePayload(game,definition)
  if(allowUnavailable && payload.amount===0)payload.amount=definition.effect.amount
  return offerFromPayload(definition,payload)
}

/** Three weighted draws from one eligible pool; no category receives a slot. */
export function createRewardShelf(game) {
  const pool=WAVE_REWARDS.filter(definition=>definitionAvailability(game,definition).available)
  const offers=[]
  while(offers.length<3 && pool.length) {
    const total=pool.reduce((sum,definition)=>sum+definition.weight,0)
    let ticket=random(game)*total,index=pool.length-1
    for(let i=0;i<pool.length;i++){ticket-=pool[i].weight;if(ticket<0){index=i;break}}
    const [definition]=pool.splice(index,1),offer=createRewardOffer(game,definition.id)
    if(offer)offers.push(offer)
  }
  return offers
}

function payloadValid(definition,payload) {
  if(!plain(payload))return false
  const effect=definition.effect,keys=Object.keys(payload).sort().join(','),amount=Number.isFinite(payload.amount) && payload.amount>0 && payload.amount<=effect.amount
  if(effect.kind==='repair')return keys==='amount' && payload.amount===effect.amount
  if(['power','maxDiscards','maxEnergy'].includes(effect.kind))return keys==='amount,cap' && amount && payload.cap===effect.cap && (effect.kind==='power' || Number.isInteger(payload.amount))
  if(effect.kind==='gateMax')return keys==='amount,cap,repair' && amount && Number.isInteger(payload.amount) && [lifeMaxCap('standard'),lifeMaxCap('veteran')].includes(payload.cap) && payload.repair===effect.repair
  if(effect.kind==='buildPassive')return keys==='passiveId' && payload.passiveId===effect.passiveId
  if(effect.kind==='supply')return keys==='cap,discards,gold' && payload.gold===effect.gold && payload.cap===effect.cap && Number.isInteger(payload.discards) && payload.discards>=0 && payload.discards<=effect.discards
  if(effect.kind==='enlist')return keys==='pattern' && payload.pattern===effect.pattern
  if(effect.kind==='next')return keys==='amount,bonus,cap' && payload.bonus===effect.bonus && payload.cap===effect.cap && amount && (effect.bonus==='firstScorePercent' || Number.isInteger(payload.amount))
  if(effect.kind==='handLevel')return keys==='amount,cap,handKey' && Object.hasOwn(ORDER_BOOK,payload.handKey) && payload.amount===effect.amount && payload.cap===effect.cap
  if(effect.kind==='item')return keys==='itemId,quantity' && Object.hasOwn(JOKER_BY_ID,payload.itemId) && payload.quantity===effect.quantity
  if(effect.kind==='army')return equal(payload,effect.army)
  if(effect.kind==='currency')return equal(payload,{...(effect.gold?{gold:effect.gold}:{}),...(effect.crystals?{crystals:effect.crystals}:{})})
  return false
}

export function isRewardOffer(offer) {
  const definition=WAVE_REWARD_BY_ID[offer?.id]
  return Boolean(definition && offer.version===1 && payloadValid(definition,offer.payload) &&
    offer.name===definition.name && offer.icon===definition.icon && offer.category===definition.category && offer.direction===definition.direction &&
    offer.weight===definition.weight && offer.condition===definition.condition && equal(offer.effect,definition.effect) &&
    offer.duration===definition.duration && offer.durationKey===definition.durationKey && offer.description===describe(definition,offer.payload))
}

/** Convert old saved facts without rerolling their book/item target. */
export function migrateRewardOffer(game,offer) {
  const definition=WAVE_REWARD_BY_ID[offer?.id]
  if(!definition)return null
  if(['repair','gateMax'].includes(definition.effect.kind) || !offer.payload)return createRewardOffer(game,offer.id,{allowUnavailable:true})
  return payloadValid(definition,offer.payload)?offerFromPayload(definition,JSON.parse(JSON.stringify(offer.payload))):null
}

export function rewardAvailability(game,id) {
  if(game.phase!=='shop' || game.rewardChosen || game.rewardState?.claimedId || game.rewardState && game.rewardState.wave!==game.wave)
    return {available:false,reason:'本波补给已领取或尚未开放。'}
  const offer=game.rewards?.find(reward=>reward.id===id)
  if(!isRewardOffer(offer))return {available:false,reason:'这份补给不在本波候选中，或补给资料不完整。'}
  return definitionAvailability(game,WAVE_REWARD_BY_ID[id],offer.payload)
}

/** The persisted payload is the sole concrete target; there is no RNG here. */
export function chooseWaveReward(game,id) {
  if(!rewardAvailability(game,id).available)return false
  const offer=game.rewards.find(reward=>reward.id===id),payload=offer.payload,effect=WAVE_REWARD_BY_ID[id].effect
  if(effect.kind==='repair')restoreBase(game,payload.amount,{source:'reward',sourceId:id})
  else if(effect.kind==='power')game.upgrades.power=Math.min(payload.cap,cleanNumber(game.upgrades.power+payload.amount))
  else if(effect.kind==='maxDiscards')game.maxDiscards=Math.min(payload.cap,game.maxDiscards+payload.amount)
  else if(effect.kind==='maxEnergy') {
    const gain=Math.min(payload.amount,room(payload.cap,game.maxEnergy));game.maxEnergy+=gain;game.energy=Math.min(energyLimit(game),game.energy+gain)
  } else if(effect.kind==='gateMax') {
    expandLifeMax(game,payload.amount,{source:'reward',sourceId:id,heal:payload.repair})
  } else if(effect.kind==='supply' || effect.kind==='next' || effect.kind==='enlist') {
    game.waveBonuses ??= {next:{},active:{}};game.waveBonuses.next ??= {}
    const next=game.waveBonuses.next
    if(effect.kind==='supply'){gainGold(game,payload.gold);next.discards=Math.min(payload.cap,(next.discards || 0)+payload.discards)}
    else if(effect.kind==='enlist'){next.enlistPatterns ??= [];next.enlistPatterns.push(payload.pattern)}
    else next[payload.bonus]=Math.min(payload.cap,cleanNumber((next[payload.bonus] || 0)+payload.amount))
  } else if(effect.kind==='handLevel')game.handLevels[payload.handKey]=Math.min(payload.cap,(game.handLevels[payload.handKey] || 1)+payload.amount)
  else if(effect.kind==='item') {
    const owned=game.jokers.find(item=>item.id===payload.itemId)
    if(owned)owned.quantity=(owned.quantity ?? 1)+payload.quantity
    else game.jokers.push({...JOKER_BY_ID[payload.itemId],quantity:payload.quantity,triggers:0,flash:0})
    // A free unique item may also be on the generated merchant shelf. Close
    // that slot so ownership, purchase gating and persisted stock agree.
    if(!JOKER_BY_ID[payload.itemId].stackable && game.shop.includes(payload.itemId) && !game.soldShop.includes(payload.itemId))game.soldShop.push(payload.itemId)
  } else if(effect.kind==='army') {if(!applyArmyReward(game,payload))return false}
  else if(effect.kind==='buildPassive'){if(!acquireBuildPassive(game,payload.passiveId))return false}
  else if(effect.kind==='currency') {
    if(payload.gold)gainGold(game,payload.gold)
    if(payload.crystals && gainCrystals(game,payload.crystals)!==payload.crystals)return false
  } else return false
  game.rewardChosen=id
  game.rewardState={wave:game.wave,claimedId:id}
  log(game,`战利品 · ${offer.name} · ${offer.description}`,'good')
  syncPostWaveRewardReport(game)
  return true
}

export const chooseReward=chooseWaveReward
