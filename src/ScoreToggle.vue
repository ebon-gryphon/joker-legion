<script setup>
import { inject } from 'vue'
const { musicActive, toggleMusic } = inject('legionAudio')
</script>

<template>
  <button type="button" class="score-toggle key-ink" data-music-switch
    aria-label="背景配乐" :aria-pressed="musicActive" @click="toggleMusic">
    <span aria-hidden="true">♫</span>{{ musicActive ? '配乐开' : '播放配乐' }}
  </button>
</template>

<style scoped>
.score-toggle { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:44px; font-size:13px; white-space:nowrap; }
.score-toggle span { color:#ebc78e; }
</style>
