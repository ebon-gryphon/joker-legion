<script setup>
import {LEGACY_NODES,SUPPLY_ITEMS} from './legacyRules.js'
import {JOKER_BY_ID} from './campaignRules.js'
defineProps({profile:Object,error:String,busy:Boolean})
defineEmits(['purchase','close','retry'])
</script>

<template>
  <header class="legacy-head"><div><h2 id="legacy-title">军团传承</h2><p>升级从下一局开营时生效。</p></div>
    <button class="key-link" @click="$emit('close')">返回</button></header>
  <p v-if="error" role="alert">{{ error }} <button class="key-link" @click="$emit('retry')">重读档案</button></p>
  <template v-if="profile">
    <div class="legacy-wallet"><b>♦ 红水晶 {{ profile.balance }}</b><small>累计获得 {{ profile.lifetimeEarned }}</small></div>
    <div class="legacy-grid"><article v-for="node in LEGACY_NODES" :key="node.id">
      <h3>{{ node.name }} <small>{{ profile.levels[node.id] }} / {{ node.prices.length }}</small></h3>
      <p>{{ profile.levels[node.id]===node.prices.length?'满级效果':'升至下一级' }} · {{ node.effect(Math.min(node.prices.length,profile.levels[node.id]+1)*node.amount) }}</p>
      <small v-if="node.id==='supplies'">{{ SUPPLY_ITEMS.map(id=>JOKER_BY_ID[id].name).join('、') }}</small>
      <button class="key-ink" :data-legacy-node="node.id" :data-level="profile.levels[node.id]"
        :disabled="busy || !!error || !(profile.balance>=node.prices[profile.levels[node.id]])"
        @click="$event.detail<=1 && $emit('purchase',node.id,Number($event.currentTarget.dataset.level))">
        {{ profile.levels[node.id]===node.prices.length?'已满级':(profile.balance<node.prices[profile.levels[node.id]]?'余额不足 · ':'升级 · ')+node.prices[profile.levels[node.id]]+' 红水晶' }}
      </button>
    </article></div>
  </template>
  <p v-else-if="!error" role="status">读取传承档案中…</p>
</template>

<style scoped>
:global(.modal.legacy-modal){width:min(820px,94vw);padding:24px;text-align:left;overflow:auto;max-height:90dvh}
:global(.legacy-result){margin:12px 0;padding:12px;border-block:1px solid #875a50;background:#2c2025}
:global(.legacy-result h3),:global(.legacy-result strong){color:#ffb1b7}
:global(.legacy-result p){margin:.35em 0}
.legacy-head,.legacy-wallet,.legacy-grid h3{display:flex;align-items:center;justify-content:space-between;gap:1em}
.legacy-head h2,.legacy-grid h3{margin:0;color:#f5dfbb;font-family:'Songti SC',serif}
.legacy-head p,.legacy-grid p{margin:.45em 0 .7em}
.legacy-wallet{border-block:1px solid #83554b;padding:.8em 0;margin:.7em 0}.legacy-wallet b{color:#ffafb2}
.legacy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:12px}
.legacy-grid article{display:flex;flex-direction:column;align-items:stretch;padding:13px;background:#292024;border:1px solid #624a41}
.legacy-grid small,.legacy-wallet small{color:#cfb89e;font-size:12px}.legacy-grid button{margin-top:auto;align-self:flex-start}.legacy-grid article>small{margin-bottom:8px}
</style>

