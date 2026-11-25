import { performerOf } from './performers.js'
import { playedFace } from './deck.js'
import { FIELD_LIMIT } from './campaignRules.js'

export const ONBOARDING_VERSION = 1
export const ONBOARDING_STEPS = [
  {id:'w1-front',wave:1,title:'先招一名前排',body:'选一张牌，确认预览为高牌后出牌，招一名刀兵挡在前面。',target:'orders',actionLabel:'打开手牌'},
  {id:'w1-healer',wave:1,title:'用对子招一名牧师',body:'选两张同点数的牌，打出对子招募牧师。牧师会在战斗中自动治疗受伤的友军。',target:'orders',actionLabel:'打开手牌'},
  {id:'w1-shield',wave:1,title:'把列盾发给前排',body:'打出对子时，把受令部队选为铁卫，让前排获得护盾。招来的牧师和受令的部队可以不同。',target:'orders',actionLabel:'查看战令'},
  {id:'w2-trick',wave:2,title:'试一次你的小丑戏法',body:'每位小丑每波有一次专属戏法，施放时机和目标各不相同。',target:'trick',actionLabel:'查看角色戏法'},
  {id:'w3-formation',wave:3,title:'按来敌调整阵型或站位',body:'这一波有鸣钟使。查看军情，用猎手阵优先打击后排，或拖动士兵，让近战在前、治疗与远程在后。',target:'brief',actionLabel:'查看军情与阵型'},
  {id:'w3-bell',wave:3,title:'战前备好止钟令',body:'鸣钟使会召唤流寇援军。出战前打出对子或更高牌型，可自动打断第一次召唤。开战后不能再补发战令。',target:'orders',actionLabel:'准备止钟令'},
]
const stepIds = ONBOARDING_STEPS.map(step=>step.id)
const statuses = ['active','skipped','complete']
const featureWave = {
  trick:2,forge:2,roster:2,training:2,champion:2,fusion:2,
  brief:3,formation:3,move:3,position:3,
  feint:4,press:4,printing:4,college:4,research:4,advanced:4,
}

export function validOnboarding(value) {
  if (value === undefined) return true
  if (!value || typeof value!=='object' || Array.isArray(value) || value.version!==ONBOARDING_VERSION || !statuses.includes(value.status)) return false
  if (Object.keys(value).some(key=>!['version','status','done','skipped'].includes(key))) return false
  if (![value.done,value.skipped].every(list=>Array.isArray(list) && list.length<=stepIds.length && new Set(list).size===list.length && list.every(id=>stepIds.includes(id)))) return false
  if (value.done.some(id=>value.skipped.includes(id))) return false
  return value.status==='active' || value.done.length+value.skipped.length===stepIds.length
}

// Missing tutorial data belongs to an older save and must never lock its interface.
export function migrateOnboarding(value) {
  if (value === undefined || !validOnboarding(value)) return undefined
  return {version:ONBOARDING_VERSION,status:value.status,done:[...value.done],skipped:[...value.skipped]}
}

export function initOnboarding(game,{enabled=true}={}) {
  if (!game) return null
  if (game.onboarding!==undefined && validOnboarding(game.onboarding)) return game.onboarding
  game.onboarding={version:ONBOARDING_VERSION,status:enabled?'active':'skipped',done:[],skipped:enabled?[]:[...stepIds]}
  return game.onboarding
}

function active(game) {
  return !!game && validOnboarding(game.onboarding) && game.onboarding?.status==='active'
}

function stateEvidence(game) {
  const done=[]
  const army=[...(game.allies || []),...(game.casualties || [])].filter(unit=>unit.echoUntil==null)
  if (game.wave===1) {
    const frontline=army.filter(unit=>unit.pattern==='high' || unit.jobId==='blade')
    if (frontline.length) done.push('w1-front')
    if (army.some(unit=>unit.pattern==='pair' || unit.jobId==='priest')) done.push('w1-healer')
    if (army.some(unit=>unit.type==='knight' && unit.shield>0) &&
        (done.includes('w1-healer') || game.lastDeploy?.key==='pair' && game.lastDeploy?.target==='knight')) done.push('w1-shield')
  }
  if (game.wave===2 && game.trickUsed===true) done.push('w2-trick')
  if (game.wave===3) {
    if (game.bellReady===true || game.tacticsReport?.interrupts>0) done.push('w3-bell')
  }
  return done
}

function progressOf(game,event,payload={}) {
  const state=migrateOnboarding(game.onboarding)
  if (!state || state.status!=='active') return state
  const done=new Set(state.done),skipped=new Set(state.skipped)
  for (const id of stateEvidence(game)) if (!skipped.has(id)) done.add(id)
  if (game.wave===1 && event==='deploy' && payload.success!==false) {
    const deal=game.lastDeploy
    if (deal?.key==='high' && deal.count>0) done.add('w1-front')
    if (deal?.key==='pair' && deal.count>0) done.add('w1-healer')
    if (deal?.key==='pair' && deal.target==='knight' && (game.allies || []).some(unit=>unit.type==='knight' && unit.shield>0)) done.add('w1-shield')
  }
  if (game.wave===3 && game.phase==='ready' && payload.success!==false) {
    if (event==='formation' && payload.previous!==game.formation && ['guard','hunt','spread'].includes(game.formation)) done.add('w3-formation')
    if (event==='move' && (game.allies || []).some(unit=>unit.campSpot && (!payload.id || unit.id===payload.id))) done.add('w3-formation')
  }
  // Advancing past an opportunity is a skip, never fabricated completion.
  for (const step of ONBOARDING_STEPS) if (step.wave<game.wave && !done.has(step.id)) skipped.add(step.id)
  for (const id of skipped) done.delete(id)
  state.done=stepIds.filter(id=>done.has(id))
  state.skipped=stepIds.filter(id=>skipped.has(id))
  if (state.done.length+state.skipped.length===stepIds.length) state.status='complete'
  return state
}

export function updateOnboarding(game,event='state',payload={}) {
  if (!active(game)) return false
  const next=progressOf(game,event,payload)
  const changed=JSON.stringify(next)!==JSON.stringify(game.onboarding)
  if (changed) game.onboarding=next
  return changed
}

export function skipOnboarding(game,scope='step') {
  if (!active(game) || !['step','all'].includes(scope)) return false
  const state=progressOf(game,'state')
  if (scope==='all') {
    state.skipped=stepIds.filter(id=>!state.done.includes(id));state.status='skipped'
  } else {
    const step=ONBOARDING_STEPS.find(item=>item.wave<=game.wave && !state.done.includes(item.id) && !state.skipped.includes(item.id))
    if (!step) return false
    state.skipped=stepIds.filter(id=>state.skipped.includes(id) || id===step.id)
    if (state.done.length+state.skipped.length===stepIds.length) state.status='complete'
  }
  game.onboarding=state
  return true
}

export function featureVisible(game,key) {
  if (!active(game)) return true
  const progress=progressOf(game,'state')
  return progress.status!=='active' || game.wave>=(Object.hasOwn(featureWave,key)?featureWave[key]:1)
}

function pairHint(game) {
  if (game.handsLeft<=0) return '本波出牌次数已用完。可以自愿加购一手，或跳过这一步正常出战。'
  const ranks=(game.hand || []).map(card=>playedFace(game,card).rank)
  if (new Set(ranks).size===ranks.length) return '现在没有对子。可换牌寻找两张同点数牌，也可跳过这一步，继续正常游玩。'
  if (!game.paidHandsLeft && game.energy<3) return '军令不足时不必强求这一步。可跳过，并用已有军团继续远征。'
  return '选两张点数相同的牌即可，不需要五张。也可以按 H 请求一手可出的牌，再自行调整。'
}

function trickStep(game,step) {
  const hero=performerOf(game.doctrine)
  const army=(game.allies || []).filter(unit=>unit.hp>0)
  const description={
    ghost:{body:'战前选一张手牌，把点数升或降一级，再围绕它组牌。离手后改点失效。',hint:'点角色戏法，再选手牌。实际改点成功后，这一步会自动完成。'},
    mirror:{body:'先给友军下令强化，交战中再复制一名友军。分身保留当下战力，最多存在六秒。',hint:army.length>=FIELD_LIMIT?'镜像也占一个兵位。现在已满编，战前可在工坊整编腾位；也可以跳过本步。':'出战时至少留一个空兵位，交战中点戏法，再选一名友军。'},
    bell:{body:'交战中选一名敌人，让假牌把它引向己方前排，进入军团的火力范围。',hint:'先布置前排再出战。有友军与敌军在场时，点戏法后选择敌人。'},
    sleeve:{body:'夹层在战后商店藏一张余牌，下一波起手会取回同一张，改印也保留。',hint:game.phase==='shop'?'现在可以点戏法，再选一张要带进第三波的手牌。':'先完成第二波战斗，进入战后商店再留牌；这一步会一直等到战后。'},
    voice:{body:'战前用同一手牌向两种部队发令。主队得到全部加成，副队得到一半，只结算一次消耗。',hint:new Set(army.map(unit=>unit.type)).size<2?'先准备两个不同战团，例如铁卫与牧师；同属铁卫的刀兵和枪兵不算两个战团。':'选好要打出的牌和主受令部队，再用木偶复令选择另一战团。'},
    escape:{body:'交战中给一名重要友军预先系上逃生绳。它首次受到致命伤时会保留一点生命并退到后排。',hint:'先出战，再点戏法选择要保护的友军；系绳成功就完成这一步，无需等待它倒下。'},
  }[hero.id]
  const usable=hero.id==='sleeve'?game.phase==='shop':['ghost','voice'].includes(hero.id)?game.phase==='ready':game.phase==='battle'
  return {...step,title:hero.name+' · '+hero.skill,...description,actionLabel:usable?'使用角色戏法':'查看角色戏法',usable}
}

// Read-only view derives completed actions too, so a missed UI callback cannot strand the coach.
export function onboardingView(game) {
  if (!active(game) || ['won','lost'].includes(game.phase)) return null
  const progress=progressOf(game,'state')
  if (progress.status!=='active') return null
  const next=ONBOARDING_STEPS.find(step=>step.wave<=game.wave && !progress.done.includes(step.id) && !progress.skipped.includes(step.id))
  let step=next && {...next}
  if (step?.id==='w2-trick') step=trickStep(game,step)
  else if (step && game.phase!=='ready') step={...step,target:null,actionLabel:null,hint:'备战已经结束，可以先观察这一波战斗。跳过本步或进入下一波，都不会阻止正常远征。'}
  else if (step && ['w1-healer','w1-shield','w3-bell'].includes(step.id)) {
    step.hint=step.id==='w1-shield' && !(game.allies || []).some(unit=>unit.type==='knight')?
      '先用高牌招一名前排，再把对子战令发给铁卫；也可以跳过本步，继续正常游玩。':pairHint(game)
  }
  if (!step) step={id:null,wave:game.wave,title:'这一波的准备已学会',body:game.phase==='ready'?'准备好就可以出战。下一波会介绍一个新操作，所有当前可用功能都能照常使用。':'观察军团自动交战，战后继续补给与商店。下一波会介绍一个新操作。',target:game.phase==='ready'?'field':null,actionLabel:game.phase==='ready'?'回到战场':null,hint:'也可以随时结束本轮引导，立即开放全部系统。'}
  return {...step,stepId:step.id,current:step.id,completed:progress.done.length,resolved:progress.done.length+progress.skipped.length,total:stepIds.length,
    done:[...progress.done],skipped:[...progress.skipped],stage:Math.min(3,game.wave),status:progress.status,canSkipStep:!!next,
    action:step.target?{target:step.target,label:step.actionLabel}:null}
}
