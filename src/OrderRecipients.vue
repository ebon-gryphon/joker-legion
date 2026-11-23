<script setup>
import {computed} from 'vue'
import {orderRecipientViews,orderRecipientHeading} from './presentationViews.js'
const props=defineProps({receipt:{type:Object,default:null},revealed:{type:Boolean,default:true},compact:Boolean})
const rows=computed(()=>orderRecipientViews(props.receipt,{revealed:props.revealed}))
const heading=computed(()=>orderRecipientHeading(props.receipt))
</script>
<template>
  <section v-if="receipt" class="order-recipients" :class="{compact,concealed:!revealed}" :data-order-recipient-count="revealed?rows.length:undefined" aria-label="本手实际受令成员">
    <template v-if="revealed"><header><strong>{{ heading.title }}</strong><small><template v-if="heading.sourceScore!==null">来源 {{ heading.sourceScore }} 分 · </template>{{ rows.length }} 名在场成员</small></header><p class="recipient-scope">下列为本手合计变化，包含搭档、加冕及其他本手效果。</p><ul class="order-recipients-list"><li v-for="row in rows" :key="row.id" :data-order-recipient="row.id"><div><b>{{ row.name }}</b><small>{{ row.role==='secondary'?'副令':'主令' }} · {{ row.profession }}<template v-if="row.isNew"> · 新兵结算后属性</template></small></div><p v-if="row.effects.length"><span v-for="effect in row.effects" :key="effect.stat">{{ effect.label }} <b>{{ effect.text }}{{ effect.unit }}{{ effect.deltaText }}</b></span></p><p v-else class="recipient-empty">没有可显示的属性变化。</p></li></ul><p v-if="!rows.length" class="recipient-empty">本手没有已记录的在场受令成员。</p></template>
    <span v-else class="recipient-placeholder">受令成员将在战令阶段显示</span>
  </section>
</template>
<style scoped>
.order-recipients{min-width:0;padding:8px 10px;border:1px solid #6c6375;background:#242230;color:#ddd7c8;font-size:11px;line-height:1.5}.order-recipients header{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.order-recipients header>small{color:#bba8c5}.recipient-scope{margin:4px 0;font-size:10px;color:#ac9db7}.order-recipients-list{list-style:none;margin:0;padding:0}.order-recipients-list>li{padding:5px 0;border-top:1px solid #4b4359}.order-recipients-list li>div{display:flex;gap:4px 10px;flex-wrap:wrap;align-items:baseline}.order-recipients-list li>div>b{color:#e7cda6;font-size:12px}.order-recipients-list li small{font-size:10px;color:#b0a1bd}.order-recipients-list li>p{display:flex;flex-wrap:wrap;gap:3px 10px;margin:2px 0;color:#b8a9be}.order-recipients-list li>p b{color:#c5ddcf;font-weight:500}.order-recipients.compact{padding:6px 8px}.order-recipients.compact .order-recipients-list{max-height:112px;overflow:auto;overscroll-behavior:contain}.order-recipients.concealed{padding:6px 8px;min-height:24px;display:flex;align-items:center}.recipient-empty,.recipient-placeholder{color:#ad9ab8;font-size:10px}
</style>
