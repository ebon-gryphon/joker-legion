<script setup>
import { computed } from 'vue'
import { onboardingView } from './onboarding.js'

const props=defineProps({game:{type:Object,required:true}})
const emit=defineEmits(['skip-step','skip-all','open'])
const coach=computed(()=>onboardingView(props.game))
</script>

<template>
  <aside v-if="coach" class="tutorial-coach" aria-label="可跳过的新手引导" :data-step="coach.stepId || 'wave-ready'">
    <header><span>新手引导 · 第 {{ coach.stage }} / 3 波</span><small>{{ coach.completed }} / {{ coach.total }} 项已完成</small></header>
    <div class="tutorial-copy" aria-live="polite" aria-atomic="true"><h3>{{ coach.title }}</h3><p>{{ coach.body }}</p><p v-if="coach.hint" class="tutorial-hint">{{ coach.hint }}</p></div>
    <nav aria-label="引导操作">
      <button v-if="coach.action" class="tutorial-open key-ink" @click="emit('open',coach.action.target)">{{ coach.action.label }} ↗</button>
      <button v-if="coach.canSkipStep" class="key-link" @click="emit('skip-step')">跳过这一步</button>
      <button class="key-link" @click="emit('skip-all')">结束引导，开放全部</button>
    </nav>
  </aside>
</template>

<style scoped>
.tutorial-coach{position:relative;min-width:0;max-width:100%;padding:10px 12px;border:1px solid #a38456;border-left:3px solid #e3bd7c;background:#261e2bf5;color:#f4e7d3;font:13px/1.5 system-ui,sans-serif;box-shadow:0 3px 12px #100a1833}
.tutorial-coach header{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px;color:#e4c38e;font-size:11px}
.tutorial-coach header small{font:inherit;color:#d1bfa5}.tutorial-coach h3{margin:0 0 3px;font-size:15px;color:#ffe3b3}.tutorial-coach p{margin:0}.tutorial-hint{margin-top:5px!important;color:#d6c8b8;font-size:12px}
.tutorial-coach nav{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:8px}.tutorial-coach button{min-height:32px;padding:4px 0;border:0;border-bottom:1px solid #b9986270;background:none;color:#ddc9a9;font:inherit;font-size:12px;text-align:left;cursor:pointer}.tutorial-coach .tutorial-open{color:#ffe1a6;font-weight:700}.tutorial-coach button:focus-visible{outline:2px solid #ffe2a8;outline-offset:2px}
@media(max-width:500px){.tutorial-coach{padding:8px 10px;font-size:12px}.tutorial-coach h3{font-size:14px}.tutorial-coach nav{gap:4px 10px}.tutorial-coach button{min-height:36px;font-size:11px}.tutorial-hint{font-size:11px}}
</style>
