import { copies } from './gameState.js'
import { JOKER_BY_ID } from './campaignRules.js'
import { lifeItemPreview } from './playerLife.js'

export const DEMO_ITEM_IDS=['score-chalk','pair-ink','third-act','iron-banner','red-echo','heart-engine']
const countSuit=(cards,suits)=>cards.filter(card=>suits.includes(card.suit)).length
const hasPair=cards=>new Set(cards.map(card=>card.rank)).size<cards.length

// This is the same list used by scoreItemChips, not a second scoring formula.
export function scoreContributionRows(game,scoring,key,containsPair=hasPair(scoring)) {
  const rules=[
    {id:'score-chalk',units:1,perLayer:2,condition:'每手生效'},
    {id:'red-thread',units:countSuit(scoring,['♥','♦']),perLayer:1,condition:'每张计分红桃或方片'},
    {id:'black-wax',units:countSuit(scoring,['♠','♣']),perLayer:1,condition:'每张计分黑桃或梅花'},
    {id:'court-seal',units:scoring.filter(card=>['J','Q','K'].includes(card.rank)).length,perLayer:2,condition:'每张计分 J、Q、K'},
    {id:'straight-compass',units:Number(['straight','straightFlush'].includes(key)),perLayer:4,condition:'顺子或同花顺'},
    {id:'score-ticket',units:1,perLayer:10,condition:'成功出牌时自动使用一张',consumable:true},
    {id:'pair-ink',units:Number(containsPair),perLayer:3,condition:'最高牌型中含同点数组合'},
  ]
  return rules.filter(rule=>copies(game,rule.id)>0).map(rule=>{
    const quantity=copies(game,rule.id),usedQuantity=rule.consumable?Math.min(1,quantity):quantity
    const delta=usedQuantity*rule.units*rule.perLayer
    return {id:rule.id,label:JOKER_BY_ID[rule.id].name,quantity,usedQuantity,units:rule.units,perLayer:rule.perLayer,
      phase:'chips',consumable:!!rule.consumable,condition:rule.condition,eligible:rule.units>0,applied:delta>0,delta,
      reason:delta>0?rule.consumable?'本手只消耗一张，成功出牌后才扣除。':'符合条件，先加筹码再乘倍率。':rule.id==='pair-ink'?'本手最高牌型没有同点数组合。':rule.id==='straight-compass'?'本手不是顺子或同花顺。':'没有符合条件的计分牌；未计分的附带牌不触发。'}
  })
}

export function itemTrace(game,plan,{scoring=[]}={}) {
  const chipRows=scoreContributionRows(game,scoring,plan.key,plan.containsPair)
  const ordinal=(game.stats?.deploys || 0)+1
  const hearts=countSuit(scoring,['♥']),army=(game.allies || []).filter(unit=>unit.hp>0)
  const life=lifeItemPreview(game,{scoring,containsFlush:plan.containsFlush})
  return DEMO_ITEM_IDS.map(id=>{
    const quantity=copies(game,id),label=JOKER_BY_ID[id].name
    let row={id,label,quantity,phase:'afterOrder',eligible:false,applied:false,reason:'尚未持有这件道具。',condition:'',potential:{}}
    if (id==='score-chalk' || id==='pair-ink') {
      const chip=chipRows.find(item=>item.id===id)
      row={...row,phase:'chips',condition:id==='score-chalk'?'每手生效':'最高牌型含同点数组合',potential:{chips:chip?.delta || 0},...(chip || {})}
    } else if (id==='third-act') {
      const eligible=ordinal%3===0,star=plan.recruits?.[0]?.level || plan.reserve?.[0]?.level || 1
      const withoutEcho=Math.max(1,plan.returning?game.champion?.level || 1:1,plan.royalOrder?3:1)
      row={...row,phase:'muster',condition:'全局每第三次成功出牌',counter:{ordinal,period:3,until:eligible?0:3-ordinal%3},eligible,
        potential:{starGain:eligible?Math.max(0,star-withoutEcho):0},
        reason:!eligible?'这是本局第 '+ordinal+' 手，还未到第三手触发位。':plan.waiting?'本手领队将升星；若进入候补，星级也会保留。':!plan.actualUnits?'当前满编，升星带来的价值进入本手转训经验，不能当作新兵入阵。':star>=3?'已到三星上限，额外升星可能不再增加星级。':'本手领队升星，最高三星。'}
    } else if (id==='iron-banner') {
      const eligible=!!plan.containsPair,front=army.filter(unit=>unit.type==='knight')
      row={...row,condition:'最高牌型含同点数组合',eligible,potential:{shield:eligible&&(plan.actualUnits>0 || plan.trainingXp>0)?24:0,healed:eligible?front.length*18:0},
        reason:!eligible?'本手没有同点数组合，旗手不触发。':plan.waiting?'领队进入候补，没有阵上的领队护盾接收者；仍会尝试治疗在场铁卫。':!front.length?'领队或转训接收者可获盾；没有在场铁卫时，治疗没有目标。':front.every(unit=>unit.hp>=unit.maxHp)?'符合触发条件；在场铁卫满血时，有效治疗为 0。':'领队或转训接收者获盾，在场受伤铁卫实际恢复生命。'}
    } else if (id==='red-echo') {
      row={...row,condition:'每张计分红心治疗友军；每波首次至少两张计分红心恢复 1 点生命',eligible:hearts>0,
        potential:{healed:hearts*16,lifeHealed:life.redEchoLife.restored},life:life.redEchoLife,
        reason:!hearts?'没有红心参与计分；附带但未计分的红心不触发。':
          (army.every(unit=>unit.hp>=unit.maxHp)?'红心符合条件，但全员满血时有效治疗为 0。':'每张计分红心尝试治疗最虚弱友军；以实际缺血量为准。')+' '+life.redEchoLife.reason}
    } else if (id==='heart-engine') {
      const charge=game.healedCharge || 0
      row={...row,phase:'combat',condition:'累计每 70 点有效治疗，向所有在场敌人造成 15 点伤害',eligible:false,
        counter:{charge,threshold:70,remaining:Math.max(0,70-charge)},potential:{damagePerTarget:15},
        reason:'当前有效治疗蓄能 '+Number(charge.toFixed(1))+'/70。满血治疗不积累；实际伤害取决于触发时在场敌人与剩余生命。'}
    }
    if (!quantity) return {...row,eligible:false,applied:false,reason:'尚未持有这件道具。',actual:null}
    return {...row,applied:row.phase==='chips'?row.applied:row.eligible,actual:null}
  })
}
