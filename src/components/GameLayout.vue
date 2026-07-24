<template>
  <div class="game-view" :style="{ '--game-accent': accentColor }">
    <div class="game-header">
      <button class="back-btn" @click="$emit('back')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回
      </button>
      <button v-if="$attrs.onRestart" class="icon-btn restart-btn" @click="handleRestart" title="重新开始">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M8 16H3v5"/>
        </svg>
      </button>
      <h2>{{ title }}</h2>
      <slot name="header-extra"></slot>
      <div class="game-info">
        <span v-for="item in infoItems" :key="item.label" :class="{ 'score-value': item.label === '分数' || item.label === '总分' }">{{ item.label }} {{ item.value }}</span>
        <span v-if="bestScore > 0" class="best-score">最佳 {{ bestScore }}</span>
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
    <div class="tutorial-bubble" v-if="showTutorial">
      <div class="tutorial-content">{{ tutorial }}</div>
      <button class="tutorial-close" @click="dismissTutorial">知道了</button>
    </div>
    <div class="game-container" :class="entrance ? 'entrance-' + entrance : ''">
      <slot></slot>
    </div>
    <div class="controls-area" v-if="$slots.controls">
      <slot name="controls"></slot>
    </div>
    <div v-if="showRestartConfirm" class="confirm-overlay" @click.self="showRestartConfirm = false">
      <div class="confirm-dialog">
        <p>确定重新开始？当前进度会丢失</p>
        <div class="confirm-buttons">
          <button class="cancel-btn" @click="showRestartConfirm = false">取消</button>
          <button class="ok-btn" @click="doRestart">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useAttrs } from 'vue'
import { useRoute } from 'vue-router'
import { useSound } from '@/composables/useSound'
import { useGameStore } from '@/stores/game'

export interface InfoItem {
  label: string
  value: string | number
}

const props = defineProps<{
  title: string
  accentColor: string
  gradientEnd?: string
  hints?: string[]
  infoItems?: InfoItem[]
  confirmRestart?: boolean
  tutorial?: string
  entrance?: string
}>()

defineEmits<{
  back: []
}>()

const { muted, toggleMute } = useSound()
const gameStore = useGameStore()
const route = useRoute()
const attrs = useAttrs()

const gameKey = computed(() => {
  const path = route.path.slice(1)
  return path && path !== 'achievements' ? path : ''
})

const bestScore = computed(() =>
  gameKey.value ? gameStore.getTopScore(gameKey.value) : 0
)

const showRestartConfirm = ref(false)

function handleRestart() {
  if (props.confirmRestart) {
    showRestartConfirm.value = true
  } else {
    ;(attrs.onRestart as (() => void) | undefined)?.()
  }
}

function doRestart() {
  showRestartConfirm.value = false
  ;(attrs.onRestart as (() => void) | undefined)?.()
}

const TUTORIAL_PREFIX = 'game-tutorial-seen-'
const showTutorial = ref(
  !!props.tutorial && readTutorialFlag() !== 'true'
)

function readTutorialFlag(): string | null {
  try {
    return localStorage.getItem(TUTORIAL_PREFIX + gameKey.value)
  } catch {
    // 隐私模式 / 禁用 localStorage 时静默降级
    return null
  }
}

function dismissTutorial() {
  showTutorial.value = false
  if (gameKey.value) {
    try {
      localStorage.setItem(TUTORIAL_PREFIX + gameKey.value, 'true')
    } catch {
      // 隐私模式 / 禁用 localStorage 时静默降级
    }
  }
}
</script>

<style scoped>
.game-view {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(180deg, var(--game-bg-dark) 0%, var(--game-bg-mid) 50%, var(--game-bg-dark) 100%);
  padding: 20px;
  padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  position: relative;
  /* 防止 accent 光晕(::before inset:-28px)在窄屏超出视口导致横向滚动；
     clip 不建立滚动容器，不影响垂直滚动与 fixed 遮罩 */
  overflow-x: clip;
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
  color: var(--game-accent);
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

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--game-accent);
}

.game-info {
  display: flex;
  gap: 20px;
  font-size: 0.95em;
  color: var(--game-text-info);
}

/* 顶部分数/总分值随各游戏 accent 着色发光——accent 加深渗透的收口（标题/游戏区/暂停遮罩已渗透） */
.game-info .score-value {
  color: var(--game-accent);
  font-weight: 600;
  text-shadow: 0 0 10px color-mix(in srgb, var(--game-accent) 40%, transparent);
}

.best-score {
  color: #FFD700;
  white-space: nowrap;
}

.sound-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
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

.tutorial-bubble {
  max-width: 600px;
  margin: 0 auto 16px;
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: dialog-in 0.3s ease-out;
}

.tutorial-content {
  flex: 1;
  color: var(--game-text-info);
  font-size: 0.9em;
  line-height: 1.5;
}

.tutorial-close {
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.3);
  color: #00FFFF;
  padding: 4px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85em;
  white-space: nowrap;
  transition: all 0.2s;
}

.tutorial-close:hover {
  background: rgba(0, 255, 255, 0.25);
}

.game-container {
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  /* accent 渗透：游戏区一圈主题色柔光 + 细描边，不挤压内容布局 */
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--game-accent) 20%, transparent),
    0 0 30px color-mix(in srgb, var(--game-accent) 12%, transparent);
  /* 进场：淡入 + 轻微放大，随 accent 光色形成每游戏的记忆点；
     prefers-reduced-motion 由 animations.css 全局守卫自动关掉 */
  animation: board-in 0.4s ease-out both;
}

/* ===== 每游戏独特进场（entrance prop 驱动，accent 渗透已存在于 box-shadow/::before）=====
   全部仅用 transform/opacity，无布局影响；keyframes 统一定义在 animations.css。
   未识别的 entrance 类型会回退到默认 board-in（.game-container 基础规则，keyframes 亦在 animations.css）。 */
.game-container.entrance-snake {
  animation: entrance-snake 0.5s cubic-bezier(.22,.8,.3,1) both;
}
.game-container.entrance-tetris {
  animation: entrance-tetris 0.5s ease-out both;
}
.game-container.entrance-breakout {
  animation: entrance-breakout 0.45s ease-out both;
}
.game-container.entrance-catchfruit {
  animation: entrance-catchfruit 0.5s ease-out both;
}
.game-container.entrance-game2048 {
  animation: entrance-game2048 0.45s ease-out both;
}
.game-container.entrance-linkgame {
  animation: entrance-linkgame 0.5s ease-out both;
}
.game-container.entrance-sokoban {
  animation: entrance-sokoban 0.5s cubic-bezier(.22,.8,.3,1) both;
}
.game-container.entrance-whackmole {
  animation: entrance-whackmole 0.55s ease-out both;
}
.game-container.entrance-ttt {
  animation: entrance-ttt 0.5s ease-out both;
}

/* 游戏区背后的主题色光晕：进不同游戏光色不同，形成记忆点 */
.game-container::before {
  content: "";
  position: absolute;
  inset: -28px;
  z-index: -1;
  border-radius: 30px;
  background: radial-gradient(
    65% 55% at 50% 25%,
    color-mix(in srgb, var(--game-accent) 16%, transparent) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.controls-area {
  max-width: 600px;
  margin: 25px auto 0;
  text-align: center;
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.confirm-dialog {
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 30px 40px;
  border-radius: 16px;
  text-align: center;
}

.confirm-dialog p {
  color: var(--game-text);
  margin: 0 0 20px;
  font-size: 1.05em;
}

.confirm-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cancel-btn, .ok-btn {
  padding: 8px 28px;
  border-radius: 20px;
  font-size: 0.95em;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
}

.cancel-btn {
  background: var(--game-btn-bg);
  border-color: var(--game-btn-border);
  color: var(--game-text);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ok-btn {
  background: rgba(255, 0, 110, 0.2);
  border-color: #FF006E;
  color: #FF006E;
}

.ok-btn:hover {
  background: rgba(255, 0, 110, 0.35);
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

  .game-header h2 {
    order: 1;
    flex: 1 1 100%;
    text-align: center;
    font-size: 1.5em;
  }

  .back-btn { order: 2; }
  .restart-btn { order: 2; }
  .sound-btn { order: 2; }

  ::slotted([slot="header-extra"]),
  .header-extra {
    order: 2;
    flex: 1 1 0;
    min-width: 0;
  }

  .game-info {
    order: 2;
    flex: 2 1 0;
    justify-content: center;
    gap: 12px;
    font-size: 0.9em;
    min-width: 0;
  }

  .game-header {
    justify-content: flex-start;
  }

  .controls-area {
    margin-top: 8px;
  }

  .tutorial-bubble {
    margin-left: 0;
    margin-right: 0;
  }
}
</style>
