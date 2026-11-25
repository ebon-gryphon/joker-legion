<script setup>
import KeyMark from './KeyMark.vue'
const emit = defineEmits(['close','book'])
</script>

<template>
  <button class="modal-close key-close" aria-label="关闭玩法指南" @click="emit('close')"><KeyMark name="close"/></button>
  <h2 id="help-title">怎样带军团出战</h2>
  <div class="help-grid">
    <details class="ui-card manual-topic" open><summary class="key-disclosure">先打一手牌</summary><p>每波起手八张，自选一至五张。按「提示」才会选牌。每手招一名对应兵种，计分越高，品级保底越高。高牌也有机会出传说。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">把军令用在出战前</summary><p>战前有三次出牌机会，第一次加购花四金。最多上阵五人。开战时两军整队入场，自动交锋。无尽第十三波起面对 12 至 16 名混编精英，新兵与训练的波次成长逐渐放缓。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">养一位主将</summary><p>点战阵里的兵可看当前数值，也可立为主将并上锁。拖到左侧布阵区可自由换位，拖到主将身上停留至出现传授提示后松手，可传授经验并获一次晋升进度。主将活着守住一波也算一次，累计两次升二星，五次升三星。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">吞噬与品质融合</summary><p>参战归营获得 1 经验。拖副手给另一名士兵可继承经验，跨职业还能习得传承技。不同职业拖合花 5 金，主兵保留身份与星级，继承副兵永久基础属性和职业能力，具体份额见工坊预览。同职业仍可吞噬培养，或在工坊同星合编升星。两名传说直接拖合可得神话，两名神话可得棱彩。工坊的「品质融合」可预览结果，满编时招来的传说也可在候补席互融。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">红心是玩家生命</summary><p>标准以 12 生命开局，险境为 8。每名普通敌人突破或超时残留损失 1 生命。降到 0 仍可继续，但不能再放入任何敌人；0 生命时再漏一名才结束远征。首领突破或超时仍存活会直接结束远征。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">逛小丑商店</summary><p>每批三个货位，购买与刷新消耗蓝水晶，出售返还蓝水晶。金币用于加购、换牌、改印、研习与职业融合。独有搭档每种一件，叠层道具按件累加，消耗品每次触发只用一件。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">战后怎样归队</summary><p>只要本波守住，倒下的正式士兵也会满血归队，保留经验、星级和融合职业。标准远征前十一波先免费三选一，再进入商店，第十二波直接胜利。无尽挑战每次守波都有三选一与商店，可在战后主动归营。</p></details>
    <details class="ui-card manual-topic"><summary class="key-disclosure">积累本局构筑</summary><p>36 项补给中包括 12 项唯一构筑被动。按完整合法池权重抽取三项，不保证每个方向各有一项。被动可改变连打牌型、军令返还、战团能力、主将与融合培养；手册和战报只展示实际获得的被动与触发记录。</p></details>
  </div>
  <div class="hand-rules"><p>标准远征共十二波，无尽每过六波再遇首领。两种模式均在第六波迎战无冕之王，第十二波迎战缀命皇后。前两波按战前单手最高分截车。40 分取轻车，100 分取重车。鸣钟使会召唤可被击退的流寇援军，战前打过对子或更高牌型可自动打断首次召唤。</p>
    <button class="secondary-button key-ink" @click="emit('book')"><KeyMark name="book"/>查看十二种牌型</button></div>
  <button class="gold-button key-command" @click="emit('close')"><KeyMark name="return"/>回到军团</button>
</template>
