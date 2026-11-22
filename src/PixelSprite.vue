<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { drawCardSprite, isUnitAtlas, loadFactionAtlases, pixelAssetUrl } from './spriteAtlas.js'
const props = defineProps({
  atlas: { type: String, required: true }, frame: { type: Number, default: 0 },
  columns: { type: Number, default: 7 }, rows: { type: Number, default: 2 },
  label: { type: String, default: '' }, fusionJobs: {type:Array,default:()=>[]},
})
const surface = ref(null)
const isFaction = computed(() => isUnitAtlas(props.atlas))
const source = computed(() => pixelAssetUrl(props.atlas))
let image, observer, shared, request = 0, disposed = false
function draw() {
  const canvas = surface.value
  if (!canvas || (!isFaction.value && (!image?.complete || !image.naturalWidth))) return
  const rect = canvas.getBoundingClientRect()
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(1, Math.round(rect.width * scale))
  canvas.height = Math.max(1, Math.round(rect.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (isFaction.value) {
    drawCardSprite(ctx, { atlas: props.atlas, frame: props.frame, fusionJobs:props.fusionJobs }, 0, 0, canvas.width, canvas.height)
    return
  }
  const sw = image.naturalWidth / props.columns, sh = image.naturalHeight / props.rows
  const cell = Math.max(0, Math.min(props.columns * props.rows - 1, props.frame))
  const ratio = Math.min(canvas.width / sw, canvas.height / sh)
  const dw = Math.round(sw * ratio), dh = Math.round(sh * ratio)
  ctx.drawImage(image, cell % props.columns * sw + 2, Math.floor(cell / props.columns) * sh + 2, sw - 4, sh - 4, Math.round((canvas.width - dw) / 2), Math.round((canvas.height - dh) / 2), dw, dh)
}
async function load() {
  if (isFaction.value) { shared ??= loadFactionAtlases(draw); draw(); return }
  const token = ++request
  const candidate = new Image()
  candidate.onload = () => { if (token === request && !disposed) { image = candidate; draw() } }
  candidate.onerror = () => { if (token === request) surface.value?.setAttribute('data-load', 'failed') }
  candidate.src = source.value
}
onMounted(() => { disposed = false; load(); observer = new ResizeObserver(draw); observer.observe(surface.value) })
watch(() => [props.frame, props.columns, props.rows, props.fusionJobs], draw)
watch(source, load)
onBeforeUnmount(() => { disposed = true; request++; observer?.disconnect(); shared?.dispose() })
</script>

<template><canvas ref="surface" class="pixel-sprite" :role="label ? 'img' : undefined" :aria-label="label || undefined" :aria-hidden="label ? undefined : true"></canvas></template>
