<script setup>
import KeyMark from './KeyMark.vue'
import { computed, ref } from 'vue'
import { ORDER_BOOK, TRAINING_COST, MAX_ORDER_LEVEL, handScore } from './orders.js'
const props = defineProps({ game: { type: Object, required: true } })
defineEmits(['train', 'book'])
const choice = ref('pair')
const locked = computed(() => ORDER_BOOK[choice.value].secret && !props.game.discoveredHands.includes(choice.value))
</script>
<template>
  <section class="war-college">
    <div class="study-page"><strong>研习牌谱</strong><div class="study-hand" :aria-label="ORDER_BOOK[choice].example"><i v-for="(face,i) in ORDER_BOOK[choice].example.split(' ')" :key="i" :class="{warm: ['♥','♦'].includes(face[0])}">{{ face }}</i></div><small>守城后领取补给，可花 5 金币研习一种牌型。{{ ORDER_BOOK[choice].name }}当前为 {{ handScore(choice, game.handLevels[choice]).chips }} 筹码 × {{ handScore(choice, game.handLevels[choice]).mult }}。<template v-if="game.handLevels[choice] < MAX_ORDER_LEVEL">升一级加 {{ ORDER_BOOK[choice].chipGain }} 筹码、{{ ORDER_BOOK[choice].multGain }} 倍率。</template></small></div>
    <button class="text-button key-link" @click="$emit('book')"><KeyMark name="book"/>牌型图鉴</button>
    <select class="key-select" v-model="choice" aria-label="选择研习牌型" :disabled="game.trainedHere">
      <option v-for="(item, key) in ORDER_BOOK" :key="key" :value="key">{{ item.name }} · {{ item.secret && !game.discoveredHands.includes(key) ? '待发现' : 'Lv.' + game.handLevels[key] }}</option>
    </select>
    <button class="secondary-button key-ink" @click="$emit('train', choice)" :disabled="game.phase!=='shop' || !game.rewardChosen || locked || game.trainedHere || game.gold < TRAINING_COST || game.handLevels[choice] >= MAX_ORDER_LEVEL"><KeyMark name="book"/>
      {{ game.phase!=='shop' || !game.rewardChosen ? '战后领取补给可研习' : locked ? '首次打出后可研习' : game.trainedHere ? '本次已研习' : game.handLevels[choice] >= MAX_ORDER_LEVEL ? '已达三级' : game.gold < TRAINING_COST ? '金币不足' : '升至 Lv.' + (game.handLevels[choice] + 1) + ' · ' + TRAINING_COST + ' 金币' }}
    </button>
  </section>
</template>
