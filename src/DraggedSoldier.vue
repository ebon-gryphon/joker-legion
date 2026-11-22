<script setup>
import { computed } from 'vue'
import PixelSprite from './PixelSprite.vue'
import { getSpriteFrame } from './spriteAtlas.js'
import { gradeOf } from './quality.js'

const props = defineProps({unit:{type:Object,required:true},drag:{type:Object,required:true},hint:String})
const position = computed(()=>{
  const d=props.drag, grip=d.grip
  return {left:d.x+'px',top:d.y+'px',width:grip.width+'px',height:grip.height+'px',
    transform:'translate('+(-grip.x*100)+'%, calc('+(-grip.y*100)+'% - '+(d.touch ? 20 : 4)+'px))',
    '--drag-ink':gradeOf(props.unit).color}
})
</script>
<template>
  <Teleport to="body"><div class="dragged-soldier" :style="position" aria-hidden="true">
    <PixelSprite v-bind="getSpriteFrame(unit)"/>
    <span v-if="hint" class="drag-verdict">{{ hint }}</span>
  </div></Teleport>
</template>
<style scoped>
.dragged-soldier{position:fixed;z-index:120;pointer-events:none;user-select:none}
.dragged-soldier .pixel-sprite{width:100%;height:100%;display:block;image-rendering:pixelated;filter:drop-shadow(0 3px 2px #160f20aa)}
.drag-verdict{position:absolute;bottom:calc(100% + 3px);left:50%;width:max-content;max-width:180px;transform:translateX(-50%);text-align:center;color:var(--drag-ink);font:800 13px/1.2 system-ui,sans-serif;paint-order:stroke fill;-webkit-text-stroke:3px #211624}
</style>
