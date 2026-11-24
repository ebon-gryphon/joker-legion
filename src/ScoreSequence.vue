<script setup>
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import ScoreBreakdown from './ScoreBreakdown.vue'
import RecruitReveal from './RecruitReveal.vue'
import OrderRecipients from './OrderRecipients.vue'
import {QUALITIES} from './quality.js'
import {advanceScorePlayback,replaceScorePlayback,sequenceStateAt} from './scoreSequence.js'
const props=defineProps({trace:{type:Object,default:null},receipt:{type:Object,default:null},speed:{type:Number,default:1},
  reducedMotion:{type:Boolean,default:false},enabled:{type:Boolean,default:true},cinematic:Boolean,presentationPaused:Boolean,
  consumedIds:{type:Array,default:()=>[]},changedCardIds:{type:Array,default:()=>[]}})
const emit=defineEmits(['complete','step','speed','pause'])
const playback=ref(null),previous=ref(null),localConsumed=ref([])
const activeTrace=computed(()=>props.trace || props.receipt?.scoreTrace || null)
const state=computed(()=>sequenceStateAt(playback.value?.sequence,playback.value?.elapsed))
const currentTrace=computed(()=>playback.value?.sequence.trace)
const grade=computed(()=>state.value?.qualityVisible?QUALITIES[state.value.revealedGrade]:null)
const changed=computed(()=>new Set([...props.changedCardIds,...(props.receipt?.changedCardIds || [])]))
const currentLabel=computed(()=>state.value?.focus==='multiplier'?'牌谱倍率 ×'+state.value.mult:
  state.value?.focus==='final-score'?'最终 '+currentTrace.value.finalScore+' 分':state.value?.step.label)
let frame=0,last=0,lastStep=''
function remember(id){if(id && !localConsumed.value.includes(id))localConsumed.value=[...localConsumed.value,id]}
function publishStep(){
  const current=state.value,sequence=playback.value?.sequence
  if(!current || !sequence)return
  const key=sequence.id+'/'+current.index+'/'+current.focus
  if(key===lastStep)return
  lastStep=key
  emit('step',{id:sequence.id,step:current.step,index:current.index,focus:current.focus,done:current.done,
    score:current.displayScore,revealedGrade:current.revealedGrade})
}
function commit(result,{publish=true}={}){
  const currentId=result.playback?.sequence.id
  for(const item of result.complete)if(item.id!==currentId){remember(item.id);emit('complete',item)}
  playback.value=result.playback
  if(publish)publishStep()
  for(const item of result.complete)if(item.id===currentId){remember(item.id);emit('complete',item)}
}
function stopFrame(){cancelAnimationFrame(frame);frame=0;last=0}
function finish(reason='skipped'){
  stopFrame();commit(advanceScorePlayback(playback.value,0,{skip:true,reason}))
}
function startFrame(){if(!frame && playback.value && !playback.value.done && props.enabled && !props.reducedMotion && !props.presentationPaused)frame=requestAnimationFrame(tick)}
function syncMotion(){
  if(!playback.value)return
  if(!props.enabled || props.reducedMotion){stopFrame();commit(advanceScorePlayback(playback.value,0,{enabled:props.enabled,reducedMotion:props.reducedMotion}));return}
  if(props.presentationPaused)stopFrame()
  else startFrame()
}
function tick(now){
  frame=0
  const dt=last?Math.max(0,now-last):0;last=now
  commit(advanceScorePlayback(playback.value,dt,{speed:props.speed,paused:props.presentationPaused,enabled:props.enabled,reducedMotion:props.reducedMotion}))
  if(playback.value?.done){last=0;return}
  startFrame()
}
watch(activeTrace,trace=>{
  const old=playback.value,result=replaceScorePlayback(old,trace,{cinematic:props.cinematic,consumedIds:[...localConsumed.value,...props.consumedIds]})
  if(result.playback===old)return
  stopFrame()
  if(old && old.sequence.id!==trace?.id)previous.value={id:old.sequence.id,total:old.sequence.trace.finalScore}
  if(!trace)previous.value=null
  lastStep='';commit(result)
  syncMotion()
},{immediate:true})
watch(()=>[props.enabled,props.reducedMotion,props.presentationPaused],syncMotion)
watch(()=>props.consumedIds.slice(),()=>{
  const result=replaceScorePlayback(playback.value,activeTrace.value,{cinematic:props.cinematic,consumedIds:[...localConsumed.value,...props.consumedIds]})
  if(result.playback!==playback.value){stopFrame();commit(result)}
})
onBeforeUnmount(()=>{stopFrame();commit(advanceScorePlayback(playback.value,0,{skip:true,reason:'disposed'}),{publish:false})})
defineExpose({finish,state,playback})
</script>
<template>
  <section v-if="currentTrace && state" class="score-sequence" :class="{done:state.done,enhanced:state.qualityVisible && playback.sequence.enhanced,'motion-off':reducedMotion || !enabled}" :style="{'--sequence-ink':grade?.color || '#b69b78'}" :data-score-sequence="currentTrace.id" :data-sequence-step="state.step.kind" :data-sequence-focus="state.focus" :data-presentation-focus="state.focus" :data-revealed-grade="state.qualityVisible?state.revealedGrade:undefined" :data-complete="state.done">
    <header class="sequence-heading"><strong>{{ currentTrace.hand.name }} <small>本手已结算</small></strong><span class="sequence-actions"><button v-if="!state.done" type="button" class="key-tab sequence-speed" :aria-label="'当前'+speed+'倍速，点击切换'" @click="emit('speed',speed===2?1:2)">{{ speed }}×</button><button v-if="!state.done" type="button" class="key-tab sequence-pause" :aria-pressed="presentationPaused" @click="emit('pause',!presentationPaused)">{{ presentationPaused?'继续演示':'暂停演示' }}</button><button v-if="!state.done" type="button" class="key-link sequence-skip" @click="finish()">立即显示</button><span v-else class="sequence-confirm">✓ 已兑现</span></span></header>
    <div class="sequence-selected" aria-label="选中牌依次确认">
      <span v-for="card in currentTrace.selectedCards" :key="card.id" class="sequence-mini-card" :class="{lit:state.litCardIds.includes(card.id),counted:state.countedCardIds.includes(card.id),unscored:!card.scoring,changed:changed.has(card.id),red:['♥','♦'].includes(card.suit)}" :data-sequence-card="card.id" :data-counted="state.countedCardIds.includes(card.id)">{{ card.suit }}{{ card.rank }}<small v-if="changed.has(card.id)">改印</small><small v-if="!card.scoring">不计分</small></span>
    </div>
    <div class="sequence-calculation" :class="{final:state.displayScore!==null,'focus-multiplier':state.focus==='multiplier','focus-final':state.focus==='final-score'}" aria-hidden="true"><b class="sequence-chips">{{ state.chips }}<small>筹码</small></b><i>×</i><b class="sequence-mult" :class="{pending:state.displayScore===null}">{{ state.mult }}</b><i>=</i><b class="sequence-total">{{ state.displayScore===null?'…':state.displayScore }}<small v-if="state.displayScore!==null">分</small></b></div>
    <p class="sequence-current" :key="state.index+'/'+state.focus">{{ currentLabel }}<b v-if="state.step.kind==='card' || state.step.kind==='item'"> ＋{{ state.step.delta }} 筹码</b></p>
    <div v-if="!state.done" class="sequence-track" aria-hidden="true"><i :style="{width:state.progress*100+'%'}"></i></div>
    <p class="sequence-realized"><b v-if="state.qualityVisible">{{ currentTrace.quality.rolledName || currentTrace.quality.name }}</b><span v-else>品质待揭晓</span><span v-if="state.musterVisible"> · {{ currentTrace.recruit.summary }}</span></p>
    <div v-if="receipt" class="sequence-outcome-slot"><RecruitReveal v-if="!state.orderVisible || state.done" :receipt="receipt" :revealed="state.musterVisible" :quality-visible="state.qualityVisible" :reduced-motion="reducedMotion || !enabled" :enabled="enabled" :speed="speed" compact/><OrderRecipients v-if="state.orderVisible" :receipt="receipt" compact/></div>
    <details v-if="state.done" class="sequence-breakdown"><summary class="key-disclosure">查看本手计分与道具兑现</summary><ScoreBreakdown :trace="currentTrace" details-only/></details>
    <small v-if="previous" class="sequence-previous">上一手 {{ previous.total }} 分已结算</small>
    <span v-if="state.done" class="sequence-sr" role="status">本手 {{ currentTrace.finalScore }} 分，{{ currentTrace.recruit.summary }}</span>
  </section>
</template>
<style scoped>
.sequence-heading{padding-right:28px;box-sizing:border-box}
.score-sequence{padding:7px 9px;border:1px solid #ac875d;background:linear-gradient(105deg,#3b2935,#241c2b);color:#eadcc4;font:12px/1.4 system-ui,sans-serif;font-variant-numeric:tabular-nums;min-width:0}.score-sequence header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.score-sequence header>strong{font:700 15px/1.3 var(--serif);color:#f4d09a}.score-sequence header small{font:10px sans-serif;color:#bba6bc;margin-left:4px}.sequence-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sequence-speed,.sequence-pause{min-height:28px;padding:2px 6px;border:1px solid #765c64;background:#302331;color:#e8cea3;font:11px sans-serif;cursor:pointer}.sequence-skip{font:11px sans-serif;color:#dfc39a;background:none;border:0;border-bottom:1px solid #806653;cursor:pointer;min-height:28px;padding:3px 0}.sequence-confirm{font-size:11px;color:#b8d3ad}
.sequence-selected{display:flex;align-items:flex-end;gap:4px;margin-top:5px;min-height:25px}.sequence-mini-card{display:grid;place-items:center;min-width:24px;padding:2px 4px;color:#817787;background:#322838;border:1px solid #655066;font:bold 11px/1.2 Georgia,serif;border-radius:2px;opacity:.6}.sequence-mini-card.lit{opacity:1;color:#302737;background:#e6d5b5;border-color:#ab906a}.sequence-mini-card.lit.red{color:#a33f51}.sequence-mini-card.counted{outline:1px solid #aadcea;box-shadow:0 0 5px #9ed5ee44}.sequence-mini-card.changed{border-bottom:2px solid #9bcab7}.sequence-mini-card.unscored.lit{background:#514352;color:#b3a4b4;border-color:#766175}.sequence-mini-card small{font:8px/1.2 sans-serif;color:#d1bdcc}.sequence-mini-card.changed small{color:#b7d6bb}.sequence-breakdown{font-size:11px;color:#d7be9c;margin-top:5px}.sequence-breakdown>summary{cursor:pointer;min-height:24px;display:flex;align-items:center}.sequence-breakdown :deep(.hand-score-panel){border:0;padding:0;background:none}.sequence-calculation{display:flex;align-items:baseline;gap:8px;margin-top:3px}.sequence-calculation>b{font:700 27px/1.1 Georgia,serif}.sequence-calculation small{font:10px sans-serif;margin-left:4px}.sequence-calculation i{font-style:normal;color:#ae98ac;font-size:18px}.sequence-chips{color:#a4daed}.sequence-mult{color:#ed999a}.sequence-mult.pending{color:#9c7b8a}.sequence-total{color:#ffe1a1}.sequence-calculation.focus-multiplier .sequence-mult{color:#ffb9bd;text-shadow:0 0 8px #e5878a60}.sequence-calculation.focus-final .sequence-total{color:#fff0c8;text-shadow:0 0 8px #ecc67d70}.sequence-current{font-size:11px;color:#e0c9a3;margin:4px 0;min-height:16px}.sequence-current b{color:#afd9e6}.sequence-realized{font-size:11px;color:#dbccbd;margin:4px 0 0;min-height:16px}.sequence-realized>b{color:var(--sequence-ink)}.sequence-track{height:2px;overflow:hidden;background:#594151}.sequence-track i{display:block;height:100%;background:#d3ae72}.sequence-previous{display:block;color:#a695ab;font-size:10px;margin-top:3px}.sequence-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.score-sequence.done{border-color:#79604e}.score-sequence.done .sequence-current{display:none}.score-sequence.enhanced{box-shadow:inset 2px 0 var(--sequence-ink)}.sequence-outcome-slot{margin-top:6px;height:160px;min-height:160px;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;display:grid;align-content:start;grid-auto-rows:max-content;gap:5px}
@media(min-width:1000px){.sequence-outcome-slot{height:190px;min-height:190px}}
@media(max-height:450px) and (orientation:landscape){.sequence-outcome-slot{height:128px;min-height:128px}}
@media(prefers-reduced-motion:no-preference){.score-sequence:not(.motion-off) .sequence-current{animation:score-step .11s ease-out}@keyframes score-step{from{opacity:.55;transform:translateX(-2px)}to{opacity:1;transform:none}}}
@media(max-width:500px){.score-sequence{padding:5px 7px}.sequence-calculation>b{font-size:23px}.sequence-calculation{gap:7px}.sequence-realized{font-size:10px}.sequence-actions{gap:5px}.sequence-pause,.sequence-speed,.sequence-skip{font-size:10px}}
</style>
