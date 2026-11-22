<script setup>
import { computed } from 'vue'
import { CARD_SUITS, CARD_CATALOG } from './cardCatalog.js'
import { ROYAL_MARCHES } from './jobs.js'
import ActionPreview from './ActionPreview.vue'
import KeyMark from './KeyMark.vue'
import SuitMark from './SuitMark.vue'
import PixelSprite from './PixelSprite.vue'

const codexSuit = defineModel('suit', { type:String, required:true })
const codexMember = defineModel('member', { type:Object, required:true })
const emit = defineEmits(['close'])
const suitLabels = { '♠': '黑桃', '♥': '红桃', '♣': '梅花', '♦': '方片' }
const codexMembers = computed(() => CARD_CATALOG.filter(member => codexSuit.value === 'all' || member.suit === codexSuit.value))
function filterFaction(suit) {
  codexSuit.value = suit
  codexMember.value = CARD_CATALOG.find(member => member.suit === suit)
}
</script>

<template>
  <button class="modal-close key-close" aria-label="关闭军团图鉴" @click="emit('close')"><KeyMark name="close"/></button>
  <header class="codex-header"><div><p class="eyebrow">CARD ART ARCHIVE</p><h2 id="codex-title">四族牌绘图鉴</h2></div><span class="archive-stamp">52 / 52<br><small>已收录</small></span></header>
  <nav class="codex-tabs" aria-label="按阵营筛选"><button class="key-tab" :aria-pressed="codexSuit === 'all'" :class="{ active: codexSuit === 'all' }" @click="codexSuit = 'all'">全部 <small>52</small></button><button class="key-tab" v-for="faction in CARD_SUITS" :key="faction.id" :style="{ '--faction': faction.color }" :aria-pressed="codexSuit === faction.suit" :class="{ active: codexSuit === faction.suit }" @click="filterFaction(faction.suit)"><SuitMark :suit="faction.suit"/><span>{{ suitLabels[faction.suit] }} · {{ faction.name }}</span> <small>13</small></button></nav>
  <div class="codex-body"><div class="codex-collection"><button class="key-face" v-for="member in codexMembers" :key="member.id" :class="['codex-card', { active: member.id === codexMember.id }]" :style="{ '--faction': member.color }" :data-faction="member.atlas" :aria-label="`${member.suit}${member.rank} ${member.name}`" :aria-pressed="member.id === codexMember.id" @click="codexMember = member"><span class="codex-card-identity"><b>{{ member.rank }}</b><SuitMark :suit="member.suit"/></span><PixelSprite :atlas="member.atlas" :frame="member.frame"/><strong>{{ member.name }}</strong><small>{{ member.title }}</small></button></div>
    <aside class="member-dossier" :style="{ '--faction': codexMember.color }" :data-faction="codexMember.atlas"><ActionPreview :unit="codexMember" :title="codexMember.name"><span class="dossier-rank"><b>{{ codexMember.rank }}</b><SuitMark :suit="codexMember.suit"/><strong>{{ suitLabels[codexMember.suit] }}</strong></span></ActionPreview><p class="eyebrow">{{ codexMember.faction }} / {{ codexMember.tier }}</p><h3>{{ codexMember.name }}</h3><span class="member-role">{{ codexMember.title }}</span><p class="member-description">{{ codexMember.description }}</p><div class="member-rule"><strong>{{ codexMember.faction }}</strong><p v-if="codexMember.rank==='K'"><b>{{ ROYAL_MARCHES[codexMember.suit].name }}</b> · 主将达到8经验时，此K计分可亲征。{{ ROYAL_MARCHES[codexMember.suit].text }}。</p></div><small class="dossier-note">这是牌绘与战斗形象档案。各牌型对应的兵种见牌型图鉴。</small></aside>
  </div><footer class="codex-footer"><p><span>■</span> A 王牌 · 2—10 军团成员 · J 统领 · Q 女王 · K 君主</p><button class="secondary-button key-ink" @click="emit('close')"><KeyMark name="return"/>返回远征 ↗</button></footer>
</template>
