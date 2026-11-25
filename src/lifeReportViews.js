import {JOKER_BY_ID} from './campaignRules.js'
import {HOSTILE} from './tactics.js'
import {WAVE_REWARD_BY_ID} from './waveRewards.js'
const names={breach:'敌军突破',timeout:'超时残敌','boss-timeout':'首领超时','boss-breach':'首领突破',
 'red-echo':'红心回响','flush-crown':'同花王冠','gate-rivet':'生命铆钉','wave-clear':'本波结算',
 'wave-end':'本波结束','bellkeeper':'鸣钟使','reward-repair':'恢复生命','life-expansion':'生命上限提升'}
const kinds={loss:'生命损失',heal:'恢复生命',max:'提高生命上限',failure:'远征结束',end:'波末生命',
 'bell-summon':'鸣钟召唤援军','bell-blocked':'本次援军未加入','bell-kill':'援军已击退','bell-breach':'援军突破记录','bell-timeout':'援军超时记录'}
export function lifeEventRows(combat){
 if(combat?.lifeVersion!==1)return null
 return (combat.lifeEvents || []).filter(event=>combat.wave===undefined || event.wave===combat.wave).map((event,index)=>{
  const source=event.source==='reward'?(WAVE_REWARD_BY_ID[event.sourceId]?.name || '波后补给'):names[event.source] || JOKER_BY_ID[event.sourceId]?.name || (event.source==='restore-base'?'生命恢复':event.source) || '未记录来源'
  const unit=HOSTILE[event.unitType]?.name || event.unitName || ''
  const bell=event.kind?.startsWith('bell-')
  const change=event.kind==='max'?'上限 '+event.maxBefore+' → '+event.maxAfter:
   event.kind==='end'?'生命 '+event.after+' / '+event.maxAfter:bell?'追溯事件，不另计生命':
    event.failed?'生命 '+event.before+' → '+event.after+' · 远征结束':
     '生命 '+event.before+' → '+event.after+(event.kind==='heal'?' · 实际恢复 '+event.amount:event.kind==='loss'?' · 实际损失 '+event.amount:'')
  return {...event,reason:event.reason==='enemy-capacity'?'敌军在场数量已达上限，本次未加入援军。':event.reason,key:event.id || 'life-row-'+index,label:kinds[event.kind] || '生命记录',sourceLabel:source,unitLabel:unit,change,
   warning:event.after===0 && !event.failed && !bell && ['loss','end'].includes(event.kind)?'不能再放入任何敌人':''}
 })
}
