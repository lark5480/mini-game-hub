<template>
  <div class="score-floats" aria-hidden="true">
    <span
      v-for="p in popups"
      :key="p.id"
      class="score-float"
      :style="{ left: p.x + 'px', top: p.y + 'px' }"
    >{{ p.text }}</span>
  </div>
</template>

<script setup lang="ts">
import type { ScorePopup } from '@/composables/useScoreFloats'

defineProps<{ popups: ScorePopup[] }>()
</script>

<style scoped>
.score-floats {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 10;
}

.score-float {
  position: absolute;
  transform: translate(-50%, -50%);
  font-weight: 700;
  font-size: 1.3em;
  color: #FFD700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
  white-space: nowrap;
  animation: scoreFloatUp 0.8s ease-out forwards;
}
</style>
