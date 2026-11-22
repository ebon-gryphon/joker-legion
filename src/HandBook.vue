<script setup>
import KeyMark from './KeyMark.vue'
import { computed, ref } from 'vue'
import PixelSprite from './PixelSprite.vue'
import { QUALITIES } from './quality.js'
import { DETACHMENTS } from './recruitment.js'
import { QUALITY_OUTFITS, outfitFrame } from './outfits.js'
import { ORDER_BOOK, handScore, describeBonus } from './orders.js'
defineProps({ levels: { type: Object, required: true }, discovered: { type: Array, required: true } })
defineEmits(['close'])
const tab = ref('regular'), companion = ref('fullHouse')
function showWardrobe(key = 'fullHouse') {
  companion.value = key === 'pair' ? 'fullHouse' : key
  tab.value = 'wardrobe'
}
const rows = computed(() => Object.entries(ORDER_BOOK).filter(([, rule]) => !!rule.secret === (tab.value === 'secret')).reverse())
</script>

<template>
  <button class="modal-close key-close" aria-label="关闭牌型图鉴" @click="$emit('close')"><KeyMark name="close"/></button>
  <h2 id="handbook-title">牌型图鉴</h2>
  <p v-if="tab!=='wardrobe'">同时满足多种牌型时，列表中位阶最高的一种结算。秘传高于全部常规牌型。</p>
  <div class="book-tabs" aria-label="牌型分类">
    <button class="key-tab" :aria-pressed="tab==='regular'" @click="tab='regular'"><KeyMark name="book"/>常规牌型 · 9</button>
    <button class="key-tab" :aria-pressed="tab==='secret'" @click="tab='secret'"><KeyMark name="trick"/>秘传牌型 · 3</button>
    <button class="key-tab wardrobe-tab" :aria-pressed="tab==='wardrobe'" @click="showWardrobe()"><KeyMark name="allies"/>品质军装 · 7</button>
  </div>
  <section v-if="tab==='wardrobe'" class="wardrobe">
    <div class="wardrobe-intro"><p>左为牧师，右为{{ DETACHMENTS[companion].name }}。同品质共用军装，武器和坐骑随职业变化。</p>
      <label class="wardrobe-switch">对照兵种
        <select class="key-select" v-model="companion"><option v-for="(squad,key) in DETACHMENTS" :key="key" :value="key">{{ squad.name }} · {{ ORDER_BOOK[key].name }}</option></select>
      </label>
    </div>
    <div class="wardrobe-list">
      <figure v-for="(outfit,grade) in QUALITY_OUTFITS" :key="grade" :data-grade="grade" :style="{'--quality-ink':QUALITIES[grade].color}">
        <figcaption><b>{{ QUALITIES[grade].name }}</b><strong>{{ outfit.name }}</strong></figcaption>
        <div class="outfit-pair"><PixelSprite v-bind="outfitFrame('pair',grade)" :label="outfit.name+'牧师'"/><PixelSprite v-bind="outfitFrame(companion,grade)" :label="outfit.name+DETACHMENTS[companion].name"/></div>
        <small>{{ outfit.detail }}</small>
      </figure>
    </div>
  </section>
  <template v-else>
  <p v-if="tab==='secret'" class="book-note">营地可将手牌改印为另一张牌的副本。首次打出某种秘传牌型，即可在商店研习它。</p>
  <div class="book-rows">
    <article v-for="([key, rule]) in rows" :key="key" :data-hand="key">
      <header><strong>{{ rule.name }}</strong><small>{{ rule.secret && !discovered.includes(key) ? '待发现' : 'Lv.' + levels[key] }}</small><b>{{ handScore(key, levels[key]).chips }} 筹码 × {{ handScore(key, levels[key]).mult }}</b></header>
      <div class="book-example" :aria-label="'示例 ' + rule.example">
        <span v-for="(face, index) in rule.example.split(' ')" :key="index" :class="{ warm: ['♥','♦'].includes(face[0]) }">{{ face }}</span>
      </div>
      <p><b>{{ DETACHMENTS[key].name }} ×{{ DETACHMENTS[key].count }}</b> · 初始一星 · {{ rule.pattern }}。{{ rule.order }}消耗 {{ rule.cost }} 军令。</p>
      <small>基础战令　{{ describeBonus(rule) }}</small>
      <small v-if="key === 'straightFlush'">同花 10、J、Q、K、A 显示为皇家同花顺，共用此牌谱，并加冕一名受令士兵。</small>
      <button class="key-link outfit-link" @click="showWardrobe(key)">查看品质军装 ↗</button>
    </article>
  </div>
  <p class="book-note">示例只展示计分牌。J、Q、K 各计 10 点，A 计 11 点。A 可接 2 或 K，顺子不能跨过 A 首尾相连。</p>
  <p class="book-note">新兵生命、攻击与治疗按计分牌点数之和提升。例如 22233 增加 12%，222KK 增加 32%。计算属性时 J／Q／K／A 各按 11／12／13／14。</p>
  <p class="book-note">牌分 =（牌型筹码＋计分牌点数）× 倍率。基础战令乘以（1＋√牌分 ÷ 48）后取整。同花王冠额外提高 25%，行动间隔最低 0.35 秒。</p>
  </template>
</template>

<style scoped>
h2{margin:0;color:#f0d6b4;font:700 28px var(--serif)}
p{color:#c3b2ca;font-size:13px;line-height:1.6;margin:9px 0 15px}
.book-tabs{display:flex;gap:7px;margin:16px 0}
.book-tabs button{padding:8px 16px;border:1px solid #786585;background:#272032;color:#d4c4da;font:inherit;font-size:13px;cursor:pointer}
.book-tabs button[aria-pressed=true]{color:#ffe0a5;border-color:#d6ab73;background:#443444}
.book-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,252px),1fr));gap:10px}
article{background:#241d30;border:1px solid #51445e;padding:12px;text-align:left}
header{display:flex;align-items:baseline;gap:7px;color:#e5cee4}
header strong{font:700 17px var(--serif)}
header b{margin-left:auto;color:#e7c38e;font:600 12px monospace}
article small{display:block;color:#bba9c4;font-size:11px;line-height:1.6}
article p{margin:7px 0 3px;font-size:12px}
.book-example{display:flex;gap:4px;margin-top:10px}
.book-example span{min-width:30px;padding:3px 4px;text-align:center;background:#efe3c7;border-bottom:2px solid #ae9878;color:#323248;font:bold 14px Georgia,serif}
.book-example .warm{color:#933842}
.book-note{font-size:12px;margin:12px 0 0}
.outfit-link{margin-top:7px;color:#f4d398;padding:4px 10px;font-size:12px}
.book-tabs,.wardrobe-switch{flex-wrap:wrap}
.wardrobe-intro{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:5px;margin-bottom:12px}.wardrobe-intro p{margin:0;color:#e4d6ca}
.wardrobe-switch{display:flex;gap:4px}.wardrobe-switch select{font-size:12px;min-height:28px;padding:3px 9px}.wardrobe-switch select[aria-pressed=true]{color:#ffe1a9}
.wardrobe-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.wardrobe-list figure{margin:0;padding:6px 8px 7px;background:linear-gradient(155deg,#393044,#201c2a 80%);border:1px solid #6a5768;box-shadow:inset 0 -2px #160f1b}
.wardrobe-list figcaption{display:flex;gap:7px;align-items:baseline;border-bottom:1px solid #6c535347;color:#f5dcba}.wardrobe-list figcaption b{color:var(--quality-ink);font:700 16px var(--serif)}.wardrobe-list figcaption strong{font:700 14px var(--serif)}
.outfit-pair{display:flex;justify-content:center;gap:3%;padding:5px 0 3px}.outfit-pair .pixel-sprite{width:46%;height:92px;display:block;image-rendering:pixelated}.wardrobe-list small{display:block;color:#d0bfc8;font:12px/1.45 system-ui,sans-serif}
@media(max-width:850px){.wardrobe-list{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:600px){.wardrobe-list{grid-template-columns:repeat(2,minmax(0,1fr))}.book-tabs{gap:3px}.book-tabs button{padding:6px 8px}.outfit-pair .pixel-sprite{height:62px}}
</style>
