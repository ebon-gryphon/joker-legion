<script setup>
import {LEGACY_NODES,SUPPLY_ITEMS} from './legacyRules.js'
import {JOKER_BY_ID} from './campaignRules.js'
defineProps({profile:Object,error:String,busy:Boolean,feedback:String})
defineEmits(['purchase','close','retry'])
const icons={treasury:'◈',crystals:'◆',rehearsal:'♣',contract:'♧',orders:'⚑',supplies:'▣'}
</script>

<template>
  <header class="legacy-head"><div><h2 id="legacy-title">军团传承</h2><p>升级从下一局开营时生效。</p></div>
    <button class="key-link" @click="$emit('close')">返回</button></header>
  <p v-if="error" role="alert">{{ error }} <button class="key-link" @click="$emit('retry')">重读档案</button></p>
  <template v-if="profile">
    <div class="legacy-wallet"><b>♦ 红水晶 {{ profile.balance }}</b><small>累计获得 {{ profile.lifetimeEarned }}</small></div>
    <div class="legacy-grid"><article v-for="node in LEGACY_NODES" :key="node.id">
      <div class="node-heading"><span class="node-icon" aria-hidden="true">{{ icons[node.id] }}</span><h3>{{ node.name }}</h3></div>
      <div class="node-level"><i v-for="n in node.prices.length" :key="n" :class="{filled:n<=profile.levels[node.id]}" aria-hidden="true"></i><span>{{ profile.levels[node.id] }} / {{ node.prices.length }} 级</span></div>
      <p>当前 · {{ profile.levels[node.id] ? node.effect(profile.levels[node.id]*node.amount) : '未解锁' }}</p>
      <p v-if="profile.levels[node.id]<node.prices.length" class="ui-muted">下一级 · {{ node.effect(Math.min(node.prices.length,profile.levels[node.id]+1)*node.amount) }}</p>
      <small v-if="node.id==='supplies'">{{ SUPPLY_ITEMS.map(id=>JOKER_BY_ID[id].name).join('、') }}</small>
      <button class="key-ink" :data-legacy-node="node.id" :data-level="profile.levels[node.id]"
        :disabled="busy || !!error || !(profile.balance>=node.prices[profile.levels[node.id]])"
        @click="$event.detail<=1 && $emit('purchase',node.id,Number($event.currentTarget.dataset.level))">
        {{ profile.levels[node.id]===node.prices.length?'已满级':(profile.balance<node.prices[profile.levels[node.id]]?'余额不足 · ':'升级 · ')+node.prices[profile.levels[node.id]]+' 红水晶' }}
      </button>
    </article></div>
    <p v-if="feedback" class="ui-feedback" role="status">{{ feedback }}</p>
  </template>
  <p v-else-if="!error" role="status">读取传承档案中…</p>
</template>
