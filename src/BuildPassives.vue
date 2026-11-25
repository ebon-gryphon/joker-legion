<script setup>
import {computed} from 'vue'
import {buildPassiveRows} from './buildDisplay.js'
const props=defineProps({state:{type:Object,default:null},compact:Boolean})
const rows=computed(()=>buildPassiveRows(props.state))
</script>
<template>
 <section class="build-passives" :class="{compact}" aria-label="本局构筑被动" :data-build-count="rows.length">
  <h3>本局构筑被动 <small>{{ rows.length }} 项 · 每项唯一</small></h3>
  <p v-if="!rows.length" class="build-empty">尚未获得构筑被动，可在波后随机补给中遇见。</p>
  <ul v-else><li v-for="row in rows" :key="row.id" :data-build-passive="row.id"><span class="build-icon" aria-hidden="true">{{ row.icon }}</span><div><strong>{{ row.name }}</strong><small>{{ row.count===null?'触发次数未记录':'实际触发 '+row.count+' 次' }}</small><p>{{ row.description }}</p></div></li></ul>
 </section>
</template>
<style scoped>
.build-passives{font:12px/1.55 system-ui;color:#e2d2be;min-width:0}.build-passives h3{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;font:700 16px/1.4 var(--serif);color:#f0d5a4;margin:6px 0}.build-passives h3>small{font:10px/1.4 system-ui;color:#bbaaaf}.build-passives ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;list-style:none;padding:0;margin:6px 0}.build-passives li{display:flex;gap:7px;padding:7px 9px;border:1px solid #6c596c;background:#2b2231;min-width:0}.build-icon{color:#a8d9d3;font-size:20px;flex:none}.build-passives li>div{min-width:0}.build-passives strong{color:#eacda3}.build-passives li small{display:block;color:#a9cebe;font-size:10px}.build-passives li p{font-size:11px;line-height:1.5;margin:3px 0;overflow-wrap:anywhere}.build-empty{font-size:11px;color:#b9a8bd;margin:4px 0}.build-passives.compact h3{font-size:14px}.build-passives.compact ul{grid-template-columns:1fr}.build-passives.compact li{padding:5px 7px}
@media(max-width:600px){.build-passives ul{grid-template-columns:1fr}.build-passives li p{font-size:10px}}
</style>
