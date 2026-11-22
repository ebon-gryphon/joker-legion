<script setup>
import PixelSprite from './PixelSprite.vue'
import { enemyFrame } from './enemyCatalog.js'

defineProps({ type: { type: String, required: true }, enraged: Boolean })
</script>

<template>
  <PixelSprite class="enemy-portrait" :atlas="type==='finalBoss'?'queen-motion':'enemies'" :frame="type==='finalBoss'?0:enemyFrame(type, enraged)"/>
</template>

<style scoped>
.enemy-portrait { display: block; image-rendering: pixelated; }
</style>
