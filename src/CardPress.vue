<script setup>
import KeyMark from './KeyMark.vue'
import { computed, ref } from 'vue'
import { PRINTS_PER_WAVE, printingCost } from './engine.js'
import { getCardDesign } from './cardCatalog.js'
import PixelSprite from './PixelSprite.vue'
const props = defineProps({ game: { type: Object, required: true }, apply: { type: Function, required: true } })
const source = ref(null), targets = ref([]), receipt = ref('')
const face = card => card.suit + card.rank
const price = computed(() => printingCost(props.game, targets.value.length))
function reset() { source.value = null; targets.value = [] }
function choose(card) {
  if (!source.value) { receipt.value = ''; source.value = card; return }
  if (targets.value.includes(card.id)) targets.value = targets.value.filter(id => id !== card.id)
  else targets.value.push(card.id)
}
function unavailable(card) {
  return !!source.value && (face(card) === face(source.value) ||
    (targets.value.length >= props.game.printsLeft && !targets.value.includes(card.id)))
}
function confirm() {
  if (!props.apply(source.value.id, targets.value)) return
  receipt.value = targets.value.length + ' 张已改印为 ' + face(source.value) + '，已收入本局牌组。'
  reset()
}
</script>

<template>
  <h2 id="press-title">营地牌匠</h2>
  <p class="press-intro">选一张手牌作底本，再把其他手牌改印成它的点数和花色。改动保留到本次远征结束。</p>
  <div class="press-wallet"><span>金币 <b>{{ game.gold }}</b></span><span>本波可改 <b>{{ game.printsLeft }} / {{ game.printsBudget ?? PRINTS_PER_WAVE }}</b> 张</span></div>
  <div class="press-step"><strong>{{ !game.printsLeft ? '本波改印已用完' : source ? '选择要改印的手牌' : '选择底本' }}</strong>
    <button v-if="source" class="text-button key-link" @click="reset"><KeyMark name="cards"/>重选底本</button></div>
  <div class="press-hand">
    <button class="key-face" v-for="(card, index) in game.hand" :key="card.id" :aria-label="face(card) + ' 第' + (index+1) + '张'"
      :title="unavailable(card)?(face(card)===face(source)?'与底本相同':'已选满本波可改数量'):undefined" :disabled="!game.printsLeft || unavailable(card)" :aria-pressed="targets.includes(card.id) || card === source"
      :class="{ source: card === source, chosen: targets.includes(card.id) }" @click="choose(card)">
      <b :class="{ warm: ['♥', '♦'].includes(card.suit) }">{{ face(card) }}</b>
      <PixelSprite :atlas="getCardDesign(card).atlas" :frame="getCardDesign(card).frame"/>
      <small>{{ card === source ? '底本' : targets.includes(card.id) ? '改为 ' + face(source) : getCardDesign(card).name }}</small>
    </button>
  </div>
  <div v-if="source && targets.length" class="ui-flow" aria-live="polite"><span><small>原牌</small>{{ game.hand.filter(card=>targets.includes(card.id)).map(face).join('、') }}</span> → <span><small>改印结果</small>{{ face(source) }} × {{ targets.length }}</span></div>
  <p v-if="receipt" class="receipt" role="status">{{ receipt }}</p>
  <details v-if="Object.keys(game.cardEdits).length"><summary class="key-disclosure"><KeyMark name="order"/>本局已改动 {{ Object.keys(game.cardEdits).length }} 张</summary>
    <div class="edits"><span v-for="(current, original) in game.cardEdits" :key="original">{{ original }} → {{ current }}</span></div>
  </details>
  <div class="press-pay"><small>{{ game.printsLeft ? '本波下一张 '+printingCost(game,1)+' 金币，选牌后显示总价。' : '本波可用次数已用完。' }}</small>
    <button class="gold-button key-command" :disabled="!targets.length || game.gold < price" @click="confirm"><KeyMark name="press"/>
      {{ targets.length ? (game.gold < price ? '金币不足' : '改印 ' + targets.length + ' 张') + ' · ' + price + ' 金币' : '选择改印手牌' }}
    </button></div>
</template>

<style scoped>
h2{margin:0;color:#f0d6b4;font:700 28px var(--serif)}
.press-intro,.press-pay small{color:#c0afc9;font-size:13px;line-height:1.65}
.press-wallet,.press-step,.press-pay{display:flex;align-items:center;justify-content:space-between;gap:10px}
.press-wallet{padding:9px 12px;background:#211a2e;border:1px solid #54435f;font-size:13px;color:#c9b8cf}
.press-wallet b,.receipt{color:#e7c18a}
.press-step{margin:18px 0 9px;min-height:28px;color:#ead8df}
.press-hand{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.press-hand button{display:grid;justify-items:center;padding:5px;color:#d8c6df;border:1px solid #6b5a77;background:#2d2338;cursor:pointer}
.press-hand button.source,.press-hand button.chosen{background:#473344;border:2px solid #e2b875;padding:4px}
.press-hand button:disabled:not(.source){opacity:.55;cursor:default}
.press-hand b{justify-self:start;padding:2px 5px;background:#eddfc3;color:#302d40;font:bold 14px Georgia,serif}
.press-hand b.warm{color:#983b47}
.press-hand .pixel-sprite{width:52px;height:56px}
.press-hand small{font-size:11px;min-height:18px}
.press-pay{margin-top:18px;flex-wrap:wrap}.press-pay .gold-button{font-size:12px}
details,.receipt{font-size:12px;margin:12px 0 0}summary{color:#c1adc9;cursor:pointer}.edits{display:flex;flex-wrap:wrap;gap:5px 14px;padding:8px 0;color:#e3d3e7}
</style>
