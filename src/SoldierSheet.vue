<script setup>
import { computed } from 'vue'
import KeyMark from './KeyMark.vue'
import PixelSprite from './PixelSprite.vue'
import { gradeOf } from './quality.js'
import { jobOf } from './recruitment.js'
import { championProgress, trainingProgress, LESSONS } from './training.js'
import { FUSION_BY_ID } from './forge.js'
import { getSpriteFrame } from './spriteAtlas.js'
import { getCardDesign } from './cardCatalog.js'
import { inheritedProfessionJobs } from './professionFusion.js'
import { displayName, secondaryIdentity } from './soldierIdentity.js'
import { JOBS } from './jobs.js'

const props = defineProps({ unit:{type:Object,required:true}, champion:Object, advanced:{type:Boolean,default:true} })
const emit = defineEmits(['champion','lock'])
const fusion = computed(()=>FUSION_BY_ID[props.unit.fusion])
const profession = computed(()=>jobOf(props.unit))
const quality = computed(()=>gradeOf(props.unit))
const captain = computed(()=>props.unit.id === props.champion?.unitId)
const title = computed(()=>displayName(props.unit))
const inheritedJobs = computed(()=>inheritedProfessionJobs(props.unit).map(id=>JOBS[id]))
const inheritedSkills = computed(()=>(props.unit.fusionSkills || []).filter(id=>id!==props.unit.fusion).map(id=>FUSION_BY_ID[id]))
const training = computed(()=>trainingProgress(props.unit.trainingXp))
const number = value => Math.round(value*10)/10
</script>

<template>
  <article class="soldier-sheet" :style="{'--soldier-ink':quality.color}" aria-label="士兵战前数值">
    <header>
      <PixelSprite class="sheet-portrait" v-bind="getSpriteFrame(unit)"/>
      <div><small>{{ secondaryIdentity(unit) }} · {{ '★'.repeat(unit.level) }}</small>
        <h3>{{ title }}</h3>
        <span>{{ captain ? '主将 · ' : '' }}历练 Lv.{{ training.level }} · {{ unit.trainingXp || 0 }}{{ training.next ? ' / '+training.next : '' }} 经验<template v-if="unit.command"> · {{ unit.command==='guard'?'壁垒':'先遣' }}统领</template></span></div>
    </header>
    <div class="xp-track" aria-hidden="true"><i :style="{width:(training.next ? 100*((unit.trainingXp||0)-training.start)/(training.next-training.start) : 100)+'%'}"></i></div>
    <dl class="soldier-numbers">
      <div><dt>生命</dt><dd>{{ Math.ceil(unit.hp) }} / {{ unit.maxHp }}</dd></div>
      <div><dt>攻击</dt><dd>{{ number(unit.atk) }}</dd></div>
      <div><dt>护盾</dt><dd>{{ Math.ceil(unit.shield || 0) }}</dd></div>
      <div><dt>行动间隔</dt><dd>{{ unit.period.toFixed(2) }} 秒</dd></div>
      <div><dt>射程</dt><dd>{{ number(unit.range) }}</dd></div>
      <div><dt>移速</dt><dd>{{ number(unit.speed) }} / 秒</dd></div>
      <div v-if="unit.heal"><dt>治疗力</dt><dd>{{ number(unit.heal) }}</dd></div>
    </dl>
    <p><b>{{ profession.skill }}</b>　{{ profession.text }}</p>
    <p v-for="job in (advanced ? inheritedJobs : [])" :key="job.name"><b>融合 · {{ job.name }} · {{ job.skill }}</b>　{{ job.text }}</p>
    <p v-if="fusion"><b>{{ fusion.skill }}</b>　{{ fusion.description }}</p>
    <p v-for="skill in (advanced ? inheritedSkills : [])" :key="skill.id"><b>传承战技 · {{ skill.skill }}</b>　{{ skill.description }}</p>
    <p v-if="fusion" class="sheet-source">由 {{ displayName(unit) }}<template v-if="unit.fusionPartner"> 与 {{ getCardDesign(unit.fusionPartner)?.name }}</template>融合</p>
    <p v-if="unit.grade >= 5"><b>{{ quality.name }}号令</b>　每波首次行动，为全军加上自身生命上限 {{ unit.grade === 5 ? 15 : 20 }}% 的护盾。</p>
    <p v-for="type in (advanced ? unit.lessons : [])" :key="type"><b>传承 · {{ LESSONS[type].name }}</b>　{{ LESSONS[type].text }}</p>
    <small v-if="advanced">每次参战归营 +1 经验，吞噬副手可传授经验和职业传承技。</small>
    <small v-if="unit.statBonus">征召加成 +{{ unit.statBonus }}% 已计入属性</small>
    <footer v-if="advanced"><button class="key-ink" :disabled="captain" @click="emit('champion',unit.id)"><KeyMark name="allies"/>{{ captain ? championProgress(champion) : '立为主将' }}</button>
      <button class="key-tab" :aria-pressed="unit.locked" @click="emit('lock',unit.id)">{{ unit.locked ? '已锁定 · 解锁' : '锁定此兵' }}</button></footer>
  </article>
</template>

<style scoped>
.soldier-sheet{color:#ece2ce;font:14px/1.45 system-ui,sans-serif}
.xp-track{height:4px;margin:6px 0;background:#433348}.xp-track i{display:block;height:100%;background:var(--soldier-ink)}
.soldier-sheet header{display:flex;gap:12px;align-items:center;padding-right:30px}
.soldier-sheet .sheet-portrait{width:52px;height:63px;flex:none}
.soldier-sheet header small,.soldier-sheet p b{color:var(--soldier-ink)}
.soldier-sheet header h3{margin:0;color:#ffdfab;font:bold 23px/1.25 var(--serif)}
.soldier-sheet header span,.soldier-sheet>small,.sheet-source{color:#d4c3b1;font-size:12px}
.soldier-numbers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:8px 0;border-block:1px solid #826849;padding:6px 0;gap:5px 10px}
.soldier-numbers dt{color:#cdbba7;font-size:12px}.soldier-numbers dd{margin:0;color:#fff0d0;font-weight:750;font-variant-numeric:tabular-nums}
.soldier-sheet p{margin:5px 0}.soldier-sheet footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.soldier-sheet footer button{min-height:32px;padding:3px 12px}
</style>
