<script setup>
import { computed } from 'vue'

const props = defineProps({ suit: { type: String, default: '♠' } })

// Integer-aligned masks keep the traditional suit silhouettes consistent across
// browser fonts. Each row contains [left, width] spans on a 16 × 18 pixel grid.
// Spades have one pointed crown; clubs have three round lobes and two notches.
const masks = {
  '♠': [
    [], [7, 2], [6, 4], [5, 6], [4, 8], [3, 10], [2, 12],
    [1, 14], [1, 14], [1, 14], [2, 12], [3, 3, 7, 2, 10, 3],
    [4, 2, 7, 2, 10, 2], [7, 2], [7, 2], [6, 4], [4, 8], [],
  ],
  '♣': [
    [], [7, 2], [5, 6], [4, 8], [4, 8], [5, 6],
    [3, 2, 6, 4, 11, 2], [1, 6, 7, 2, 9, 6],
    [0, 16], [0, 16], [0, 16], [1, 6, 7, 2, 9, 6],
    [3, 2, 7, 2, 11, 2], [7, 2], [7, 2], [6, 4], [4, 8], [],
  ],
  '♥': [
    [], [2, 4, 10, 4], [1, 6, 9, 6], [0, 16], [0, 16],
    [0, 16], [0, 16], [1, 14], [1, 14], [2, 12], [3, 10],
    [4, 8], [5, 6], [6, 4], [7, 2], [], [], [],
  ],
  '♦': [
    [], [7, 2], [6, 4], [5, 6], [4, 8], [3, 10], [2, 12],
    [1, 14], [0, 16], [1, 14], [2, 12], [3, 10], [4, 8],
    [5, 6], [6, 4], [7, 2], [], [],
  ],
}

function asPath(rows) {
  return rows.flatMap((spans, y) => {
    const paths = []
    for (let i = 0; i < spans.length; i += 2) {
      paths.push(`M${spans[i]} ${y}h${spans[i + 1]}v1H${spans[i]}Z`)
    }
    return paths
  }).join('')
}

const paths = Object.fromEntries(Object.entries(masks).map(([suit, rows]) => [suit, asPath(rows)]))
const glyph = computed(() => paths[props.suit] || paths['♠'])
</script>

<template>
  <svg class="suit-mark" viewBox="0 0 16 18" width="16" height="18" shape-rendering="crispEdges" aria-hidden="true" focusable="false" :data-suit="suit">
    <path :d="glyph" fill="currentColor" stroke="none" />
  </svg>
</template>
