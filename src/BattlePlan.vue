<script setup>
import KeyMark from './KeyMark.vue'
import { computed, ref } from 'vue'
import EnemyPortrait from './EnemyPortrait.vue'
import EnemyGuide from './EnemyGuide.vue'
import { ENEMY_CATALOG } from './enemyCatalog.js'
import { FORMATIONS, FORMATION_BY_ID, HOSTILE, SILENT_BOUNTY, BELL_WINDUP, tollDamage } from './tactics.js'

const props = defineProps({
  wave: { type: Object, required: true }, intel: { type: Object, required: true }, schedule: { type: Array, required: true },
  formation: { type: String, required: true }, inShop: Boolean, guideOnly: Boolean, embedded: Boolean,
})
const emit = defineEmits(['choose', 'close'])
const browsing = ref(props.formation)
const guideOpen = ref(props.guideOnly), guideType = ref('raider')
const guideButton = ref(null)
function inspect(type) {
  guideType.value = type
  guideOpen.value = true
}
const selected = computed(() => FORMATION_BY_ID[props.inShop ? browsing.value : props.formation])
const seconds = value => Number(value.toFixed(1))
const intelRows = computed(() => [...props.intel.enemies].sort((a, b) => {
  const priority = { finalBoss:3, boss: 2, bellkeeper: 1 }
  return (priority[b.type] || 0) - (priority[a.type] || 0) || b.count - a.count
}))
function choose(id) {
  if (props.inShop) browsing.value = id
  else emit('choose', id)
}
</script>

<template>
  <header class="brief-header">
    <div><small>{{ guideOpen ? '王城守军手册' : inShop ? '下一波军情' : '战前军议' }}</small><h2 id="brief-title">{{ guideOpen ? '敌军图鉴' : '第 ' + wave.id + ' 波 · ' + wave.name }}</h2></div>
    <button v-if="!guideOnly" ref="guideButton" class="brief-guide-link key-tab" :aria-pressed="guideOpen" @click="guideOpen = !guideOpen"><KeyMark :name="guideOpen?'return':'enemies'"/>{{ guideOpen ? '返回军情' : '敌军图鉴' }}</button>
    <button v-if="!embedded" class="forge-close key-close" :aria-label="guideOpen ? '关闭敌军图鉴' : '关闭军议'" @click="emit('close')"><KeyMark name="close"/></button>
  </header>
  <EnemyGuide v-if="guideOpen" :initial-type="guideType"/>
  <div v-else class="brief-body">
    <section class="brief-intel">
      <div class="brief-title"><h3>敌军编成</h3><b>共 {{ intel.total }} 名</b></div>
      <ul class="intel-ranks">
        <li v-for="entry in intelRows" :key="entry.type" :style="{ '--enemy-color': HOSTILE[entry.type].color }">
          <button class="intel-unit key-ticket" :aria-label="'查看' + entry.name + '图鉴'" @click="inspect(entry.type); guideButton?.focus()">
            <EnemyPortrait :type="entry.type"/><span><strong>{{ entry.name }}</strong><small>{{ ENEMY_CATALOG[entry.type].role }}</small></span><b>×{{ entry.count }}</b>
          </button>
        </li>
      </ul>
      <p class="brief-warning"><b>整队出击</b> 开战时 {{ intel.total }} 名敌军同时入场。</p>
      <p class="brief-warning"><b>限时 {{ wave.duration }} 秒</b> 时间到，残敌按各自的突破伤害扣除城门耐久。<template v-if="wave.boss">首领仍在场会直接攻破城门。</template></p>
      <p v-if="intel.bells.length" class="brief-warning"><b>鸣钟使</b> {{ intel.bells.map(seconds).join(' / ') }} 秒入场，首次蓄力 {{ BELL_WINDUP }} 秒。每次钟击损失 {{ tollDamage(wave.id) }} 城门耐久。</p>
      <p v-if="intel.bossAt !== null" class="brief-warning"><b>{{ wave.id === 12 ? '缀命皇后' : '无冕之王' }}</b> {{ seconds(intel.bossAt) }} 秒入场。{{ wave.id === 12 ? '裁决锁定最强者；震荡蓄力时集中输出可打断，带盾可减伤。' : '半血后改为轰击后排，并延缓被击中者的行动。' }}</p>
    </section>
    <section class="brief-orders">
      <div class="brief-title"><h3>{{ inShop ? '阵型手册' : '选择阵型' }}</h3><b>{{ inShop ? '可预览' : '本波生效' }}</b></div>
      <div class="formation-list" aria-label="军团阵型">
        <button class="key-ticket" v-for="item in FORMATIONS" :key="item.id" :aria-pressed="selected.id === item.id" :class="{ active: selected.id === item.id }" :style="{ '--formation-color': item.color }" @click="choose(item.id)">
          <span class="formation-glyph" :class="item.id" aria-hidden="true"><i v-for="n in 6" :key="n"></i></span>
          <span><strong>{{ item.name }}</strong><small>{{ item.summary }}</small></span><b aria-hidden="true">{{ selected.id === item.id ? '◆' : '◇' }}</b>
        </button>
      </div>
      <p class="formation-rule" :style="{ '--formation-color': selected.color }"><b>{{ selected.name }}</b>{{ selected.rule }}</p>
      <p v-if="!inShop" class="brief-warning formation-placement-note">切换阵型会清除手动站位，并按新阵型重新布阵；请在换阵后再调整士兵位置。</p>
    </section>
  </div>
  <footer v-if="!guideOpen" class="brief-footer"><p v-if="intel.bells.length">战前打过对子或更高牌型，可自动打断本波首次鸣钟。守住此波且全程无钟击，额外获得 {{ SILENT_BOUNTY }} 金币。</p>
    <p v-else>{{ inShop ? '可先按敌军构成购买小丑、研习牌谱。' : '战前可自由换阵。开战后锁定阵型。' }}</p>
    <button v-if="!embedded" class="gold-button key-command" @click="emit('close')"><KeyMark name="return"/>{{ inShop ? '返回补给' : '返回营地' }} ↗</button></footer>
</template>
