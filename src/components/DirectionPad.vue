<template>
  <div class="direction-pad" :class="layout">
    <template v-if="layout === 'cross'">
      <div class="pad-row" v-if="showUp">
        <button class="pad-btn" @click="$emit('up')" aria-label="上">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </div>
      <div class="pad-row">
        <button class="pad-btn" @click="$emit('left')" aria-label="左">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <button v-if="showDown" class="pad-btn" @click="$emit('down')" aria-label="下">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </button>
        <button class="pad-btn" @click="$emit('right')" aria-label="右">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </template>
    <template v-else>
      <!-- horizontal 模式 -->
      <button class="pad-btn" @click="$emit('left')" aria-label="左">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <slot name="extra"></slot>
      <button class="pad-btn" @click="$emit('right')" aria-label="右">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </template>
    <div class="extra-row" v-if="$slots.extra && layout === 'cross'">
      <slot name="extra"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  layout?: 'cross' | 'horizontal'
  showUp?: boolean
  showDown?: boolean
}>(), {
  layout: 'cross',
  showUp: true,
  showDown: true
})

defineEmits<{
  up: []
  down: []
  left: []
  right: []
}>()
</script>

<style scoped>
.direction-pad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.direction-pad.horizontal {
  flex-direction: row;
  justify-content: center;
  gap: 20px;
  align-items: center;
}

.pad-row {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.pad-btn {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  border-radius: var(--game-btn-radius);
  color: var(--game-text);
  cursor: pointer;
  transition: all 0.2s;
}

.pad-btn:hover {
  background: color-mix(in srgb, var(--game-accent) 15%, transparent);
  border-color: var(--game-accent);
  box-shadow: 0 0 15px color-mix(in srgb, var(--game-accent) 20%, transparent);
}

.extra-row {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 8px;
}
</style>
