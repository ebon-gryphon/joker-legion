<script setup>
import KeyMark from './KeyMark.vue'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { performanceOf } from './performance.js'
import { MATERIALS } from './combatAudio.js'
import { actionPose, walkingPose, restingPose, paintGesture, paintMissile } from './choreography.js'
import { drawCardSprite, loadFactionAtlases } from './spriteAtlas.js'

const props = defineProps({ unit: {type:Object,required:true}, title: String })
const {audio,sound,toggleSound,reducedMotion} = inject('legionAudio')
const canvas=ref(null), mode=ref('idle'), active=ref(false), slow=ref(false)
const profile=computed(()=>performanceOf(props.unit,['idle','walk','hit'].includes(mode.value)?'attack':mode.value))
const labels={idle:'待机',walk:'行走',hit:'受击',pulse:'震荡',attack:'攻击',heal:'治疗',skill:'战技',toll:'召唤援军',bombard:'轰击'}
const modes=computed(()=>{
  const basic=['idle','walk','hit']
  if(props.unit.fusion) return [...basic,'attack','skill']
  if(props.unit.type==='healer') return [...basic,'attack','heal']
  if(props.unit.type==='bellkeeper') return [...basic,'attack','toll']
  if(props.unit.type==='finalBoss') return [...basic,'attack','bombard','pulse']
  if(props.unit.type==='boss') return [...basic,'attack','bombard']
  return [...basic,'attack']
})
let frame=0, start=0, sounded=false, subscription
function paint(now=performance.now()) {
  const c=canvas.value?.getContext('2d'), p=profile.value
  if (!c || !p) return
  const t=active.value?(now-start)/(slow.value?2000:1000):-1
  const enemy=props.unit.side==='enemy', dir=enemy?-1:1
  const ranged=props.unit.fusion || ['ranger','mage','healer','archer','warlock','bellkeeper'].includes(props.unit.type)
  const clock=(now-start)/(slow.value?2000:1000)
  const action=['idle','walk','hit'].includes(mode.value)?null:actionPose(p,t,mode.value,reducedMotion.value)
  const pose=mode.value==='walk'?walkingPose(p,clock,0,reducedMotion.value):mode.value==='hit'?restingPose(p,clock,0,Math.max(0,.2-clock),reducedMotion.value):action || restingPose(p,clock,0,0,reducedMotion.value)
  const x=enemy?124:67, foot=100, h=['boss','finalBoss'].includes(props.unit.type)?81:75
  c.clearRect(0,0,192,110);c.imageSmoothingEnabled=false
  c.fillStyle='#201a2b';c.fillRect(0,99,192,11)
  c.fillStyle='#463848';c.fillRect(8,98,176,1)
  c.fillStyle='#13111b';c.fillRect(x-22,98,44,3)
  const travel=ranged ? .17 : 0
  const targetX=x+dir*(ranged?87:43)
  const age=t-p.windup-travel, hit=active.value && age>=0 && age<.23
  const swing=hit && !reducedMotion.value ? Math.sin(Math.PI*age/.23)*(1-age/.23) : 0
  const friendly=mode.value==='heal' || ['paladin','bard'].includes(props.unit.fusion)
  if(friendly) {
    drawCardSprite(c,{suit:'♠',rank:'2'},targetX-13,foot-38,27,38,{flip:!enemy})
    if(hit) { c.fillStyle='#ffb3b0';c.fillRect(targetX,52-swing*5,2,8);c.fillRect(targetX-3,55-swing*5,8,2) }
  } else {
    c.save();c.translate(targetX,foot);c.transform(1,0,-dir*swing*.15,1,0,0)
    c.fillStyle='#56444b';c.fillRect(-7,-3,15,3);c.fillStyle='#977359';c.fillRect(-2,-36,5,34)
    c.fillStyle='#46373d';c.fillRect(-10,-51,20,27);c.fillStyle='#a48963';c.fillRect(-8,-49,16,22)
    c.fillStyle=hit?'#f4d4a1':'#885d52';c.fillRect(-8,-40,16,4);c.fillRect(-2,-47,4,18)
    c.restore()
  }
  drawCardSprite(c,props.unit,x-38,foot-h,76,h,{combat:true,flip:enemy,pose})
  if (action) paintGesture(c,p,action,x,foot,h,dir)
  if(ranged && t>=p.windup && t<p.windup+travel && !reducedMotion.value) {
    paintMissile(c,p,mode.value,x+dir*10,65,targetX,62,(t-p.windup)/travel)
  }
}
function stop() {
  if(active.value) audio.stopPreview()
  active.value=false;sounded=false
}
function run(kind) {
  stop();mode.value=kind;start=performance.now();active.value=true
  if(!['idle','walk','hit'].includes(kind))audio.unlock()
}
function animate(now) {
  if(document.hidden){frame=0;return}
  const t=(now-start)/(slow.value?2000:1000),p=profile.value
  const isAction=!['idle','walk','hit'].includes(mode.value)
  if(active.value && isAction && !sounded && t>=p.windup){audio.previewAction(p,mode.value);sounded=true}
  if(active.value && (isAction && t>p.windup+p.release+.5 || mode.value==='hit' && t>.6)){
    active.value=false;mode.value='idle';start=now
  }
  paint(now);frame=requestAnimationFrame(animate)
}
function hide(){if(document.hidden){stop();cancelAnimationFrame(frame);frame=0}else if(!frame){start=performance.now();frame=requestAnimationFrame(animate)}}
watch(()=>props.unit,()=>{stop();mode.value='idle';start=performance.now();paint()})
onMounted(()=>{start=performance.now();subscription=loadFactionAtlases(()=>paint());frame=requestAnimationFrame(animate);document.addEventListener('visibilitychange',hide)})
onBeforeUnmount(()=>{stop();cancelAnimationFrame(frame);subscription?.dispose();document.removeEventListener('visibilitychange',hide)})
</script>
<template>
  <section class="action-preview" :aria-label="(title || '') + '动作演示'">
    <div class="action-theatre">
      <canvas ref="canvas" width="192" height="110" :aria-label="(title || '') + '像素动作'"></canvas>
      <slot/>
    </div>
    <div class="action-caption"><strong>{{ ['idle','walk','hit'].includes(mode) ? labels[mode] : profile.name }}</strong><small>{{ mode==='heal' ? '治疗 · ' : '' }}{{ MATERIALS[profile.material].label }}</small></div>
    <div class="action-controls">
      <button class="key-tab" v-for="kind in modes" :key="kind" @click="run(kind)" :aria-label="'演示'+labels[kind]" :aria-pressed="mode===kind"><KeyMark :name="kind==='skill'?'trick':'allies'"/>▷ {{ labels[kind] }}</button>
      <button class="key-tab" :aria-pressed="slow" @click="stop();slow=!slow;start=performance.now();paint()"><KeyMark name="time"/>慢放 ½×</button>
      <button class="preview-sound key-tab" @click="toggleSound" :aria-label="sound?'演示静音':'开启演示声音'" :aria-pressed="sound">{{ sound?'有声':'静音' }}</button>
    </div>
  </section>
</template>
<style scoped>
.action-preview{min-width:0;width:100%;color:#ead7d5}
.action-theatre{position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(ellipse at 48% 78%,#403046,#211a2a 65%);border:1px solid #675169}
.action-theatre canvas{display:block;width:100%;height:clamp(94px,16vh,165px);image-rendering:pixelated;object-fit:contain}
.action-caption,.action-controls{display:flex;align-items:center;flex-wrap:wrap;gap:5px 9px;margin-top:6px}
.action-caption strong{font:700 14px var(--serif);color:#f1d39e}.action-caption small{color:#c9b6d0;font-size:11px}
.action-controls button{background:#302536;border:1px solid #816a7e;color:#e9d8c8;cursor:pointer;padding:4px 9px;font:inherit;font-size:12px;min-height:26px}
.action-controls button[aria-pressed=true]:not(.preview-sound){background:#59414b;border-color:#dbb482}
.action-controls .preview-sound{margin-left:auto;color:#c7b7cc;font-size:11px}
</style>
