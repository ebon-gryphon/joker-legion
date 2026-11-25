<script setup>
import {behaviorLabels} from './enemyBehavior.js'
import {HOSTILE} from './tactics.js'
import { computed,ref,watch } from 'vue'
import KeyMark from './KeyMark.vue'
import EconomySummary from './EconomySummary.vue'
import LifeReport from './LifeReport.vue'
import {BUILD_PASSIVE_BY_ID} from './buildPassives.js'
import { FUSION_BY_ID } from './forge.js'
import { REGIMENTS } from './orders.js'
import { FORMATION_BY_ID } from './tactics.js'
import { itemEventGroups, actualEffectText, gateSourceRows, runOutcomeText } from './reportTelemetry.js'
import { deriveReportHighlights } from './presentationFacts.js'
const props=defineProps({ expanded:Boolean, combat:{type:Object,default:null}, report:{type:Array,default:()=>[]}, uses:{type:Object,default:()=>({})}, tactics:{type:Object,default:()=>({})}, formation:{type:String,default:''}, liveEvents:{type:Array,default:()=>[]}, finalSettlement:{type:String,default:''} })
const eventLimit=ref(24)
const eventsOpen=ref(false)
watch(()=>props.combat?.waveId,()=>{eventLimit.value=24})
const recentEnemyEvents=computed(()=>eventsOpen.value ? (props.combat?.enemyEvents || []).slice(-eventLimit.value).reverse() : [])
const people=computed(()=>props.combat?.units.filter(row=>row.participated || row.damage || row.healed || row.taken || row.kills) || [])
const rounded=n=>Math.round(n || 0)
const regiment=type=>REGIMENTS[type]?.name || type
const itemGroups=computed(()=>itemEventGroups(props.combat))
const itemEventCount=computed(()=>itemGroups.value.reduce((count,group)=>count+group.events.length,0))
const gateSources=computed(()=>gateSourceRows(props.combat?.legacyGate?{gate:props.combat.legacyGate}:props.combat))
const outcomeText=computed(()=>runOutcomeText(props.combat))
const modernLife=computed(()=>props.combat?.lifeVersion===1)
const noFinalIncome=computed(()=>modernLife.value && props.combat?.runOutcome?.status==='victory')
const highlights=computed(()=>deriveReportHighlights(props.combat,{liveEvents:props.liveEvents}))
const shownFormation=computed(()=>props.combat ? FORMATION_BY_ID[props.combat.formation]?.name || '阵型未记录' : props.formation)
const shownTactics=computed(()=>props.combat ? props.combat.tacticsReport || {} : props.tactics)
const shownUses=computed(()=>props.combat ? props.combat.fusionUses || {} : props.uses)
const legacyReport=computed(()=>props.combat ? Object.entries(props.combat.regimentReport || {}).map(([type,row])=>({type,label:regiment(type),damage:rounded(row.damage),healed:rounded(row.healed)})) : props.report)
const gateView=computed(()=> {
  const gate=props.combat?.legacyGate || (props.combat?.lifeVersion!==1?props.combat?.gate:null)
  if(!gate) return null
  const battle=gate.battleStart!==null
  return {start:battle?gate.battleStart:gate.start,end:gate.end,battle,
    netLoss:(battle?gate.battleStart:gate.start)-gate.end,
    partitioned:battle && gate.battleDamage!==undefined && gate.battleRepaired!==undefined,
    damage:battle?gate.battleDamage:gate.preparationDamage,repaired:battle?gate.battleRepaired:gate.preparationRepaired}
})
</script>

<template>
  <details :open="expanded" v-if="expanded || combat || report.length || Object.keys(shownUses).length || shownTactics.tolls || shownTactics.interrupts" class="field-report">
    <summary class="key-disclosure"><KeyMark name="order"/>本波战报 · {{ combat?'士兵贡献':'各兵种贡献' }}</summary>
    <template v-if="combat">
      <p v-if="combat.openingBenefits?.length">开局传承 · {{ combat.openingBenefits.join(' ／ ') }}</p>
      <p class="report-overview"><b>{{ combat.result==='lost'?'远征失守':combat.ended?'本波守住':'本波记录' }}</b><span>{{ combat.battleDuration===undefined?'已记录交战':'交战总时长' }} {{ (combat.battleDuration ?? combat.duration).toFixed(1) }} 秒<template v-if="combat.battleDuration===undefined">（旧口径）</template></span><span v-if="combat.enemyForce">编成 {{ combat.enemyForce.regular }} · 鸣钟召来 {{ combat.enemyForce.summoned }} · 分裂幼兽 {{ combat.enemyForce.brood }} · 实际出场 {{ combat.enemyForce.total }}</span><span>剩余军令 {{ rounded(combat.energyLeft) }}</span></p>
      <LifeReport v-if="modernLife" :combat="combat"/>
      <template v-else-if="combat.postWaveLife"><p class="report-caveat">读档后波后生命 · 以下为新规则下的真实补给变化。</p><LifeReport :combat="combat.postWaveLife"/></template>
      <p v-if="gateView" class="report-gate"><b>旧制防线记录（不换算、不重复计入红心生命）</b><span>旧制数值 {{ rounded(gateView.start) }} → {{ rounded(gateView.end) }}</span><span v-if="gateView.partitioned">旧制损失 {{ rounded(gateView.damage) }} · 旧制恢复 {{ rounded(gateView.repaired) }}</span><span v-if="!gateView.partitioned">旧制整波损失 {{ rounded((combat.legacyGate || combat.gate).damage) }} · 恢复 {{ rounded((combat.legacyGate || combat.gate).repaired) }}（含备战）</span></p>
      <p v-if="combat.partial" class="report-caveat">其中记录了 {{ combat.duration.toFixed(1) }} 秒的贡献，早先数据没有分配给个人。</p>
      <p v-if="!modernLife && Math.abs(combat.gate?.untracked || 0)>.01" class="report-caveat">旧制另有 {{ rounded(Math.abs(combat.gate.untracked)) }} 点未分类变化，不计入新生命事件。</p>
      <p v-if="outcomeText" class="report-run-outcome">{{ outcomeText }}</p>
      <EconomySummary v-if="combat.ended" :settlement="noFinalIncome?null:combat.economy" :empty-text="noFinalIncome?'终幕直接胜利，不再发放波后收入。':combat.result==='lost'?'本波未守住，没有波后结算收入。':undefined"/>
      <details v-if="highlights.length" class="report-payoffs"><summary class="key-disclosure">关键兑现 · 只读实际记录</summary>
        <p v-for="item in highlights" :key="item.id"><strong>{{ item.label }}</strong><span>{{ item.detail }}</span></p>
        <small>只作归纳，不另加分、不重复计伤害，也不把战团总收益归给单独一手。</small>
      </details>
      <details v-if="gateView" class="report-gate-sources"><summary class="key-disclosure">旧制损失来源</summary><p v-if="gateSources===null" class="report-caveat">这份旧记录没有保存来源分类。</p><p v-else-if="!gateSources.length">旧制没有已记录的损失。</p><p v-for="source in gateSources || []" :key="source.id">{{ source.label }} <b>{{ rounded(source.amount) }}</b></p><small>仅回看旧制事实，不再扣除或恢复当前红心生命。</small></details>
      <details v-if="combat.passiveEvents?.length" class="report-passive-events"><summary class="key-disclosure">构筑被动实际触发 · {{ combat.passiveEvents.length }} 条</summary><ol><li v-for="(event,index) in combat.passiveEvents" :key="event.eventId || index" :data-passive-event="event.id"><strong>{{ Number(event.at || 0).toFixed(1) }} 秒 · {{ BUILD_PASSIVE_BY_ID[event.id]?.name || event.id }} · {{ event.triggered?(event.effective?'已生效':'触发但无收益'):'未触发' }}</strong><p>{{ event.reason }}</p><small>{{ actualEffectText(event.effects) }}</small></li></ol><small>读取原触发记录；最终分与战令的合计结果不重复相加。</small></details>
      <details v-if="combat.enemyEvents?.length" class="enemy-event-report" @toggle="eventsOpen=$event.currentTarget.open"><summary class="key-disclosure">敌军行为 · {{ combat.enemyEvents.length }} 条</summary><p v-for="(e,i) in recentEnemyEvents" :key="i">{{ e.at.toFixed(1) }}秒 · {{ HOSTILE[e.type]?.name }} {{ e.actor }} · {{ behaviorLabels[e.kind] }} {{ e.name || e.target || '' }} {{ e.children?.join('、') }} {{ e.amount==null?'':Number(e.amount.toFixed(1)) }}<template v-if="e.kind==='strike'"> · 护盾吸收 {{ Number(e.absorbed.toFixed(1)) }}{{ e.killed?' · 击倒':'' }}</template></p><button v-if="eventsOpen && eventLimit<combat.enemyEvents.length" class="key-link" @click="eventLimit+=48">查看更早的记录</button></details>
      <table class="personal-report">
        <caption>个人贡献 · 伤害与承伤按生命损失计，治疗不计溢出</caption>
        <thead><tr><th scope="col">士兵</th><th scope="col">伤害</th><th scope="col">治疗</th><th scope="col">承伤</th><th scope="col">击杀</th></tr></thead>
        <tbody><tr v-for="row in people" :key="row.unitId">
          <th scope="row"><strong>{{ row.name }}</strong><em v-if="row.echo">镜像</em><small>{{ row.qualityLabel }} · {{ row.jobLabel }}</small><small v-if="row.deaths">本波倒下 · 波末归队</small></th>
          <td>{{ rounded(row.damage) }}</td><td>{{ rounded(row.healed) }}</td><td>{{ rounded(row.taken) }}<small v-if="row.absorbed">盾吸收 {{ rounded(row.absorbed) }}</small></td><td>{{ row.kills }}</td>
        </tr></tbody>
        <tfoot><tr><th scope="row">合计</th><td>{{ rounded(combat.totals.damage) }}</td><td>{{ rounded(combat.totals.healed) }}</td><td>{{ rounded(combat.totals.taken) }}</td><td>{{ combat.totals.kills }}</td></tr></tfoot>
      </table>
      <p v-if="!people.length" class="report-caveat">尚无个人战斗记录。</p>
      <div v-if="combat.systems.length" class="system-report"><strong>道具与其他来源</strong><p v-for="row in combat.systems" :key="row.id">{{ row.name }}<span>伤害 {{ rounded(row.damage) }} · 治疗 {{ rounded(row.healed) }} · 击杀 {{ row.kills }}</span></p><small>这些贡献已计入合计，单独保留来源。</small></div>
      <div v-if="combat.majorOrders.length" class="order-report"><strong>主要战令</strong><p v-for="order in combat.majorOrders" :key="order.key+'/'+order.target+'/'+order.secondary">{{ order.name }} → {{ regiment(order.target) }}<template v-if="order.secondary"> / {{ regiment(order.secondary) }}</template><span>×{{ order.count }} · 消耗 {{ order.cost }} 军令</span></p><small>含战前出牌；免费加购的出牌按实际军令消耗计。</small></div>
      <details class="report-item-events"><summary class="key-disclosure">本波计分与搭档事件 <small v-if="itemGroups.length">· {{ itemEventCount }} 条</small></summary><p v-if="!combat.itemEvents" class="report-caveat">这份旧记录没有保存道具事件。</p><p v-else-if="!itemGroups.length">本波尚无道具事件记录。</p><div v-for="group in itemGroups" :key="group.id" class="report-item-group" :data-item-history="group.id"><strong>{{ group.name }}</strong><span>触发 {{ group.triggers }} 次 · 产生收益 {{ group.effective }} 次</span><p>{{ actualEffectText(group.effects) }}</p><details class="report-item-timeline"><summary class="key-disclosure">查看 {{ group.events.length }} 条条件与实际结果</summary><ol><li v-for="event in group.events" :key="event.index"><b>{{ event.phase==='ready'?(event.orderOrdinal===null?'战前':'本局第 '+event.orderOrdinal+' 手（战前）'):event.at.toFixed(1)+' 秒' }} · {{ event.triggered?(event.effective?'生效':'触发但无收益'):'未触发' }}</b><p>{{ event.reason }}</p><small>{{ actualEffectText(event.effects) }}</small></li></ol></details></div><small v-if="itemGroups.length">这里的伤害与治疗已包含在上方贡献统计中。</small></details>
    </template>
    <p class="report-skills"><strong>{{ shownFormation }}</strong><span v-if="shownTactics.prevented">减免 {{ Math.round(shownTactics.prevented) }} 伤害</span><span v-if="shownTactics.extraDamage">集火追加 {{ Math.round(shownTactics.extraDamage) }} 伤害</span><span v-if="shownTactics.interrupts">战令止钟 {{ shownTactics.interrupts }} 次</span><span v-if="shownTactics.tolls">{{ modernLife?'鸣钟召唤记录':'旧制钟击记录' }} {{ shownTactics.tolls }} 次<template v-if="!modernLife"> · 旧制损失 {{ shownTactics.gateDamage }}</template></span></p>
    <table v-if="!combat">
      <thead><tr><th>兵种</th><th>直接伤害</th><th>有效治疗</th></tr></thead>
      <tbody><tr v-for="row in legacyReport" :key="row.type"><th>{{ row.label }}</th><td>{{ row.damage }}</td><td>{{ row.healed }}</td></tr></tbody>
    </table>
    <details v-else-if="combat.partial && legacyReport.length" class="legacy-report"><summary class="key-disclosure">旧记录的兵种汇总</summary><table><thead><tr><th>兵种</th><th>直接伤害</th><th>有效治疗</th></tr></thead><tbody><tr v-for="row in legacyReport" :key="row.type"><th>{{ row.label }}</th><td>{{ row.damage }}</td><td>{{ row.healed }}</td></tr></tbody></table></details>
    <div v-if="Object.keys(shownUses).length" class="report-skills"><strong>融合战技</strong><span v-for="(count, id) in shownUses" :key="id">{{ FUSION_BY_ID[id]?.skill || id }} × {{ count }}</span></div>
  </details>
</template>

<style scoped>
.report-overview{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:12px}
.report-gate{font-size:12px;line-height:1.7}.report-gate span{display:block;color:#b1adbd}
.report-caveat{font-size:11px;line-height:1.6;color:#d8bd8f}
.personal-report{width:100%;table-layout:fixed}.personal-report caption{text-align:left;font-size:10px;line-height:1.6;color:#aaa6b7;padding-bottom:7px}.personal-report th:first-child{width:36%}.personal-report th,.personal-report td{padding:8px 4px;font-size:11px;text-align:right;vertical-align:top}.personal-report th:first-child{text-align:left}.personal-report th strong{display:block;font-size:12px;overflow-wrap:anywhere}.personal-report small{display:block;font-size:9px;font-weight:normal;color:#b4aebf;line-height:1.5}.personal-report em{font-size:9px;color:#bba6e8;font-style:normal}.personal-report tfoot{border-top:1px solid #655a70}
.system-report,.order-report{margin:12px 0;padding-top:9px;border-top:1px solid #51465d;font-size:11px}.system-report p,.order-report p{margin:6px 0;line-height:1.6}.system-report span,.order-report span{display:block;color:#c5b7a3}.system-report>small,.order-report>small{color:#aaa6b6;line-height:1.6}.legacy-report{font-size:11px}
.report-gate-sources,.report-item-events{margin:9px 0;font-size:11px;line-height:1.6}.report-gate-sources>p{display:flex;gap:8px;justify-content:space-between;margin:4px 0}.report-gate-sources>small,.report-item-events>small{color:#aaa6b6}.report-run-outcome{font-size:11px;color:#e2c79c}.report-item-group{border-top:1px solid #51465d;padding:8px 0}.report-item-group>span{display:block;color:#bfb0c7}.report-item-group>p{color:#e2c79c;margin:3px 0}.report-item-timeline ol{padding-left:18px;margin:5px 0}.report-item-timeline li{margin:5px 0 9px;overflow-wrap:anywhere}.report-item-timeline p{margin:3px 0}.report-item-timeline small{color:#d9c6aa}
.report-payoffs{margin:10px 0;padding:8px 10px;border-left:2px solid #b69662;background:#302638;font-size:11px;line-height:1.6}.report-payoffs p{margin:7px 0}.report-payoffs strong,.report-payoffs span{display:block}.report-payoffs strong{color:#e5c18a}.report-payoffs span{color:#e7dccb}.report-payoffs>small{color:#baadc7}
</style>
