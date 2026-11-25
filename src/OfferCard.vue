<script setup>
import {computed} from 'vue'
const props=defineProps({description:{type:String,default:''}})
const copy=computed(()=>{
  const end=props.description.search(/[。；]/)
  if(end<0 || end===props.description.length-1)return {lead:props.description,rest:''}
  return {lead:props.description.slice(0,end+1),rest:props.description.slice(end+1).trim()}
})
</script>
<template>
  <article class="ui-card offer-card">
    <slot :lead="copy.lead"/>
    <details v-if="copy.rest" class="offer-notes"><summary class="key-disclosure">详细效果</summary><p>{{ copy.rest }}</p></details>
  </article>
</template>
