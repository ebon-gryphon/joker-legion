<script setup>
import SoldierSheet from './SoldierSheet.vue'
import MergeWarning from './MergeWarning.vue'
import KeyMark from './KeyMark.vue'
import { computed, nextTick, ref, watch } from 'vue'
import ActionPreview from './ActionPreview.vue'
import PixelSprite from './PixelSprite.vue'
import { FUSION_BY_ID, FUSION_COST, ROLE_NAMES, mergePreview, mergeWarning } from './forge.js'
import { FUSION_PROFESSIONS, professionId, professionName, professionJobs, fusionProfessionNames } from './professionFusion.js'
import { JOBS } from './jobs.js'
import { gradeOf, QUALITIES } from './quality.js'
import { FIELD_LIMIT } from './campaignRules.js'
import { displayName, secondaryIdentity } from './soldierIdentity.js'
import { getSpriteFrame } from './spriteAtlas.js'

const props = defineProps({
  game: { type: Object, required: true }, pairs: { type: Object, required: true },
  applyMerge: { type: Function, required: true },
})
const emit = defineEmits(['close', 'commission', 'lock', 'champion', 'field-reserve'])
const pane = ref(props.pairs.ascend.length || props.game.reserves.length ? 'ascend' : props.pairs.profession.length ? 'fusion' : 'promote')
const role = ref(professionId(props.pairs.profession[0]?.leader || props.pairs.promote[0]?.leader || props.game.allies[0]) || 'blade')
const selectedLeader = ref(''), selectedDonor = ref(''), picker = ref(''), receipt = ref(null), chosenId = ref('')
const continueButton = ref(null)
const ascendKey = ref('')
const ascendPair = computed(()=>props.pairs.ascend.find(p=>p.leader.id+'/'+p.donor.id===ascendKey.value) || props.pairs.ascend[0])
const ascension = computed(()=>ascendPair.value && mergePreview(props.game,ascendPair.value.leader.id,ascendPair.value.donor.id,'ascend'))
const ascendWarning = computed(()=>ascendPair.value && mergeWarning(props.game,ascendPair.value.leader.id,ascendPair.value.donor.id,'ascend'))
function ascend() {
  const pair = ascendPair.value, result = ascension.value
  if (!pair || !result) return
  const before = {...pair.leader}
  if (!props.applyMerge(before.id,pair.donor.id,'ascend')) return
  receipt.value = {unit:{...pair.leader}, name:unitTitle(pair.leader)+' · '+gradeOf(pair.leader).name,
    from:displayName(before), other:displayName(pair.donor), ascended:true, stats:statRows(before,pair.leader)}
  nextTick(()=>continueButton.value?.focus())
}
const isFusion = computed(() => pane.value === 'fusion')
const kind = computed(() => isFusion.value ? 'profession' : 'promote')
const pool = computed(() => isFusion.value ? props.pairs.profession : props.pairs.promote)
const options = computed(() => pool.value.filter(pair => professionId(pair.leader) === role.value))
const unique = units => [...new Map(units.map(unit => [unit.id, unit])).values()]
const leaders = computed(() => unique(options.value.map(pair => pair.leader)))
const donors = computed(() => options.value.filter(pair => pair.leader.id === selectedLeader.value).map(pair => pair.donor))
watch(leaders, list => {
  if (!list.some(unit => unit.id === selectedLeader.value)) selectedLeader.value = list[0]?.id || ''
}, { immediate: true, flush: 'sync' })
watch(donors, list => {
  if (!list.some(unit => unit.id === selectedDonor.value)) selectedDonor.value = list[0]?.id || ''
}, { immediate: true, flush: 'sync' })
const leader = computed(() => leaders.value.find(unit => unit.id === selectedLeader.value))
const donor = computed(() => donors.value.find(unit => unit.id === selectedDonor.value))
const result = computed(() => mergePreview(props.game, selectedLeader.value, selectedDonor.value, kind.value))
const consumptionWarning = computed(() => mergeWarning(props.game,selectedLeader.value,selectedDonor.value,kind.value))
const serving = computed(() => props.game.allies.find(unit => unit.command))
watch(() => props.game.allies.map(unit => unit.id), ids => {
  if (!ids.includes(chosenId.value)) chosenId.value = serving.value?.id || props.game.allies.find(unit => unit.level >= 2)?.id || ids[0] || ''
}, { immediate: true })
const inspected = computed(() => props.game.allies.find(unit => unit.id === chosenId.value))
const selectedProfession = computed(()=>FUSION_PROFESSIONS.find(job=>job.id===role.value) || FUSION_PROFESSIONS[0])
const outputName = computed(() => leader.value ? displayName(leader.value) : selectedProfession.value.name)
const previewUnit = computed(()=>leader.value && result.value ? {...leader.value,...result.value} : leader.value)
const sourceList = computed(() => [
  { label: '保留主将', unit: leader.value, type:selectedProfession.value.type, available:leaders.value.length },
  { label: '并入副手', unit: donor.value, type:selectedProfession.value.type, available:donors.value.length },
])
const price = computed(() => isFusion.value ? FUSION_COST : 0)
const affordable = computed(() => props.game.gold >= price.value)
const stats = computed(() => result.value ? statRows(leader.value, result.value) : [])
const inheritedJobs = computed(()=>previewUnit.value ? professionJobs(previewUnit.value).map(id=>JOBS[id]) : [])
const professionChoices = computed(()=>[
  ...FUSION_PROFESSIONS,
  ...unique(props.game.allies.filter(unit=>!FUSION_PROFESSIONS.some(job=>job.id===professionId(unit))))
    .map(unit=>({id:professionId(unit),type:unit.type,name:professionName(unit),pattern:unit.pattern})),
].filter((job,index,items)=>items.findIndex(item=>item.id===job.id)===index))
function availableFor(id) { return pool.value.some(pair=>professionId(pair.leader)===id) }
function professionPortrait(job) { return getSpriteFrame({side:'ally',type:job.type,pattern:job.pattern,jobId:job.id,grade:0}) }

function portrait(unit, type) {
  return getSpriteFrame(unit || { side:'ally', type, grade:0 })
}
function statRows(before, after) {
  return [['攻击', 'atk'], ['生命上限', 'maxHp'], ['治疗力', 'heal']]
    .filter(([, key]) => key !== 'heal' || after.heal > 0)
    .map(([label, key]) => ({ label, before: before[key], after: after[key] }))
}
function setPane(value) {
  pane.value = value
  if (value==='fusion' || value==='promote') {
    const available=pool.value[0]?.leader
    if (!availableFor(role.value) && available) role.value=professionId(available)
  }
  picker.value = ''; receipt.value = null
}
function selectRole(id) {
  role.value = id; picker.value = ''; receipt.value = null
}
function chooseSlot(unit) {
  if (picker.value === '保留主将') selectedLeader.value = unit.id
  else selectedDonor.value = unit.id
  picker.value = ''
}
function grade(unit) { return '★'.repeat(unit.level) }
function unitTitle(unit) { return displayName(unit) }
function merge() {
  if (!result.value || !affordable.value) return
  const before = { ...leader.value }, other = displayName(donor.value), id = kind.value
  if (!props.applyMerge(before.id, donor.value.id, id)) return
  const after = props.game.allies.find(unit => unit.id === before.id)
  receipt.value = { unit: { ...after }, name: unitTitle(after), from: displayName(before), other,
    profession: id==='profession', stats: statRows(before, after) }
  picker.value = ''
  nextTick(() => continueButton.value?.focus())
}
</script>

<template>
  <header class="forge-header">
    <div><h2 id="forge-title">军团工坊</h2><p>第 {{ game.wave }} 波营地 <span>·</span> {{ game.allies.length }} 名在营 <span>·</span> {{ game.gold }} 金币</p></div>
  </header>
  <nav class="forge-modes" aria-label="工坊操作">
    <button class="key-tab" v-for="item in [['promote','同兵升星'], ['fusion','双兵融合'], ['ascend','品质融合'], ['roster','军团名册']]" :key="item[0]"
      :class="{ active: pane === item[0] }" :aria-pressed="pane === item[0]" @click="setPane(item[0])"><KeyMark :name="item[0]==='roster'?'allies':'forge'"/>{{ item[1] }}</button>
  </nav>

  <section v-if="receipt" class="forge-receipt" aria-live="polite" :style="{ '--accent': receipt.recipe?.color || '#edce8f' }">
    <p class="forge-kicker">{{ receipt.ascended ? '品质晋升' : receipt.profession ? '职业融合完成' : '升星完成' }}</p>
    <div class="receipt-hero"><PixelSprite v-bind="portrait(receipt.unit)" :label="receipt.name"/></div>
    <div class="forge-stars">{{ grade(receipt.unit) }}</div><h3>{{ receipt.name }}</h3>
    <p>{{ receipt.from }} 已与 {{ receipt.other }} 合编。</p>
    <p v-if="receipt.unit.fusionJobs" class="forge-skill"><b>{{ fusionProfessionNames(receipt.unit).join(' ＋ ') }}</b>　各职业能力已保留，可继续融合其他职业。</p>
    <div class="forge-stats"><span v-for="stat in receipt.stats" :key="stat.label">{{ stat.label }} <del>{{ stat.before }}</del> → <b>{{ stat.after }}</b></span></div>
    <div class="forge-receipt-actions"><button class="secondary-button key-ink" @click="emit('close')"><KeyMark name="return"/>返回手牌</button><button ref="continueButton" class="gold-button key-command" @click="receipt = null"><KeyMark name="forge"/>继续整编</button></div>
  </section>

  <section v-else-if="pane==='ascend'" class="forge-roster ascension-pane">
    <p>两名传说合成神话，两名神话合成棱彩。兵系与星级可以不同，锁定的士兵可以接收融合。</p>
    <div v-if="game.reserves.length" class="reserve-list"><h4>候补席</h4>
      <div v-for="unit in game.reserves" :key="unit.id"><PixelSprite v-bind="portrait(unit)"/><span>{{ displayName(unit) }} · {{ gradeOf(unit).name }}</span>
        <button class="key-ticket" :disabled="game.allies.length>=FIELD_LIMIT" @click="emit('field-reserve',unit.id)">{{ game.allies.length>=FIELD_LIMIT?'阵位已满':'上阵' }}</button></div>
    </div>
    <template v-if="ascendPair && ascension">
      <label>选择保留者与副手
        <select @change="ascendKey=$event.target.value" class="key-select" :value="ascendPair.leader.id+'/'+ascendPair.donor.id">
          <option v-for="p in pairs.ascend" :key="p.leader.id+'/'+p.donor.id" :value="p.leader.id+'/'+p.donor.id">保留 {{ displayName(p.leader) }}{{ game.reserves.includes(p.leader) ? '（候补）' : '' }} #{{ p.leader.id.split('-').pop() }} ← {{ displayName(p.donor) }}{{ game.reserves.includes(p.donor) ? '（候补）' : '' }} #{{ p.donor.id.split('-').pop() }}</option>
        </select>
      </label>
      <div class="ascend-preview" :style="{'--quality':QUALITIES[ascension.grade].color}"><PixelSprite v-bind="portrait({...ascendPair.leader,grade:ascension.grade})"/>
        <div><small>融合结果</small><h3>{{ displayName(ascendPair.leader) }}</h3><span>{{ QUALITIES[ascension.grade].name }} · {{ '★'.repeat(ascension.level) }} · {{ ascension.trainingXp }} 经验</span></div>
      <button class="key-command" @click="ascend"><KeyMark name="forge"/>免费融合为{{ QUALITIES[ascension.grade].name }}</button>
      </div>
      <div class="forge-stats"><span v-for="stat in statRows(ascendPair.leader,ascension)" :key="stat.label">{{ stat.label }} <del>{{ stat.before }}</del> → <b>{{ stat.after }}</b></span></div>
      <MergeWarning v-if="ascendWarning" :warning="ascendWarning"/>
    </template>
    <p v-else class="forge-note">需要两名同品质的传说或神话，副手需解锁。候补席的成员也可互相融合。战阵中也可将副手直接拖到保留者身上。</p>
  </section>

  <section v-else-if="pane === 'roster'" class="forge-roster">
    <p v-if="!game.allies.length" class="forge-note">打出手牌后，可以在这里为新兵升星或融合。</p>
    <template v-else>
      <h3>在营成员</h3>
      <div class="forge-members"><button class="key-ticket" v-for="unit in game.allies" :key="unit.id" :class="{ active: unit.id === chosenId }"
        :aria-pressed="unit.id === chosenId" @click="chosenId = unit.id"><PixelSprite v-bind="portrait(unit)"/><span>{{ unit.locked?'已锁 · ':'' }}{{ unitTitle(unit) }}<small>{{ secondaryIdentity(unit) }} · {{ grade(unit) }} {{ unit.command ? '统领' : '' }}</small></span></button></div>
      <div v-if="inspected" class="forge-service">
        <SoldierSheet :unit="inspected" :champion="game.champion" @lock="id=>emit('lock',id)" @champion="id=>emit('champion',id)"/>
        <p v-if="serving">现任{{ serving.command === 'guard' ? '壁垒' : '先遣' }}统领 · {{ unitTitle(serving) }}</p>
        <template v-else-if="inspected.level >= 2"><p>本波可任命一位统领，任期持续到阵亡或波末。</p><div class="forge-appointments">
          <button class="secondary-button key-ink" @click="emit('commission', inspected.id, 'guard')"><KeyMark name="allies"/>任命壁垒 · 生命上限 +40%</button>
          <button class="secondary-button key-ink" @click="emit('commission', inspected.id, 'assault')"><KeyMark name="allies"/>任命先遣 · 攻击与治疗 +30%</button>
        </div></template><p v-else>成员升至二星后可担任统领。</p>
      </div>
    </template>
  </section>

  <div v-else class="forge-body">
    <aside class="forge-index" aria-label="选择主兵职业">
      <h3>选择主兵职业 <small>{{ isFusion ? '12 职业 · 66 种两两组合' : '同职业、同星级' }}</small></h3>
      <div class="forge-grid">
        <button v-for="job in professionChoices" :key="job.id" class="forge-tile key-ticket"
          :class="{active:role===job.id,ready:availableFor(job.id)}" :aria-pressed="role===job.id" @click="selectRole(job.id)">
          <PixelSprite v-bind="professionPortrait(job)"/><span>{{ job.name }}<small>{{ availableFor(job.id) ? (isFusion ? '可融合' : '可升星') : isFusion ? '需不同职业副手' : '需同星两名' }}</small></span>
        </button>
      </div>
    </aside>
    <section class="forge-bench">
      <div class="forge-bench-scroll" tabindex="0" aria-label="融合预览与职业能力">
      <div class="forge-subhead"><h3>{{ outputName }}</h3><small>{{ isFusion ? '保留主兵身份与星级' : '同职业 · 最高三星' }}</small></div>
      <p class="forge-note">{{ isFusion ? '不同职业，一星即可融合。保留经验与能力，属性继承比例见下方材料预览；融合兵可继续融合其他职业。同族的刀兵、枪兵与骑兵也能互相融合。' : '两名同职业、同星士兵合编。主将升一星并按预览比例继承副手属性，保留双方已经学会的能力。' }}</p>
      <div class="forge-formula">
        <template v-for="(slot,index) in sourceList" :key="slot.label">
          <span v-if="index" class="forge-sign" aria-hidden="true">＋</span>
          <button class="forge-source key-ticket" :disabled="!slot.available" :aria-expanded="picker===slot.label" @click="picker=picker===slot.label?'':slot.label">
            <small>{{ slot.label }}<span v-if="slot.available">⌄</span></small><PixelSprite v-bind="portrait(slot.unit,slot.type)"/>
            <b>{{ slot.unit ? displayName(slot.unit) : (index ? '选择副手' : selectedProfession.name) }}</b><em>{{ slot.unit ? professionName(slot.unit)+' · '+grade(slot.unit) : (isFusion ? '一星即可' : '需要同职业同星') }}</em>
          </button>
        </template>
        <span class="forge-sign" aria-hidden="true">→</span>
        <div class="forge-outcome"><small>融合结果</small><PixelSprite v-bind="portrait(previewUnit,selectedProfession.type)"/><b>{{ outputName }}</b><em>{{ result ? '★'.repeat(result.level) : isFusion ? '保留主兵星级' : '升一星' }}</em></div>
      </div>
      <div v-if="picker" class="forge-picker">
        <strong>{{ picker }} · 选择成员</strong>
        <button class="key-ink" v-for="unit in (picker==='保留主将'?leaders:donors)" :key="unit.id" @click="chooseSlot(unit)"><KeyMark name="allies"/>
          {{ displayName(unit) }} · {{ professionName(unit) }} · {{ grade(unit) }} · 攻 {{ unit.atk }} · 血 {{ Math.ceil(unit.hp) }} · #{{ unit.id.split('-').pop() }}
        </button>
      </div>
      <ActionPreview v-if="previewUnit" :unit="previewUnit" :title="outputName" class="forge-performance"/>
      <div v-if="isFusion && inheritedJobs.length" class="forge-skill forge-inherited"><b>融合后的职业能力</b>
        <p v-for="job in inheritedJobs" :key="job.name"><strong>{{ job.name }} · {{ job.skill }}</strong> {{ job.text }}</p>
      </div>
      <div v-if="result" class="forge-stats"><span v-for="stat in stats" :key="stat.label">{{ stat.label }} <del>{{ stat.before }}</del> → <b>{{ stat.after }}</b></span></div>
      </div>
      <footer class="forge-commit"><div class="forge-warning-stack"><MergeWarning v-if="consumptionWarning" compact :warning="consumptionWarning"/><small v-else>{{ isFusion ? '职业融合消耗副兵，保留主兵身份与品质；选定两人后可查看实际继承属性。' : '升星消耗一名同职业同星副兵，保留主兵品质；选定两人后可查看实际继承比例。' }}上锁的士兵不能作为材料。</small></div>
        <button class="gold-button key-command" :disabled="!result || !affordable" @click="merge"><KeyMark name="forge"/>{{ !result ? '材料未齐' : !affordable ? '还缺 '+(price-game.gold)+' 金币' : isFusion ? '消耗副兵并融合' : '消耗副兵升至'+result.level+'星' }}<small class="forge-price">{{ isFusion ? price+' 金币' : '免费' }}</small></button>
      </footer>
    </section>
  </div>
</template>
<style scoped>
.forge-warning-stack{min-width:0;flex:1}.forge-warning-stack>small{display:block}.forge-warning-stack .merge-warning{margin:0}
</style>
