<script setup>
import PixelSprite from './PixelSprite.vue'
import KeyMark from './KeyMark.vue'
defineProps({ actor: { type: Object, required: true } })
</script>

<template>
  <button type="button" class="deal-start signed-hand key-hand">
    <span class="signed-portrait" aria-hidden="true">
      <PixelSprite atlas="performer-avatars" :frame="actor.avatarFrame" :columns="3" :rows="2"/>
    </span>
    <span class="deal-label"><slot/></span>
    <KeyMark name="order"/>
  </button>
</template>

<style scoped>
.signed-hand {
  position: relative; display: inline-flex; align-items: center; gap: 12px;
  padding: 5px 13px 5px 6px; color: #4a2831; background: transparent;
  border: 3px solid transparent; border-image: var(--control-ticket) 18 46 fill / 7px 12px / 0 stretch; border-radius: 5px 2px 5px 2px;
  box-shadow: -2px 3px #765143, -3px 5px #bb9979, -5px 7px 6px #110c1480;
  transform: rotate(-2deg); cursor: pointer; touch-action: manipulation;
  font: 900 19px/1.2 'Songti SC','STSong',serif; letter-spacing: .04em;
}
.signed-portrait { width: 47px; height: 47px; border: 2px solid #976d58; background: #352831; }
.signed-portrait canvas { width: 100%; height: 100%; image-rendering: pixelated; }
.signed-hand .key-mark { width: 29px; height: 29px; }
.signed-hand:focus-visible { outline: 2px solid #ffedb6; outline-offset: 4px; }
@media (hover:hover) { .signed-hand:hover { filter: brightness(1.1); } }
@media (prefers-reduced-motion:no-preference) {
  .signed-hand { transition: transform 130ms ease-out; }
  .signed-hand:hover { transform: translateY(-2px) rotate(0deg); }
  .signed-hand:active { transform: translateY(1px) rotate(-1deg); }
}
@media (max-width:760px) {
  .signed-hand { font-size: 16px; gap: 8px; }
  .signed-portrait { width: 34px; height: 34px; }
}
</style>
