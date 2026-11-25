<script setup>defineProps({secondary:Boolean})</script>
<template>
  <button type="button" class="cover-start key-court" :class="secondary?'key-ink':'key-command'"><span aria-hidden="true">♦</span> 开始新局 <span aria-hidden="true">♠</span></button>
</template>

<style scoped>
.cover-start {
  min-width:clamp(154px,17vw,236px); min-height:48px; padding:6px 20px;
  font:900 clamp(18px,2vw,28px)/1.2 'Songti SC','STSong',serif; letter-spacing:.1em;
}
.cover-start span { font: .68em Georgia,serif; }
.cover-start:focus-visible { outline:2px solid #ffe6af; outline-offset:3px; }
</style>
