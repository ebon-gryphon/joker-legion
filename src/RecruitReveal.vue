<script setup>
import {computed} from 'vue'
import {recruitmentView,presentationNumber} from './presentationViews.js'
import HighTierReveal from './HighTierReveal.vue'
const props=defineProps({receipt:{type:Object,default:null},revealed:{type:Boolean,default:true},qualityVisible:{type:Boolean,default:true},
  actualUnit:{type:Object,default:null},enabled:{type:Boolean,default:true},speed:{type:Number,default:1},
  compact:Boolean,kind:{type:String,default:'recruit'},reducedMotion:Boolean})
const view=computed(()=>recruitmentView(props.receipt,{revealed:props.revealed,qualityVisible:props.qualityVisible,kind:props.kind}))
const actual=computed(()=>props.actualUnit || props.receipt?.recruitment?.actualUnit || props.receipt?.actualUnit || null)
const modelReveal=computed(()=>view.value?.revealed && view.value.grade>=5 && actual.value?.id===view.value.unitId && actual.value.grade===view.value.grade)
</script>
<template>
  <section v-if="view" class="recruit-reveal" :class="{compact,concealed:!view.revealed,legendary:view.revealed && view.grade>=4 && !modelReveal,'model-reveal':modelReveal,'motion-off':reducedMotion || !enabled}" :style="{'--recruit-ink':view.tone}" :data-recruit-destination="view.revealed?view.status:undefined" :data-recruit-grade="view.revealed?view.grade:undefined" aria-label="实际征募结果">
    <HighTierReveal v-if="modelReveal" :receipt="receipt" :actual-unit="actual" :kind="kind" :compact="compact" :enabled="enabled" :speed="speed" :reduced-motion="reducedMotion" :controls="false"/>
    <template v-else-if="view.revealed">
      <header><span class="recruit-seal" aria-hidden="true">{{ view.suit || '♛' }}<small>{{ view.rank || (view.fusion?'合编':'') }}</small></span><div><small class="recruit-reveal-stage">{{ view.headline }}</small><strong>{{ view.name }}</strong><span>{{ view.quality }}<template v-if="view.profession"> · {{ view.profession }}</template><template v-if="view.level"> · {{ '★'.repeat(view.level) }}</template></span></div></header>
      <p v-if="view.status==='training'" class="recruit-training"><template v-if="view.recipient">{{ view.recipient.name }} 实际获得 {{ view.xpGain ?? '未记录的' }} 经验</template><template v-else>集训接收者未记录</template><small>本手没有新增士兵。</small></p>
      <p v-if="view.statBonus!==null" class="recruit-stat-bonus">{{ view.fusion?'原征召属性':view.status==='training'?'转训前征募属性':'计分牌征召属性' }} ＋{{ view.statBonus }}%<small v-if="view.statBonusSource && !compact">{{ view.statBonusSource }}</small></p>
      <p v-if="view.reason" class="recruit-destination">{{ view.reason }}</p>
      <p v-if="view.status==='reserve'" class="recruit-no-slot">该成员在候补席，尚未占用战场兵位。</p>
      <div v-if="view.fusion && view.rows.length" class="recruit-actual-stats"><span v-for="row in view.rows" :key="row.stat">{{ row.label }} <template v-if="row.before!==null">{{ presentationNumber(row.before,row.stat) }} → </template><b>{{ presentationNumber(row.after,row.stat) }}{{ row.stat==='period'?'秒':'' }}</b></span></div>
      <div v-if="view.gains.length" class="recruit-actual-stats"><span v-for="gain in view.gains" :key="gain.label">{{ gain.label }} <b>{{ gain.value }}</b></span></div>
    </template>
    <span v-else class="recruit-placeholder">征募结果将在揭晓后显示</span>
  </section>
</template>
<style scoped>
.recruit-reveal{min-width:0;border:1px solid var(--recruit-ink);border-left:3px solid var(--recruit-ink);padding:9px 11px;background:linear-gradient(120deg,#302635,#211d2b);color:#e9dcc8;font-size:12px;line-height:1.5}.recruit-reveal header{display:flex;gap:9px;align-items:center}.recruit-seal{display:grid;place-items:center;width:38px;min-height:43px;border:1px solid var(--recruit-ink);color:var(--recruit-ink);background:#191924;font:700 24px/1 Georgia,serif;flex:none}.recruit-seal small{font-size:10px}.recruit-reveal header>div{min-width:0;display:grid}.recruit-reveal strong{font:700 19px/1.25 var(--serif);overflow-wrap:anywhere}.recruit-reveal header span:not(.recruit-seal){color:var(--recruit-ink);font-size:11px}.recruit-reveal-stage{color:#c3b2c4;font-size:10px}.recruit-reveal p{margin:5px 0}.recruit-stat-bonus{color:#d5c5a4}.recruit-stat-bonus>small,.recruit-training>small{display:block;color:#ad9db4;font-size:10px}.recruit-destination,.recruit-no-slot{font-size:11px}.recruit-no-slot{color:#e4bf83}.recruit-training{color:#c8dcba}.recruit-actual-stats{display:flex;flex-wrap:wrap;gap:3px 11px;font-size:11px;color:#b9a8be}.recruit-actual-stats b{color:#ead2a8}.recruit-placeholder{font-size:11px;color:#a997b2}.recruit-reveal.compact{padding:6px 8px;font-size:11px}.recruit-reveal.compact strong{font-size:16px}.recruit-reveal.compact .recruit-seal{width:30px;min-height:35px;font-size:20px}.recruit-reveal.compact .recruit-stat-bonus>small{max-height:44px;overflow:auto}.recruit-reveal.concealed{border-color:#6f5a64;border-left-color:#6f5a64;min-height:35px;display:flex;align-items:center}
.recruit-reveal.model-reveal{padding:0;border:0;background:none}
@media(prefers-reduced-motion:no-preference){.recruit-reveal.legendary:not(.motion-off){animation:recruit-fact-arrive .24s ease-out}@keyframes recruit-fact-arrive{from{box-shadow:inset 0 0 0 1px var(--recruit-ink);transform:translateY(2px)}to{box-shadow:inset 0 0 0 0 transparent;transform:none}}}
</style>
