<script setup>
import {computed} from 'vue'
import {lifeEventRows} from './lifeReportViews.js'
const props=defineProps({combat:{type:Object,default:null}})
const rows=computed(()=>lifeEventRows(props.combat))
</script>
<template>
 <section v-if="rows!==null" class="report-life" aria-label="本波逐次生命事件">
  <p class="report-life-overview"><b>♥ 生命 {{ combat.lifeStart ?? '未记录' }} → {{ combat.lifeEnd ?? '未记录' }}</b><span v-if="combat.lifeMaxEnd!==undefined">本波结束上限 {{ combat.lifeMaxEnd }}</span></p>
  <details class="report-life-events" :open="rows.some(row=>row.kind==='loss' || row.kind==='failure')"><summary class="key-disclosure">逐次生命与援军事件 · {{ rows.length }} 条</summary>
   <p v-if="!rows.length">本波尚无已记录的生命事件。</p>
   <ol><li v-for="row in rows" :key="row.key" :data-life-event="row.kind"><strong>{{ Number(row.at || 0).toFixed(1) }} 秒 · {{ row.label }}</strong><span>{{ row.change }}</span><small>{{ row.sourceLabel }}<template v-if="row.unitLabel"> · {{ row.unitLabel }}</template><template v-if="row.bellSourceId"> · 来自鸣钟援军</template></small><small v-if="row.reason">{{ row.reason }}</small><b v-if="row.warning" class="life-zero-warning">{{ row.warning }}</b></li></ol>
   <small>逐条展示真实生命变化。援军追溯记录不重复扣除生命，上限提升与实际恢复分别列出。</small>
  </details>
 </section>
</template>
<style scoped>
.report-life{border-block:1px solid #665264;padding:6px 0;margin:8px 0;font:11px/1.6 system-ui}.report-life-overview{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;color:#e6a4ad}.report-life-overview>span{font-size:10px;color:#bcaabb}.report-life-events{margin-top:4px}.report-life-events ol{list-style:none;margin:6px 0;padding:0}.report-life-events li{padding:5px 0;border-top:1px solid #4b3d52}.report-life-events li>strong,.report-life-events li>span,.report-life-events li>small{display:block}.report-life-events li>strong{font-size:11px;color:#dbc6aa}.report-life-events li>span{color:#e9bbc1}.report-life-events small{color:#b5a6bc;font-size:10px}.life-zero-warning{display:block;color:#f0a8ae;font-size:11px}
</style>
