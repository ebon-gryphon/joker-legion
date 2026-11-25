<script setup>
defineProps({warning:{type:Object,required:true},compact:Boolean})
</script>
<template>
  <section class="merge-warning" :class="{compact}" role="note" aria-label="副兵消耗与保留内容">
    <strong>{{ warning.title }}</strong>
    <p class="ui-flow"><span><small>保留主兵</small>{{ warning.leader.name }} · {{ warning.leader.quality }} · {{ warning.leader.level }}★</span><span class="ui-loss"><small>消耗副兵</small>{{ warning.donor.name }} · {{ warning.donor.quality }} · {{ warning.donor.level }}★ · #{{ warning.donor.id.split('-').pop() }}</span></p>
    <p>{{ warning.identity }}</p><p>{{ warning.attributes }}</p>
    <p>{{ warning.training }}</p>
    <p v-if="warning.donor.skills.length">副兵技能　{{ warning.donor.skills.join('、') }}</p>
    <p v-if="warning.lostXp" class="training-cap">经验上限为 999，本次有 {{ warning.lostXp }} 点经验无法保留。</p>
  </section>
</template>
<style scoped>
.merge-warning{padding:10px 12px;border:1px solid #b58163;background:#37252b;color:#f1d4b5;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.merge-warning strong{color:#ffe0a0}.merge-warning p{margin:5px 0}.merge-warning.compact{font-size:10px;padding:6px 8px;max-height:150px;overflow:auto;overscroll-behavior:contain}.merge-warning.compact p{margin:3px 0}.training-cap{color:#ffb2ac}
</style>
