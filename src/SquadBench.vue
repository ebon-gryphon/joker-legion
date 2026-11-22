<script setup>
import { championProgress } from "./training.js"
import { jobOf } from './recruitment.js'
import {computed,ref,watch} from 'vue'
import DraggedSoldier from './DraggedSoldier.vue'
import PixelSprite from './PixelSprite.vue'
import {getSpriteFrame} from './spriteAtlas.js'
import {drillPreview,FIELD_LIMIT} from './engine.js'
import {ORDER_BOOK} from './orders.js'
import {gradeOf, QUALITIES} from './quality.js'
import {veteranLevel} from './training.js'

const props = defineProps({game:Object})
const emit = defineEmits(['drill','champion','lock'])
const selected = ref(''), hover = ref(''), drag = ref(null)
const chosen = computed(()=>props.game.allies.find(u=>u.id===selected.value))
const staged = computed(()=>drillPreview(props.game,selected.value,hover.value))
const members = computed(()=>props.game.allies.filter(u=>u.hp>0))
const milestones = ['8经验后，K计分可发动御驾亲征','15经验后，每三次行动发动将威','已习得将威 · K计分可亲征']
const title = u=>jobOf(u).name
watch(()=>[props.game.wave, members.value.some(u=>u.id===selected.value)],()=>{ if(!chosen.value) selected.value='' })
function pointed(e) { return document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-soldier]')?.dataset.soldier || '' }
function down(e,id) {
  if (!e.isPrimary || e.button!==0) return
  drag.value={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moving:false,
    touch:e.pointerType==='touch',grip:{width:64,height:72,x:.5,y:.56}}
  e.currentTarget.setPointerCapture(e.pointerId)
}
function move(e) {
  const d=drag.value
  if(!d || d.pointer!==e.pointerId || Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<5 && !d.moving) return
  d.moving=true; d.x=e.clientX; d.y=e.clientY
  selected.value=d.id
  hover.value=pointed(e)
}
function cancel() { drag.value=null; hover.value='' }
function up(e) {
  const d=drag.value
  if (!d || d.pointer!==e.pointerId) return
  if(d.moving && drillPreview(props.game,d.id,pointed(e))) {
    const target=pointed(e)
    emit('drill',d.id,target)
    selected.value=target
  } else if(!d.moving) selected.value=selected.value===d.id?'':d.id
  cancel()
}
</script>
<template>
  <section class="squad-line" aria-label="整编兵位" v-if="members.length || game.champion">
    <DraggedSoldier v-if="drag?.moving && chosen" :unit="chosen" :drag="drag"
      :hint="chosen.locked?'已锁定':staged?.kind==='ascend'?'松手融合 · '+QUALITIES[staged.grade].name:staged?'松手传授 · +'+staged.xp+'经验':''"/>
    <div class="squad-slots">
      <button v-for="u in members" :key="u.id" type="button" class="squad-token key-face" :data-soldier="u.id" :data-lifted="drag?.moving && drag.id===u.id" :data-chosen="selected===u.id" :data-over="hover===u.id && staged ? 'yes':''" :style="{'--ink':u.color}"
        :aria-pressed="selected===u.id" :aria-label="u.name+'，'+title(u)+'，'+u.level+'星，'+gradeOf(u).name+(u.locked?'，已锁定，':'，')+(u.trainingXp||0)+'经验'"
        :title="u.name+' · '+gradeOf(u).name+(u.locked?' · 已锁定':'')+' · '+jobOf(u).text" @pointerdown="down($event,u.id)" @pointermove="move" @pointerup="up" @pointercancel="cancel" @lostpointercapture="cancel" @keydown.esc="cancel" @click="e=>{if(e.detail===0) selected=u.id}">
        <PixelSprite v-bind="getSpriteFrame(u)"/>
        <i v-if="u.locked" class="soldier-padlock" aria-hidden="true"></i><span><strong>{{ u.id===game.champion?.unitId?'♛ ':'' }}{{ u.pattern ? u.name : title(u) }}</strong><small><template v-if="u.grade>=4">{{ gradeOf(u).name }} · </template>{{ u.suit }}{{ u.rank }} · {{ '★'.repeat(u.level) }}</small></span>
      </button>
      <i v-for="n in Math.max(0,FIELD_LIMIT-members.length)" :key="'slot'+n" class="vacancy" aria-hidden="true">◇</i>
    </div>
    <div class="squad-instruction" aria-live="polite">
      <b v-if="staged">{{ staged.text }} · 松手完成</b>
      <template v-else-if="chosen">
        <strong>{{ chosen.name }} · {{ gradeOf(chosen).name }} · 历练{{ veteranLevel(chosen.trainingXp) }}阶 · {{ chosen.trainingXp || 0 }}经验</strong>
        <small v-if="chosen.id===game.champion?.unitId">{{ milestones[chosen.trainingXp<8?0:chosen.trainingXp<15?1:2] }}</small>
        <button class="key-ink" :disabled="game.champion?.unitId===chosen.id" @click="emit('champion',chosen.id)">{{ game.champion?.unitId===chosen.id ? championProgress(game.champion) : '立为主将' }}</button>
        <button class="lock-unit key-tab" :aria-pressed="chosen.locked" @click="emit('lock',chosen.id)">{{ chosen.locked?'已锁定 · 解锁':'锁定此兵' }}</button>
        <select class="key-select" v-if="members.length>1 && !chosen.locked" aria-label="选择并入目标" :value="''" @change="e=>{emit('drill',chosen.id,e.target.value);selected=e.target.value;e.target.value=''}"><option value="" disabled>并入其他兵…</option><option v-for="u in members.filter(m=>m.id!==chosen.id)" :key="u.id" :value="u.id">{{ drillPreview(game,chosen.id,u.id)?.text }}</option></select>
      </template>
      <span v-else-if="game.champion">主将 {{ game.champion.pattern ? ORDER_BOOK[game.champion.pattern].name : game.champion.slot }} · {{ game.champion.xp }}经验 · {{ game.champion.unitId ? championProgress(game.champion) : (game.champion.pattern?'再打此牌型即可归队':'让本命牌计分可归队') }}</span>
      <span v-else>拖副手给目标传授经验与职业传承技；两名传说可融合为神话 · 点兵可锁定或立主将</span>
    </div>
  </section>
</template>
<style scoped>
.squad-token[data-lifted=true] .pixel-sprite{visibility:hidden}
.squad-line{background:linear-gradient(100deg,#292239,#211c2d 70%);border-left:3px solid #c6a16d;padding:5px 8px;color:#eee0c5}
.squad-slots{display:flex;gap:5px;align-items:stretch}.squad-token,.vacancy{flex:1;max-width:130px;min-width:0}
.squad-token{display:flex;gap:3px;align-items:center;text-align:left;cursor:grab;touch-action:none;user-select:none;color:#f2e7d5;background:linear-gradient(125deg,#363044,#201e2a);border:1px solid var(--ink);border-radius:1px 6px 1px 4px;padding:1px 3px;min-height:32px}
.squad-token{position:relative}.soldier-padlock{position:absolute;top:2px;right:3px;width:9px;height:7px;background:#ffda8c;border:1px solid #413342;border-radius:1px}.soldier-padlock::before{content:'';position:absolute;width:5px;height:4px;border:1px solid #ffd88c;border-bottom:0;border-radius:3px 3px 0 0;left:0;top:-5px}.soldier-padlock::after{content:'';position:absolute;left:3px;top:2px;width:1px;height:3px;background:#493337}
.squad-token[data-chosen=true],.squad-token[data-over=yes]{outline:2px solid #f3ce84;outline-offset:-2px;background:#57432e}.squad-token .pixel-sprite{width:28px;height:30px;flex:none}.squad-token span{min-width:0}.squad-token strong,.squad-token small{display:block;white-space:nowrap}.squad-token strong{font-size:11px}.squad-token small,.squad-instruction{font-size:10px;color:#d4c4b2}
.vacancy{display:grid;place-items:center;border:1px dashed #675a71;color:#a18ca4;font-style:normal}.squad-instruction{min-height:17px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:3px}.squad-instruction button,.squad-instruction select{font:inherit;color:#f7dfae;background:#38303f;border:1px solid #9a805b;padding:2px 6px}.squad-instruction b{color:#ffdb8d}
@media(max-width:600px){.squad-token{display:grid;justify-items:center;gap:0}.squad-token .pixel-sprite{width:23px;height:23px}.squad-token span{text-align:center}.squad-token small{font-size:9px}.squad-slots{gap:2px}}
</style>
