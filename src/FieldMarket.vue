<script setup>
import {computed} from 'vue'
import KeyMark from './KeyMark.vue'
import RelicArt from './RelicArt.vue'
import {shopActionAvailability} from './fieldShop.js'
const props=defineProps({
  game: {type:Object,required:true}, offers: {type:Array,required:true},
  frameOf: {type:Function,required:true},
})
defineEmits(['purchase','reroll'])
const reroll=computed(()=>shopActionAvailability(props.game,'reroll'))
const purchase=item=>shopActionAvailability(props.game,'buy',item.id)
</script>

<template>
  <section class="field-market" aria-label="小丑商店">
    <header class="desk-section-title"><div><h3>小丑商人的货架</h3><p class="market-balance">蓝水晶余额 <b>{{ game.crystals ?? 0 }}</b><small>购买与刷新消耗，出售返还蓝水晶</small></p></div>
      <div class="market-reroll"><button class="secondary-button key-ink" :disabled="!reroll.available" :aria-describedby="!reroll.available?'market-reroll-reason':undefined" @click="$emit('reroll')"><KeyMark name="reroll"/>换一批 · {{ reroll.price }} 蓝水晶</button><small v-if="!reroll.available" id="market-reroll-reason" class="market-unavailable">{{ reroll.reason }}</small></div>
    </header>
    <div class="stall-grid">
      <article v-for="joker in offers" :key="joker.id" class="stall-item" :class="{sold:game.soldShop.includes(joker.id)}" :style="{ '--item-ink':joker.color }">
        <div class="item-showcase"><small>{{ joker.rarity }}</small><RelicArt :item="joker" :frame="frameOf(joker)" class="stall-art"/></div>
        <div class="item-offer"><h4>{{ joker.name }}</h4><p>{{ joker.description }}</p>
          <button class="purchase-button key-price" :disabled="!purchase(joker).available" :aria-describedby="!purchase(joker).available?'market-reason-'+joker.id:undefined" :aria-label="game.soldShop.includes(joker.id) ? joker.name+' 已售出' : '购买'+joker.name+' · '+purchase(joker).price+' 蓝水晶'" @click="$emit('purchase',joker)">
            <strong v-if="game.soldShop.includes(joker.id)" class="sold-print">已售出</strong><template v-else>{{ purchase(joker).available?'购买':'暂不可购' }}</template> <b v-if="!game.soldShop.includes(joker.id)">◆ {{ purchase(joker).price }} 蓝水晶</b>
          </button><small v-if="!purchase(joker).available" :id="'market-reason-'+joker.id" class="market-unavailable">{{ purchase(joker).reason }}</small></div>
      </article>
      <p v-if="!offers.length">本批搭档已售罄。</p>
    </div>
  </section>
</template>
