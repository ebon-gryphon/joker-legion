<script setup>
defineProps({events:{type:Array,default:()=>[]}})
const number=n=>Number(n.toFixed(1))
</script>
<template>
 <section class="battle-payoffs" aria-label="关键兑现"><h3>关键兑现</h3>
 <p v-if="!events.length">重要行动发生后，会在这里留下实际结果。</p>
 <article v-for="event in events.filter(e=>e.actual).slice(-5).reverse()" :key="event.id" :data-payoff-kind="event.kind">
  <strong>{{ event.label }}</strong><span v-if="Number.isFinite(event.actualAmount)">实际 {{ number(event.actualAmount) }}<template v-if="event.shieldDamage"> · 盾吸收 {{ number(event.shieldDamage) }}</template></span>
  <small v-if="event.orderLabels?.length">受过 {{ event.orderLabels.join('、') }}。</small>
  <small>{{ event.reason }}</small>
 </article></section>
</template>
<style scoped>
.battle-payoffs{font:12px/1.55 system-ui;color:#d7c6b6}.battle-payoffs h3{color:#f4d79e;margin:8px 0}.battle-payoffs article{border-top:1px solid #68515e;padding:8px 0}.battle-payoffs strong,.battle-payoffs span,.battle-payoffs small{display:block}.battle-payoffs strong{color:#eed6ad}.battle-payoffs span{color:#b4ddd7}.battle-payoffs small{font-size:10px;color:#b7a7b9}
</style>
