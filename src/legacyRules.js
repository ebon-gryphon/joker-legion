export const LEGACY_NODES = [
  {id:'treasury', name:'军需储备', prices:[3,6,10], amount:3, effect:n=>'初始金币 +'+n},
  {id:'crystals', name:'蓝晶补给', prices:[3,6,10], amount:2, effect:n=>'初始蓝水晶 +'+n},
  {id:'rehearsal', name:'战术预演', prices:[8], amount:1, effect:n=>'第 1 波免费换牌 +'+n+' 次'},
  {id:'contract', name:'商行契约', prices:[8], amount:1, effect:n=>'每局前 '+n+' 次主动刷新商店免蓝水晶'},
  {id:'orders', name:'先行军令', prices:[3,6], amount:1, effect:n=>'第 1 波初始军令 +'+n},
  {id:'supplies', name:'行军补给', prices:[12], amount:1, effect:n=>'开局携带 '+n+' 件由种子确定的普通补给'},
]
export const SUPPLY_ITEMS=['redraw-voucher','silver-pass','training-whistle']
export const PAYOUT={waveStep:3, wavePay:1, bossPay:2, win:4, endlessStart:12, endlessStep:6, endlessPay:2, veteranMultiplier:1.5}
const milestones=[
  {id:'first-win',name:'首次标准通关',amount:5, meets:r=>r.mode==='standard' && r.phase==='won'},
  ...[[18,3],[24,4],[30,5]].map(([wave,amount])=>({id:'endless-'+wave,name:'无尽首次到达第 '+wave+' 波',amount,meets:r=>r.mode==='endless' && r.wave>=wave})),
]

const natural=n=>Number.isSafeInteger(n) && n>=0
export const validId=id=>typeof id==='string' && id.length>0 && id.length<=600
export const emptyLevels=()=>Object.fromEntries(LEGACY_NODES.map(node=>[node.id,0]))
export const fullLevels=()=>Object.fromEntries(LEGACY_NODES.map(node=>[node.id,node.prices.length]))
export function validLevels(levels){
  return levels && Object.keys(levels).length===LEGACY_NODES.length && LEGACY_NODES.every(n=>natural(levels[n.id]) && levels[n.id]<=n.prices.length)
}
export const initialProfile=()=>({profileVersion:1,balance:0,lifetimeEarned:0,levels:emptyLevels(),milestones:[],settledRuns:[]})
export const terminalPhase=phase=>['won','lost','retired'].includes(phase)
export function outcomeOf(game){
  if(!game.inheritance || !validId(game.runId) || !terminalPhase(game.phase))return null
  return {runId:game.runId,phase:game.phase,mode:game.mode,difficulty:game.difficulty,wave:game.wave,
    cleared:game.stats.wavesCleared,bosses:game.inheritance.bossWaves.length}
}
function validOutcome(r){
  return r && validId(r.runId) && terminalPhase(r.phase) && ['standard','endless'].includes(r.mode) &&
    ['standard','veteran'].includes(r.difficulty) && natural(r.wave) && r.wave>=1 && (r.mode==='endless' || r.wave<=12) &&
    natural(r.cleared) && r.cleared===(r.phase==='lost'?r.wave-1:r.wave) && natural(r.bosses) && r.bosses<=Math.floor(r.wave/6) &&
    (r.phase!=='won' || r.mode==='standard' && r.wave===12) && (r.phase!=='retired' || r.mode==='endless')
}
export function payout(r,claimed){
  if(!validOutcome(r))throw Error('终局进度无效')
  const p=PAYOUT, waves=Math.floor(r.cleared/p.waveStep)*p.wavePay, bosses=r.bosses*p.bossPay
  const victory=r.phase==='won'?p.win:0
  const endless=r.mode==='endless'?Math.floor(Math.max(0,r.cleared-p.endlessStart)/p.endlessStep)*p.endlessPay:0
  const base=waves+bosses+victory+endless
  const adjusted=r.difficulty==='veteran'?Math.floor(base*p.veteranMultiplier):base
  const first=milestones.filter(m=>!claimed.includes(m.id) && m.meets(r)).map(({id,name,amount})=>({id,name,amount}))
  const total=adjusted+first.reduce((sum,m)=>sum+m.amount,0)
  if(!natural(total))throw Error('终局收益超过可保存范围')
  return {waves,bosses,victory,endless,difficulty:adjusted-base,first,total}
}
export function settleProfile(profile,outcome){
  if(!outcome)return {profile,receipt:null}
  const prior=profile.settledRuns.find(row=>row.runId===outcome.runId)
  if(prior)return {profile,receipt:prior}
  const award=payout(outcome,profile.milestones)
  const receipt={...outcome,award}
  return {receipt,profile:{...profile,balance:profile.balance+award.total,lifetimeEarned:profile.lifetimeEarned+award.total,
    milestones:[...profile.milestones,...award.first.map(m=>m.id)],settledRuns:[...profile.settledRuns,receipt]}}
}
export function purchaseLevel(profile,id,expectedLevel){
  const node=LEGACY_NODES.find(n=>n.id===id)
  if(!node || profile.levels[id]!==expectedLevel)return {profile,error:'升级状态已变，请查看当前等级'}
  const price=node.prices[expectedLevel]
  if(price===undefined)return {profile,error:'已满级'}
  if(profile.balance<price)return {profile,error:'红水晶不足'}
  return {profile:{...profile,balance:profile.balance-price,levels:{...profile.levels,[id]:expectedLevel+1}}}
}
export function validProfile(profile){
  if(!profile || profile.profileVersion!==1 || !validLevels(profile.levels) || !natural(profile.balance) ||
    !natural(profile.lifetimeEarned) || !Array.isArray(profile.milestones) || !Array.isArray(profile.settledRuns))return false
  const seen=new Set(),claimed=[]
  let earned=0
  for(const r of profile.settledRuns){
    if(!validOutcome(r) || seen.has(r.runId))return false
    const award=payout(r,claimed)
    if(JSON.stringify(r.award)!==JSON.stringify(award))return false
    seen.add(r.runId);earned+=award.total;claimed.push(...award.first.map(m=>m.id))
  }
  const spent=LEGACY_NODES.reduce((sum,n)=>sum+n.prices.slice(0,profile.levels[n.id]).reduce((a,b)=>a+b,0),0)
  return earned===profile.lifetimeEarned && earned-spent===profile.balance && JSON.stringify(claimed)===JSON.stringify(profile.milestones)
}

