<script setup>
import {computed} from 'vue'
const props=defineProps({settlement:{type:Object,default:null},compact:Boolean,emptyText:{type:String,default:'这份记录未保存结算收支。'}})
const recorded=computed(()=>props.settlement && props.settlement.gold && props.settlement.crystals)
const number=n=>Number.isFinite(n)?Number(n.toFixed(1)):'未记录'
</script>
<template>
 <section class="economy-summary" :class="{compact}" aria-label="本波实际结算收支" :data-economy-wave="settlement?.wave">
  <template v-if="recorded"><h4>本波实际结算</h4>
   <p class="economy-gold"><strong>金币 +{{ number(settlement.gold.total) }}</strong><span>基础 +{{ number(settlement.gold.base) }}<template v-if="settlement.gold.bounty"> · 止钟赏金 +{{ number(settlement.gold.bounty) }}</template><template v-if="settlement.gold.wages"> · 搭档分红 +{{ number(settlement.gold.wages) }}</template></span><small>结算时余额 {{ number(settlement.gold.balance) }}</small></p>
   <p class="economy-crystals"><strong>蓝水晶 +{{ number(settlement.crystals.total) }}</strong><span data-income-source="crystals-base">守住本波 +{{ number(settlement.crystals.base) }}</span><span v-if="settlement.crystals.bonus" data-income-source="crystals-bonus">第 {{ settlement.wave }} 波额外 +{{ number(settlement.crystals.bonus) }}</span><small>结算时余额 {{ number(settlement.crystals.balance) }}</small></p>
   <small class="economy-boundary">以上为结算入账，补给与商店收支另算。</small>
  </template><p v-else class="economy-missing">{{ emptyText }}</p>
 </section>
</template>
<style scoped>
.economy-summary{font:11px/1.6 system-ui;color:#d1c2d0;border-top:1px solid #5b4a60;border-bottom:1px solid #5b4a60;padding:6px 0;margin:8px 0;font-variant-numeric:tabular-nums}.economy-summary h4{font-size:12px;color:#e8cfac;margin:0 0 5px}.economy-summary p{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 9px;margin:3px 0}.economy-summary p>strong{min-width:74px;color:#e7c994}.economy-summary .economy-crystals>strong,.economy-crystals>span{color:#a7dce5}.economy-summary p>small,.economy-boundary,.economy-missing{font-size:10px;color:#b2a4bc}.economy-boundary{display:block;margin-top:3px}.economy-summary.compact{padding:4px 0;margin:5px 0}.economy-summary.compact h4{display:none}
</style>
