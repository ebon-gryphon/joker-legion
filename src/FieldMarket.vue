<script setup>
import KeyMark from './KeyMark.vue'
import RelicArt from './RelicArt.vue'
defineProps({
  game: {type:Object,required:true}, offers: {type:Array,required:true},
  frameOf: {type:Function,required:true},
})
defineEmits(['purchase','reroll'])
</script>

<template>
  <section class="field-market" aria-label="小丑商店">
    <header class="desk-section-title"><div><h3>小丑商人的货架</h3></div>
      <button class="secondary-button key-ink" :disabled="game.gold < (game.rerollCost || 2)" @click="$emit('reroll')"><KeyMark name="reroll"/>换一批 · {{ game.rerollCost || 2 }} 金币</button>
    </header>
    <div class="stall-grid">
      <article v-for="joker in offers" :key="joker.id" class="stall-item" :class="{sold:game.soldShop.includes(joker.id)}" :style="{ '--item-ink':joker.color }">
        <div class="item-showcase"><small>{{ joker.rarity }}</small><RelicArt :item="joker" :frame="frameOf(joker)" class="stall-art"/></div>
        <div class="item-offer"><h4>{{ joker.name }}</h4><p>{{ joker.description }}</p>
          <button class="purchase-button key-price" :disabled="game.soldShop.includes(joker.id) || game.gold < joker.price" :aria-label="game.soldShop.includes(joker.id) ? joker.name+' 已售出' : '购买'+joker.name+' · '+joker.price+' 金币'" @click="$emit('purchase',joker)"><KeyMark v-if="!game.soldShop.includes(joker.id)" name="coin"/>
            <strong v-if="game.soldShop.includes(joker.id)" class="sold-print">已售出</strong><template v-else>{{ game.gold < joker.price ? '金币不足' : '购买' }}</template> <b v-if="!game.soldShop.includes(joker.id)">◈ {{ joker.price }}</b>
          </button></div>
      </article>
      <p v-if="!offers.length">本批搭档已售罄。</p>
    </div>
  </section>
</template>
