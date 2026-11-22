<script setup>
import { computed } from 'vue'
import { FEINT, scoutRead } from './engine.js'
import { REGIMENTS } from './orders.js'
import KeyMark from './KeyMark.vue'

const props = defineProps({ game: { type: Object, required: true } })
defineEmits(['choose'])
const read = computed(() => scoutRead(props.game))
const eligible = computed(() => read.value.fielded.length >= 2 && props.game.gold >= FEINT.stake)
</script>

<template>
  <section class="feint-table">
    <header><h2>亮假旗</h2><p>挂出一个兵种的旗号，引敌将误判你最后一道战前军令。</p></header>
    <div class="feint-flags" aria-label="选择假旗">
      <button v-for="(role,type) in REGIMENTS" :key="type" class="key-ticket" :data-flag="type"
        :disabled="!eligible || !read.fielded.includes(type)" :aria-pressed="game.feint?.flag===type" @click="$emit('choose',type)">
        <b :data-suit="role.suit">{{ role.suit }}</b><span>{{ role.name }}</span><small>{{ read.fielded.includes(type) ? '疑心 '+read.scores[type] : '未征募' }}</small>
      </button>
    </div>
    <p class="feint-reading"><KeyMark name="enemies"/><strong>{{ game.feint && read.target ? '敌将会盯住'+REGIMENTS[read.target].name : '尚未挂旗' }}</strong>
      <span>每颗兵星算 1 点疑心，上次战前受令加 3 点，旗号加 4 点。疑心最高的部队会被追击，同分按上方从左到右。</span>
    </p>
    <p class="feint-terms">出战押 {{ FEINT.stake }} 金。第 {{ FEINT.opens }} 秒敌军开始追旗，第 {{ FEINT.reveal }} 秒揭晓。如果最后一道战前军令发给另一队，就收回 {{ FEINT.payout }} 金，并让普通敌军的下次普攻推迟 {{ FEINT.delay }} 秒。</p>
    <button v-if="game.feint" class="key-link" @click="$emit('choose',null)"><KeyMark name="return"/>收起假旗</button>
    <p v-else-if="!eligible" class="feint-locked">{{ read.fielded.length < 2 ? '先用手牌集结两个不同的兵种。' : '亮旗需要 '+FEINT.stake+' 金币。' }}</p>
  </section>
</template>
