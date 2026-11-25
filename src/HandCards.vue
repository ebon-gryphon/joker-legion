<script setup>
import SuitMark from './SuitMark.vue'
import PixelSprite from './PixelSprite.vue'
import { CARD_SUITS, getCardDesign as cardDesign } from './cardCatalog.js'

defineProps({ cards:Array, game:Object, preview:Object, palmId:String, palming:Boolean, ordersOpen:Boolean })
const emit = defineEmits(['inspect','choose'])
const suitLabels = { '♠':'黑桃', '♥':'红桃', '♣':'梅花', '♦':'方片' }
const factionOf = suit => CARD_SUITS.find(faction => faction.suit === suit)
</script>

<template>
  <div class="hand-cards">
    <button v-for="(card, index) in cards" :key="card.id" class="playing-card key-face" :class="{ palming: palming && palmId === card.id, altered: game.palmedCard?.id === card.id, selected: game.selected.includes(card.id), unscored: game.selected.includes(card.id) && !preview.scoringIds.includes(card.id), red: card.suit === '♥' || card.suit === '♦' }"
        :style="{ '--card-index': index, '--faction': factionOf(card.suit).color }" :data-faction="cardDesign(card).atlas"
        :title="`${card.suit}${card.rank} · 计分点数 ${card.rank==='A'?11:Math.min(10,Number(card.rank)||10)} · 右键查看牌绘`" @contextmenu.prevent="emit('inspect',card)"
        :aria-label="`${suitLabels[card.suit]}${card.rank}，手牌${game.selected.includes(card.id) ? (preview.scoringIds.includes(card.id)?'，已选择，参与计分':'，已选择，随手牌') : ''}`" :aria-pressed="game.selected.includes(card.id)"
        :disabled="!ordersOpen || (!palming && !game.selected.includes(card.id) && game.selected.length >= 5)" @click="emit('choose',card.id)">
        <span class="hand-corner"><b class="hand-rank">{{ card.rank }}</b><SuitMark :suit="card.suit" class="hand-suit"/>
        </span>
        <SuitMark v-if="!['J','Q','K'].includes(card.rank)" :suit="card.suit" class="hand-pip"/>
        <PixelSprite v-else class="hand-portrait" :atlas="cardDesign(card).atlas" :frame="cardDesign(card).frame"/>
        <span class="card-character-name">{{ cardDesign(card).name }}</span>
        <span class="card-key">{{ game.palmedCard?.id === card.id ? '已改点' : index + 1 }}</span>
        <span v-if="game.selected.includes(card.id)" class="card-check" :class="{ kicker: !preview.scoringIds.includes(card.id) }"
        :title="preview.scoringIds.includes(card.id) ? '参与计分' : '随手打出，不计分、不征兵'">{{ preview.scoringIds.includes(card.id) ? '✓' : '−' }}</span>
        </button>
  </div>
</template>

<style scoped>
.hand-corner {position:absolute;z-index:1;left:7%;top:6%;display:flex;align-items:center;gap:2px;line-height:1;color:#212230}
.hand-corner .hand-rank {position:static;font:800 clamp(14px,1.3vw,21px)/1 Georgia,serif;letter-spacing:-.04em}
.hand-corner .hand-suit {display:block;width:.88em;height:1em}
.playing-card.red .hand-corner,.playing-card.red .hand-pip {color:#a62d45}
.playing-card .hand-pip {position:absolute;inset:auto 19% 8% auto;width:48%;height:47%;color:#292332}
.playing-card .hand-portrait {position:absolute;inset:30% 6% 4%;width:88%;height:66%;image-rendering:pixelated}
</style>
