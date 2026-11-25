<script setup>
import {inject} from 'vue'
import ScoreToggle from './ScoreToggle.vue'
defineProps({enabled:Boolean,speed:Number,tutorial:Boolean})
defineEmits(['presentation','speed','skipTutorial'])
const {sound,toggleSound,reducedMotion,volume,setVolume}=inject('legionAudio')
</script>
<template>
  <div class="ui-settings" aria-label="声音与演出设置">
    <ScoreToggle/>
    <button class="key-ink" :aria-pressed="sound" @click="toggleSound">音效 · {{ sound?'已开启':'已关闭' }}</button>
    <label class="settings-volume"><span>总音量</span><input type="range" min="0" max="100" step="1" :value="volume" @input="setVolume(Number($event.target.value))"/><output>{{ volume }}%</output></label>
    <button class="key-ink presentation-switch" :aria-pressed="enabled" @click="$emit('presentation')">计分与欢呼 · {{ enabled?'已开启':'已关闭' }}</button>
    <button class="key-ink" :aria-pressed="speed===2" @click="$emit('speed')">计分演出速度 · {{ speed }}×</button>
    <small class="ui-muted">减少动态效果 · 随系统{{ reducedMotion?'开启':'关闭' }}</small>
    <button v-if="tutorial" class="key-link" @click="$emit('skipTutorial')">结束引导，开放全部功能</button>
  </div>
</template>
