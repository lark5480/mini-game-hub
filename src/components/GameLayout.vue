<template>
  <div class="game-view" :style="{ '--game-accent': accentColor }">
    <div class="game-header">
      <button class="back-btn" @click="$emit('back')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回
      </button>
      <h2>{{ title }}</h2>
      <div class="game-info">
        <span v-for="item in infoItems" :key="item.label">{{ item.label }} {{ item.value }}</span>
      </div>
      <button class="sound-btn" @click="toggleMute" :title="muted ? '开启音效' : '关闭音效'">
        <svg v-if="!muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      </button>
    </div>
    <div class="keyboard-hint" v-if="hints?.length">
      <span v-for="hint in hints" :key="hint">{{ hint }}</span>
    </div>
    <div class="game-container">
      <slot></slot>
    </div>
    <div class="controls-area" v-if="$slots.controls">
      <slot name="controls"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSound } from '@/composables/useSound'

export interface InfoItem {
  label: string
  value: string | number
}

defineProps<{
  title: string
  accentColor: string
  gradientEnd?: string
  hints?: string[]
  infoItems?: InfoItem[]
}>()

defineEmits<{
  back: []
}>()

const { muted, toggleMute } = useSound()
</script>

<style scoped>
.game-view {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(180deg, var(--game-bg-dark) 0%, var(--game-bg-mid) 50%, var(--game-bg-dark) 100%);
  padding: 20px;
  padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  position: relative;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 600px;
  margin: 0 auto 30px;
  color: var(--game-text);
}

.game-header h2 {
  margin: 0;
  font-weight: 600;
  background: linear-gradient(135deg, var(--game-accent), var(--gradient-end, var(--game-accent)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--game-accent);
}

.game-info {
  display: flex;
  gap: 20px;
  font-size: 0.95em;
  color: var(--game-text-info);
}

.sound-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.sound-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--game-accent);
}

.keyboard-hint {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  font-size: 0.85em;
  color: var(--game-text-muted);
}

.keyboard-hint span {
  padding: 4px 12px;
  background: var(--game-btn-bg);
  border-radius: 4px;
}

.game-container {
  max-width: 600px;
  margin: 0 auto;
}

.controls-area {
  max-width: 600px;
  margin: 25px auto 0;
  text-align: center;
}

/* ===== 移动端适配 ===== */
@media (max-width: 640px) {
  .game-view {
    padding: 12px;
    padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  }

  .game-header {
    flex-wrap: wrap;
    justify-content: space-between;
    row-gap: 10px;
    margin-bottom: 18px;
  }

  /* 返回 / 静音按钮留在顶部一行，标题与分数各自占满一行居中 */
  .back-btn { order: 1; }
  .sound-btn { order: 1; }

  .game-header h2 {
    order: 2;
    flex: 1 1 100%;
    text-align: center;
    font-size: 1.5em;
  }

  .game-info {
    order: 3;
    flex: 1 1 100%;
    justify-content: center;
    gap: 16px;
    font-size: 0.9em;
  }

  .controls-area {
    margin-top: 18px;
  }
}
</style>
