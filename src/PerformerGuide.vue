<script setup>
import KeyMark from './KeyMark.vue'
import { pixelAssetUrl } from './spriteAtlas.js'
defineProps({ actor:{type:Object,required:true}, partner:{type:Object,required:true} })
defineEmits(['close'])
</script>

<template>
  <button class="modal-close key-close" aria-label="关闭角色详情" @click="$emit('close')"><KeyMark name="close"/></button>
  <div class="performer-sheet" :style="{ '--ink':actor.color }">
    <img class="full-portrait" :src="pixelAssetUrl(actor.keyArt,'jpg')" :alt="actor.name+'的选角画'"/>
    <div class="performer-notes">
      <header><small>{{ actor.role }}</small><h2 id="performer-title">{{ actor.name }}</h2></header>
      <section><h3>{{ actor.skill }} <small>{{ actor.timing }} · 每波一次</small></h3><p>{{ actor.rule }}</p></section>
      <section><h3>{{ partner.name }} <small>起始搭档 · 自动生效</small></h3><p>{{ partner.description }}</p></section>
      <section><h3>起手思路</h3><p>{{ actor.opening }}</p></section>
    </div>
    <section class="performer-story" aria-labelledby="story-title">
      <h3 id="story-title"><small>角色故事</small>{{ actor.storyTitle }}</h3>
      <p>{{ actor.story }}</p>
    </section>
  </div>
</template>

<style scoped>
.performer-sheet{display:grid;grid-template-columns:minmax(125px,.72fr) 1.28fr;align-items:center;gap:clamp(16px,3vw,34px);text-align:left}
.full-portrait{width:100%;height:auto;display:block;border:1px solid #8f7458;border-radius:4px}
.performer-notes{display:grid;gap:13px;min-width:0}.performer-notes header{border-bottom:1px solid #745b4f;padding-bottom:8px}
.performer-notes h2,.performer-notes h3,.performer-notes p{margin:0}
.performer-notes h2{font:800 33px/1.25 var(--serif);color:#f1dfbf}.performer-notes h3{font:700 17px/1.5 var(--serif);color:var(--ink)}
.performer-notes small{font:normal 11px/1.5 sans-serif;color:#ceb79a}.performer-notes h3 small{margin-left:4px}
.performer-notes p{color:#e4d6c5;font-size:13px;line-height:1.65}
.performer-notes .company-line{color:var(--ink);font-weight:700}
.performer-story{grid-column:1/-1;clear:both;border-top:1px solid #745b4f;padding-top:14px}
.performer-story h3{display:flex;align-items:baseline;gap:10px;margin:0;color:var(--ink);font:700 19px/1.6 var(--serif)}
.performer-story small{color:#ceb79a;font:normal 12px/1.5 sans-serif}
.performer-story p{margin:6px 0 0;color:#eee0ce;font:400 15px/1.85 var(--serif);text-align:start}
@media(max-width:580px){.performer-sheet{display:block}.full-portrait{float:left;width:70px;margin-right:14px}.performer-notes{display:block}.performer-notes header{min-height:106px;display:grid;align-content:center}.performer-notes section{clear:both;margin-top:12px}}
@media(max-width:580px){.performer-story{margin-top:16px}}
</style>
