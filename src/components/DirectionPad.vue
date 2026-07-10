<template>
  <div class="direction-pad" :class="layout">
    <template v-if="layout === 'cross'">
      <div class="pad-row" v-if="showUp">
        <button
          class="pad-btn"
          aria-label="上"
          @pointerdown.prevent="startHold('up')"
          @pointerup="clearHold('up')"
          @pointerleave="clearHold('up')"
          @pointercancel="clearHold('up')"
          @keydown.enter.prevent="emit('up')"
          @keydown.space.prevent="emit('up')"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </div>
      <div class="pad-row">
        <button
          class="pad-btn"
          aria-label="左"
          @pointerdown.prevent="startHold('left')"
          @pointerup="clearHold('left')"
          @pointerleave="clearHold('left')"
          @pointercancel="clearHold('left')"
          @keydown.enter.prevent="emit('left')"
          @keydown.space.prevent="emit('left')"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <button
          v-if="showDown"
          class="pad-btn"
          aria-label="下"
          @pointerdown.prevent="startHold('down')"
          @pointerup="clearHold('down')"
          @pointerleave="clearHold('down')"
          @pointercancel="clearHold('down')"
          @keydown.enter.prevent="emit('down')"
          @keydown.space.prevent="emit('down')"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </button>
        <button
          class="pad-btn"
          aria-label="右"
          @pointerdown.prevent="startHold('right')"
          @pointerup="clearHold('right')"
          @pointerleave="clearHold('right')"
          @pointercancel="clearHold('right')"
          @keydown.enter.prevent="emit('right')"
          @keydown.space.prevent="emit('right')"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </template>
    <template v-else>
      <button
        class="pad-btn"
        aria-label="左"
        @pointerdown.prevent="startHold('left')"
        @pointerup="clearHold('left')"
        @pointerleave="clearHold('left')"
        @pointercancel="clearHold('left')"
        @keydown.enter.prevent="emit('left')"
        @keydown.space.prevent="emit('left')"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <slot name="extra"></slot>
      <button
        class="pad-btn"
        aria-label="右"
        @pointerdown.prevent="startHold('right')"
        @pointerup="clearHold('right')"
        @pointerleave="clearHold('right')"
        @pointercancel="clearHold('right')"
        @keydown.enter.prevent="emit('right')"
        @keydown.space.prevent="emit('right')"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </template>
    <div class="extra-row" v-if="$slots.extra && layout === 'cross'">
      <slot name="extra"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  layout?: 'cross' | 'horizontal'
  showUp?: boolean
  showDown?: boolean
  /** 是否支持按住连续触发（2048 等离散操作游戏可关闭） */
  repeat?: boolean
}>(), {
  layout: 'cross',
  showUp: true,
  showDown: true,
  repeat: true
})

type Dir = 'up' | 'down' | 'left' | 'right'

const emit = defineEmits<{
  (e: 'up' | 'down' | 'left' | 'right'): void
}>()

const REPEAT_MS = 110
const repeatTimers: Partial<Record<Dir, ReturnType<typeof setInterval>>> = {}

function clearHold(dir: Dir) {
  const t = repeatTimers[dir]
  if (t !== undefined) {
    clearInterval(t)
    repeatTimers[dir] = undefined
  }
}

function startHold(dir: Dir) {
  if (repeatTimers[dir] !== undefined) return
  emit(dir)
  // 离散游戏（如 2048）只触发一次；连续游戏按住时按固定频率重复
  if (props.repeat) {
    repeatTimers[dir] = setInterval(() => emit(dir), REPEAT_MS)
  }
}

onBeforeUnmount(() => {
  ;(Object.keys(repeatTimers) as Dir[]).forEach(clearHold)
})
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
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
  /* 触摸时不被浏览器当作滚动/缩放手势 */
  touch-action: none;
}

.pad-btn:hover {
  background: color-mix(in srgb, var(--game-accent) 15%, transparent);
  border-color: var(--game-accent);
  box-shadow: 0 0 15px color-mix(in srgb, var(--game-accent) 20%, transparent);
}

.pad-btn:active {
  background: color-mix(in srgb, var(--game-accent) 30%, transparent);
  border-color: var(--game-accent);
  transform: scale(0.92);
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent) 35%, transparent);
}

@media (max-width: 640px) {
  .pad-btn {
    width: 52px;
    height: 52px;
  }
  .direction-pad {
    gap: 8px;
  }
  .pad-row {
    gap: 8px;
  }
}

.extra-row {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 8px;
}
</style>
