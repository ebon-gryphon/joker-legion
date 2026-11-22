<script setup>
import KeyMark from './KeyMark.vue'
import { computed, ref } from 'vue'
import ActionPreview from './ActionPreview.vue'
import EnemyPortrait from './EnemyPortrait.vue'
import { ENEMY_CATALOG } from './enemyCatalog.js'
import { HOSTILE } from './tactics.js'
import { isBoss } from './bossRules.js'

const props = defineProps({ initialType: { type: String, default: 'raider' } })
const selected = ref(props.initialType)
const enraged = ref(false)
const entry = computed(() => ENEMY_CATALOG[selected.value])
const performer = computed(()=>({side:'enemy',type:selected.value,hp:enraged.value?40:100,maxHp:100,enraged:enraged.value}))
const enemy = computed(() => HOSTILE[selected.value])
function inspect(type) {
  selected.value = type
  enraged.value = false
}
</script>

<template>
  <div class="enemy-book">
    <div class="enemy-muster" aria-label="选择敌方兵种">
      <button class="key-ticket" v-for="(item, type) in ENEMY_CATALOG" :key="type" :aria-pressed="selected === type"
        :style="{ '--unit-ink': HOSTILE[type].color }" @click="inspect(type)">
        <EnemyPortrait :type="type"/>
        <strong>{{ HOSTILE[type].name }}</strong>
      </button>
    </div>
    <article class="enemy-record" :style="{ '--unit-ink': enemy.color }">
      <div class="enemy-stage">
        <ActionPreview :unit="performer" :title="enemy.name"/>
      </div>
      <div class="enemy-notes">
        <small>第 {{ entry.wave }} 波起出没 · {{ entry.role }}</small>
        <h3>{{ enemy.name }}</h3>
        <div v-if="isBoss(selected)" class="king-poses" aria-label="首领形态">
          <button class="key-tab" :aria-pressed="!enraged" @click="enraged = false"><KeyMark name="enemies"/>常态</button>
          <button class="key-tab" :aria-pressed="enraged" @click="enraged = true"><KeyMark name="enemies"/>半血狂暴</button>
        </div>
        <p>{{ enraged ? (selected === 'finalBoss' ? '半血后裁决与震荡伤害提高 20%，技能间隔缩短。注意蓄力进度与盾量。' : '生命降至一半时，王改为标记最后排的战友。轰击落下后，到下次标记的间隔缩短到六秒。') : entry.attack }}</p>
        <h4>应对</h4>
        <p>{{ enraged ? (selected === 'finalBoss' ? entry.counter : '后排也会被点名。战前用散兵阵并给后排列盾，交战中可用逃生绳保住关键士兵。') : entry.counter }}</p>
      </div>
    </article>
  </div>
</template>
