<script setup>
defineProps({ name: { type: String, required: true } })
</script>

<template><span class="key-mark" :data-stamp="name" aria-hidden="true"></span></template>
