<script setup>
import KeyMark from './KeyMark.vue'
import { FUSION_BY_ID } from './forge.js'
defineProps({ expanded:Boolean, report: { type: Array, required: true }, uses: { type: Object, required: true }, tactics: { type: Object, required: true }, formation: { type: String, required: true } })
</script>

<template>
  <details :open="expanded" v-if="expanded || report.length || Object.keys(uses).length || tactics.tolls || tactics.interrupts" class="field-report">
    <summary class="key-disclosure"><KeyMark name="order"/>本波战报 · 各兵种贡献</summary>
    <p class="report-skills"><strong>{{ formation }}</strong><span v-if="tactics.prevented">减免 {{ Math.round(tactics.prevented) }} 伤害</span><span v-if="tactics.extraDamage">集火追加 {{ Math.round(tactics.extraDamage) }} 伤害</span><span v-if="tactics.interrupts">战令止钟 {{ tactics.interrupts }} 次</span><span v-if="tactics.tolls">城门受钟击 {{ tactics.tolls }} 次，损失 {{ tactics.gateDamage }} 耐久</span></p>
    <table>
      <thead><tr><th>兵种</th><th>直接伤害</th><th>有效治疗</th></tr></thead>
      <tbody>
        <tr v-for="row in report" :key="row.type">
          <th>{{ row.label }}</th><td>{{ row.damage }}</td><td>{{ row.healed }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="Object.keys(uses).length" class="report-skills"><strong>融合战技</strong><span v-for="(count, id) in uses" :key="id">{{ FUSION_BY_ID[id].skill }} × {{ count }}</span></div>
  </details>
</template>
