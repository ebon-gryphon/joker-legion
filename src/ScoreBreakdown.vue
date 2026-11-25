<script setup>
import {computed,ref} from 'vue'
import {QUALITIES} from './quality.js'
import {actualEffectText} from './reportTelemetry.js'
const props=defineProps({trace:{type:Object,default:null},expanded:{type:Boolean,default:false},detailsOnly:{type:Boolean,default:false}})
const details=ref(props.expanded)
const points=computed(()=>props.trace?.scoringCards.reduce((n,card)=>n+card.points,0) || 0)
const extra=computed(()=>props.trace?.chipBonuses.reduce((n,item)=>n+item.delta,0) || 0)
const active=computed(()=>props.trace?.chipBonuses.filter(item=>item.applied).length || 0)
const outcome=computed(()=>props.trace?.recruit)
const quality=computed(()=>QUALITIES[props.trace?.quality.floor ?? 0])
const odds=computed(()=>props.trace?.quality.odds.filter(row=>row.grade!==props.trace.quality.floor) || [])
const nonChipItems=computed(()=>props.trace?.items.filter(item=>item.phase!=='chips' && item.quantity>0) || [])
const absentDemoItems=computed(()=>props.trace?.items.filter(item=>!item.quantity) || [])
const finalBonus=computed(()=>Number.isFinite(props.trace?.finalBonus?.amount) && props.trace.finalBonus.amount>0?props.trace.finalBonus:null)
const finalSources=computed(()=>finalBonus.value?.sources || [])
const passives=computed(()=>props.trace?.passives || [])
const displayNumber=n=>Number.isInteger(n)?n:Number(n.toFixed(1))
function effects(item){
  if(!item.actual)return null
  const rows=[['chips','筹码'],['shield','护盾'],['healed','友军有效治疗'],['lifeHealed','生命恢复'],['gateRepaired','旧制修复'],['starGain','升星'],['damage','实际伤害'],['chargeGain','圣杯蓄能'],['xpGain','集训经验'],['shieldDamage','护盾伤害'],['targets','命中目标']]
  return rows.filter(([key])=>Number.isFinite(item.actual.effects?.[key])).map(([key,label])=>label+' '+displayNumber(item.actual.effects[key])).join(' · ')
}
</script>
<template>
  <section v-if="trace" class="hand-score-panel" aria-label="本手计分与实际收益" :style="{'--quality-ink':quality.color}" :data-hand="trace.hand.key">
    <p v-if="trace.legacyLife" class="score-legacy-life">旧制生命记录，不按新规则重复触发。</p>
    <template v-if="!detailsOnly">
    <header class="score-heading"><strong>{{ trace.hand.name }} <small>Lv.{{ trace.hand.level }}</small></strong>
      <button type="button" class="score-detail-toggle key-link" :aria-expanded="details" @click="details=!details">{{ details?'收起明细':'计分明细' }} <span aria-hidden="true">{{ details?'⌃':'⌄' }}</span></button></header>
    <div class="score-equation" aria-label="最终分计算公式">
      <span class="score-chips"><b>{{ trace.chipsBeforeMult }}</b><small>筹码</small></span><i aria-hidden="true">×</i>
      <span class="score-mult"><b>{{ trace.mult }}</b><small>牌谱倍率</small></span><template v-if="finalBonus"><i aria-hidden="true">＋</i><span class="score-final-bonus"><b>{{ finalBonus.amount }}</b><small>奖励分</small></span></template><i aria-hidden="true">=</i>
      <span class="score-total"><b>{{ trace.finalScore }}</b><small>分</small></span>
    </div>
    <p v-if="details" class="score-source-summary">基础 {{ trace.hand.baseChips }}<template v-if="trace.hand.levelChips"> ＋研习 {{ trace.hand.levelChips }}</template> ＋牌点 {{ points }}<template v-if="extra"> ＋道具 {{ extra }}</template>；全部筹码合计后乘倍率。<template v-if="finalBonus">{{ finalBonus.source }}另加 {{ displayNumber(finalBonus.percent*100) }}%（{{ finalBonus.amount }} 分）。</template></p>
    <p v-if="details && passives.length" class="score-build-summary">本手持有 {{ passives.length }} 项构筑被动，可展开查看条件与实际触发。</p>
    <div class="score-quality"><b>{{ quality.name }}保底</b><span v-if="trace.mode==='resolved' && trace.quality.rolled!==undefined">本手 {{ trace.quality.rolledName }}</span><span v-else-if="odds.length && !details">有机会升格</span><span v-else-if="odds.length">升格机会：{{ odds.map(row=>row.name+' '+row.chance+'%').join(' · ') }}</span><span v-else>品质已确定</span></div>
    <p class="score-realized" :class="{overflow:outcome.overflow}" data-score-outcome>{{ outcome.summary }}</p>
    <p v-if="outcome.legendaryAlternative" class="score-conditional">{{ outcome.legendaryAlternative }}</p>
    <p class="score-order-effect">{{ trace.order.label }}<small v-if="trace.order.crownMultiplier>1"> · 已含同花王冠 25% 强化</small></p>
    </template>
    <div v-if="details || detailsOnly" class="score-details">
      <h4>按顺序计分</h4>
      <div class="score-ledger-row"><span>牌型基础筹码</span><b>＋{{ trace.hand.baseChips }}</b></div>
      <div v-if="trace.hand.levelChips" class="score-ledger-row"><span>牌谱研习 · Lv.{{ trace.hand.level }}</span><b>＋{{ trace.hand.levelChips }}</b></div>
      <div class="score-cards" aria-label="参与计分的牌"><span v-for="card in trace.scoringCards" :key="card.id" :class="{red:['♥','♦'].includes(card.suit)}">{{ card.suit }}{{ card.rank }} <b>＋{{ card.points }}</b></span></div>
      <p v-if="trace.nonScoringCards.length" class="score-miss">未计分：{{ trace.nonScoringCards.map(card=>card.suit+card.rank).join('、') }}。不属于本手最高牌型，不贡献牌点或按计分牌触发的道具。</p>
      <div v-for="item in trace.chipBonuses" :key="item.id" class="score-item-row" :class="{inactive:!item.applied}" :data-score-item="item.id">
        <div><strong>{{ item.label }}<small>×{{ item.quantity }}</small></strong><b>{{ item.applied?'＋'+item.delta+' 筹码':'未触发' }}</b></div>
        <p v-if="item.applied">{{ item.condition }}；{{ item.usedQuantity }} 层 × {{ item.units }} 个计分单位 × {{ item.perLayer }} 筹码；累计 {{ item.runningChips }} 筹码。</p><p>{{ item.reason }}</p>
      </div>
      <p v-if="!trace.chipBonuses.length" class="score-miss">本手没有计分道具加成。</p>
      <div class="score-ledger-row score-mult-ledger"><span>牌谱倍率 <small>基础 {{ trace.hand.baseMult }}<template v-if="trace.hand.levelMult"> ＋研习 {{ trace.hand.levelMult }}</template></small></span><b>×{{ trace.mult }}</b></div>
      <div v-if="finalBonus" class="score-ledger-row score-final-bonus" data-score-final-bonus><span>{{ finalBonus.source }}<small v-if="finalSources.length">{{ finalSources.map(row=>row.label+' '+displayNumber(row.percent*100)+'%').join(' ＋ ') }}</small><small>计分后额外合计 {{ displayNumber(finalBonus.percent*100) }}%，合并后统一取整，独立于牌谱倍率</small></span><b>＋{{ finalBonus.amount }} 分</b></div>
      <p class="score-final-ledger">{{ trace.chipsBeforeMult }} 筹码 × {{ trace.mult }} 倍率<template v-if="finalBonus"> ＋ {{ finalBonus.amount }} 奖励分</template> ＝ <b>{{ trace.finalScore }} 分</b></p>
      <p v-if="trace.recruit.statBonusSource" class="score-stat-source">{{ trace.recruit.statBonusSource }}</p>
      <p class="score-order-source">这 {{ trace.order.sourceScore }} 分也决定本手战令强度：{{ trace.order.label }}。</p>
      <template v-if="passives.length"><h4>构筑被动</h4><div v-for="row in passives" :key="row.id" class="score-item-row score-passive-row" :class="{inactive:!(row.actual?.triggered ?? row.applied)}" :data-score-passive="row.id"><div><strong>{{ row.label }}</strong><b>{{ row.actual?(row.actual.triggered?(row.actual.effective?'实际生效':'触发无收益'):'未触发'):(row.applied?'符合条件':'条件未满足') }}</b></div><p>{{ row.actual?.reason || row.reason }}</p><p v-if="row.actual" class="score-actual-effects">{{ actualEffectText(row.actual.effects) }}</p></div></template>
      <template v-if="nonChipItems.length"><h4>搭档连锁</h4>
        <div v-for="item in nonChipItems" :key="item.id" class="score-item-row non-score-item" :class="{inactive:!item.applied}" :data-score-item="item.id">
          <div><strong>{{ item.label }}</strong><b>{{ item.actual ? (item.actual.triggered?'已触发':'未触发') : item.applied?'符合条件':'待满足条件' }}</b></div>
          <p>{{ item.condition }}</p><p>{{ item.actual?.reason || item.reason }}</p><p v-if="effects(item)" class="score-actual-effects">{{ effects(item) }}</p>
        </div>
      </template>
      <details v-if="absentDemoItems.length" class="score-unowned"><summary class="key-disclosure">未持有的搭档 {{ absentDemoItems.length }} 件</summary><p v-for="item in absentDemoItems" :key="item.id">{{ item.label }} · {{ item.reason }}</p></details>
    </div>
    <small v-if="trace.chipBonuses.length && !details && !detailsOnly" class="score-items-hint">{{ active }} 件计分道具生效<template v-if="trace.chipBonuses.length>active"> · {{ trace.chipBonuses.length-active }} 件未触发</template>，可展开查看每项原因。</small>
  </section>
</template>
<style scoped>
.hand-score-panel{padding:7px 9px;border:1px solid #795d66;background:linear-gradient(115deg,#322332,#211b29);color:#eadfc9;font:12px/1.45 system-ui,sans-serif;font-variant-numeric:tabular-nums}
.score-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.score-heading>strong{font:700 16px/1.3 var(--serif);color:#f5d69f}.score-heading small{font:600 11px sans-serif;color:#bbaac2}.score-detail-toggle{border:0;background:none;color:#d6c0a6;font:inherit;cursor:pointer;padding:3px 0;white-space:nowrap;min-height:28px}
.score-equation{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:3px 0}.score-equation>span{display:flex;align-items:baseline;gap:4px}.score-equation b{font:bold 25px/1.15 Georgia,serif}.score-equation small{font-size:10px}.score-equation i{font-style:normal;color:#b5a0b5;font-size:19px}.score-chips{color:#acdff2}.score-mult{color:#ef9b9d}.score-total{color:#ffe1a2}.score-total b{font-size:29px}
.score-source-summary{font-size:11px;color:#cbbdca;margin:3px 0}.score-quality{display:flex;gap:4px 8px;align-items:baseline;flex-wrap:wrap;margin-top:5px}.score-quality>b{color:var(--quality-ink)}.score-quality>span{font-size:11px;color:#c7b6c8}.score-realized{color:#f5dfb6;font-weight:650;margin:4px 0}.score-realized.overflow{color:#f5ce91}.score-conditional{color:#c9b9c6;font-size:11px;margin:3px 0}.score-order-effect{font-size:11px;color:#b7d4bd;margin:3px 0}.score-order-effect small{font-size:inherit}.score-items-hint{display:block;margin-top:3px;color:#b7a6b8;font-size:10px}
.score-details{border-top:1px solid #68505f;margin-top:8px;padding-top:5px}.score-details h4{font-size:12px;color:#f0d3a6;margin:8px 0 4px}.score-ledger-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:4px 0}.score-ledger-row b{color:#acdff2}.score-ledger-row small{display:block;color:#baa7bd;font-size:10px}.score-cards{display:flex;flex-wrap:wrap;gap:4px;margin:5px 0}.score-cards>span{background:#e8d7b6;color:#332a3c;padding:2px 5px;border-radius:2px;white-space:nowrap}.score-cards>span.red{color:#973b4b}.score-cards b{margin-left:3px;font-weight:750}.score-miss{font-size:11px;color:#b5a3b8;margin:4px 0}
.score-item-row{padding:6px 0;border-bottom:1px solid #4c3c50}.score-item-row>div{display:flex;gap:8px;justify-content:space-between;align-items:baseline}.score-item-row strong{color:#ecd4ac}.score-item-row strong small{color:#ad9bb2;margin-left:4px;font:10px sans-serif}.score-item-row b{color:#a7d5e4;font-size:11px;white-space:nowrap}.score-item-row p{font-size:11px;margin:2px 0;color:#c8b8c9}.score-item-row.inactive strong,.score-item-row.inactive b{color:#aa9bac}.score-mult-ledger b{color:#ef9b9d}.score-final-ledger{margin:6px 0;color:#efdbb9}.score-final-ledger b{color:#ffe1a2}.score-order-source{font-size:11px;color:#b7d4bd}.score-stat-source{font-size:11px;line-height:1.5;color:#d8c5ae}.score-unowned{font-size:11px;color:#a99aad;margin-top:8px}.score-unowned summary{cursor:pointer}.score-unowned p{margin:3px 0}.score-actual-effects{color:#e5d293!important}
@media(max-width:500px){.hand-score-panel{padding:5px 7px;font-size:11px}.score-equation{gap:6px}.score-equation b{font-size:22px}.score-total b{font-size:25px}.score-equation small{font-size:9px}.score-source-summary{font-size:10px}.score-heading>strong{font-size:15px}}
</style>
