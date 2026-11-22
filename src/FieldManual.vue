<script setup>
import KeyMark from './KeyMark.vue'
const emit = defineEmits(['close','book'])
</script>

<template>
  <button class="modal-close key-close" aria-label="关闭玩法指南" @click="emit('close')"><KeyMark name="close"/></button>
  <h2 id="help-title">怎样带军团出战</h2>
  <div class="help-grid">
    <article><h3>先打一手牌</h3><p>每波起手八张，自选一至五张。按「提示」才会选牌。每手招一名对应兵种，计分越高，品级保底越高。高牌也有机会出传说。</p></article>
    <article><h3>把军令用在出战前</h3><p>战前有三次出牌机会，第一次加购花四金。最多上阵五人。出战后双方全军入场，自动打到一方退场或时间耗尽。</p></article>
    <article><h3>养一位主将</h3><p>点战阵里的兵可看当前数值，也可立为主将并上锁。拖到左侧布阵区可自由换位，拖到主将身上停留至出现传授提示后松手，可传授经验并获一次晋升进度。主将活着守住一波也算一次，累计两次升二星，五次升三星。</p></article>
    <article><h3>吞噬与品质融合</h3><p>参战归营获得 1 经验。拖副手给另一名士兵可继承经验，跨职业还能习得传承技。不同职业拖合花 5 金，主兵保留身份与星级，合入副兵全部永久基础属性和职业能力。同职业仍可吞噬培养，或在工坊同星合编升星。两名传说直接拖合可得神话，两名神话可得棱彩。工坊的「品质融合」可预览结果，满编时招来的传说也可在候补席互融。</p></article>
    <article><h3>逛小丑商店</h3><p>每批三个货位，购买后原位显示已售出。独有搭档每种一件，标有「可叠加」的道具按件累加，消耗品每次触发只用一件。波次旁的图标可查看持有数量和效果。</p></article>
    <article><h3>战后怎样归队</h3><p>只要城门还有耐久，本波倒下的士兵也会满血归队，保留经验、星级和融合职业。战后先选一份补给，再逛小丑商店。已购搭档在波次旁，牌谱研习在手册里。</p></article>
  </div>
  <div class="hand-rules"><p>远征共十二波，第六波迎战无冕之王，第十二波迎战缀命皇后。前两波按战前单手最高分截车。40 分取轻车，100 分取重车。遇到鸣钟使，战前打过对子或更高牌型可自动打断一次。</p>
    <button class="secondary-button key-ink" @click="emit('book')"><KeyMark name="book"/>查看十二种牌型</button></div>
  <button class="gold-button key-command" @click="emit('close')"><KeyMark name="return"/>回到军团</button>
</template>
