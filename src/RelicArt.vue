<script setup>
import { ref, watchEffect } from 'vue'
import PixelSprite from './PixelSprite.vue'
const props = defineProps({item:{type:Object,required:true},frame:Number})
const canvas = ref(null)
const designs = {
  'score-chalk':['..........mm','.........mhm','........mhhm','.......mhms.','......mhms..','.....mhms...','....mhms....','...mhms.....','..mhms......','.msms.......','.sss....hm..','......mm..mm'],
  'pair-ink':['..hhh..hhh..','..sms..sms..','..hms..hms..','.mhhsm.hhsm.','mhhsmsmhhsms','mhssmsmhssms','mmdmmssmmdms','mmhdmssmmhds','mdddsssmddds','.sss...ssss.'],
  'red-thread':['..hhhhhhhh..','.hmmmmmmms..','..sddddds...','..hhmmhhs...','..mmhhmms...','..hhmmhhs...','..mmhhmms...','..hhhhhhsm..','.hmmmmmmmsm.','..ssssssss.m','.........m.m','..........m.'],
  'drill-badge':['....hhhhh...','..hhmmmmmh..','.hmmmmmmmms.','hmmmmmmmmmms','hmmhhhhhmmms','hmhmmdmmhmms','hmmhhhhhmmms','hmmmmmmmmmms','.hmmhmmhmms.','..shshshss..','...h.h.h....','...s.s.s....'],
  'ward-pin':['....hhh.....','..hhmmmhh...','.hmmmmmmmhs.','.hmhhmhmmms.','.hmhmmmhmms.','.hmmhmhmmms.','..hmmhmmms..','...hmmmms...','....hmms....','.....hs.....','.....ms.....','.....s......'],
  'gate-rivet':['....hhhh....','..hhmmmmhh..','.hmmhhhhmms.','.hmhmmmhmms.','.hmhmmdhmms.','.hmmhhhmmss.','..smmmmdss..','...ssmms....','....hmms....','....smhs....','....hmms....','.....ss.....'],
  'field-pay':['....hhhhh...','..hhmmmmmh..','.hmmdhdmmms.','.hmddhddmms.','..hmmdmmms..','..sshhhsss..','.hhmmmmmmhs.','hmmmmhhmmmms','hmhhmmmmhmms','.hmmmmmmmms.','..ssmmmmss..','....ssss....'],
  'score-ticket':['........hhh.','......hhmmhs','....hhmmmhmh','..hhmmhhmmms','.hmmmhmhmmms','hmmhmmdmmhs.','smhmmdmmhs..','.hmmhmhss...','.smhmhs.....','..shhs......','...ss.......'],
  'training-whistle':['.......hhhhh','......hmmmms','...hhhmmmsss','..hmmmhmms..','.hmmddhmms..','hmhdddhmms..','hmmdddmms...','hmmhmmmms...','.hmmmmms....','..sssss.....','..hm........','.ms.........'],
  'black-wax':['....hhhhh...','...hmmmmmhs.','..hmmdddmmhs','.hmmdhhdmmms','.hmmhddhmmms','..hmmddmmms.','...hmmmms...','..hmmmmmmhs.','.hmmmmmmmms.','..ssssssss..'],
  'straight-compass':['.....h......','...hhmhh....','..hmmhmmhs..','.hmmmhmmmhs.','hmmmmhmmmmhs','hmmhhmhhmmms','hmmmmhmmmmms','.hmmmhmmmms.','..hmmhmmss..','...shmhs....','.....s......'],
  'court-seal':['....hhhhh...','....hmmmhs..','....hmhmhs..','....hmmmhs..','.....hmhs...','..hhhmhmhhh.','.hmmmmmmmms.','hmmhhhmhhmms','hmmmmhmmmmms','.hmmmmmmmss.','..ssssssss..'],
  'war-drum':['..hhhhhhhh..','.hmmmmmmmmhs','hmmhhhhhhmms','hmmhddddhmms','hmmhddddhmms','hmmhhhhhhmms','.hmmmmmmmmss','..ssssssss..','.hh......hh.','...hh..hh...','.....hh.....'],
  'healer-brooch':['.....hh.....','....hmmh....','..hhmmmmhh..','.hmmmhhmmms.','.hmmhhhhmms.','.hmmmhhmmms.','..hmmmmmmss.','....hmmss...','.....ss.....'],
  'boss-hunter':['........hh..','.......hmmh.','......hmmmms','.....hmmmms.','....hmmhss..','...hmmhs....','..hmmhs.....','.hmmhs......','hmmhs.......','.hhhs.......','hms.ms......'],
  'iron-rivets':['..hhhhhhhh..','.hmmhmmhmms.','hmmmhhhhmmms','hmmhddddhmms','hmmhddddhmms','hmmmhhhhmmms','.hmmhmmhmms.','..ssssssss..'],
  'supply-satchel':['....hhhh....','...hmddmh...','..hm....mh..','.hhhhhhhhhh.','hmmmmmmmmmms','hmmhhhhhhmms','hmmhmmmmhmms','hmmhmmmmhmms','hmmhhhhhhmms','.hmmmmmmmms.','..ssssssss..'],
  'oath-standard':['.hh.........','.hmhhhhhhhh.','.hmmhmhmmmms','.hmmhhmmmms.','.hmmhmhmmmms','.hmhhhhhhhh.','.hm.........','.hm.........','.hm.........','.hm.........','hhh.........'],
  'midnight-lantern':['.....hh.....','....hmmh....','....hddh....','..hhhhhhhh..','...hddddh...','...hdhhdh...','...hdhhdh...','...hddddh...','..hhhhhhhh..','....ssss....'],
  'revenge-flag':['.hh.........','.hmhhhhhhhh.','.hmmmmhmmmms','.hmmmhhmmms.','.hmmhhhhmms.','.hmmmhhmmms.','.hmhhhhhhhh.','.hm.........','.hm.........','hhh.........'],
  'blade-oil':['....hhhh....','....hmmh....','....hmmh....','...hmmmmh...','..hmmmmmmh..','.hmmhmmmms..','.hmmhhmmms..','.hmmmhmms...','..hmmmmss...','...ssss.....'],
  'ward-flask':['....hhhh....','....hmmh....','....hmmh....','...hddddh...','..hddddddh..','.hddhmmhdds.','.hddmmmmdds.','.hdddmmddds.','..hdddddds..','...ssssss...'],
  'silver-pass':['..hhhhhhhhhh','.hmmmmmmmms.','hmmhhhhhmmms','hmmhdddhmmms','hmmhhhhhmms.','.hmmmmmmmms.','..ssssssss..'],
  'redraw-voucher':['..hhhhhhhh..','.hmmmmmmmms.','hmmhhhhhmmms','hmmhmmmhmms.','hmmhhmhmmms.','hmmmmmhmhms.','.hmmmmmmmms.','..ssssssss..'],
}
watchEffect(() => {
  const rows = designs[props.item.id], node = canvas.value
  if (!node || !rows) return
  const ctx = node.getContext('2d')
  ctx.clearRect(0,0,16,16)
  const colors = {h:'#fff1ca',m:props.item.color,s:'#76566a',d:'#503748'}
  for (const [y,row] of rows.entries()) for (const [x,c] of [...row].entries()) {
    if (colors[c]) { ctx.fillStyle='#261d31';ctx.fillRect(x+1,y+1,3,3) }
  }
  for (const [y,row] of rows.entries()) for (const [x,c] of [...row].entries()) {
    if (colors[c]) { ctx.fillStyle=colors[c];ctx.fillRect(x+2,y+2,1,1) }
  }
})
</script>
<template>
  <canvas v-if="designs[item.id]" ref="canvas" width="16" height="16" class="pixel-sprite relic-glyph" :aria-label="item.name" role="img"/>
  <PixelSprite v-else atlas="relics" :columns="5" :rows="2" :frame="frame" :label="item.name"/>
</template>
<style scoped>.relic-glyph{image-rendering:pixelated;object-fit:contain}</style>
