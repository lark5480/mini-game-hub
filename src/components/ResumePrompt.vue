<template>
  <Transition name="resume">
    <div v-if="visible" class="resume-overlay">
      <div v-if="countingDown" class="resume-box countdown-box">
        <div class="countdown-num" :key="countdownNum">{{ countdownNum }}</div>
      </div>
      <div v-else class="resume-box">
        <div class="resume-icon">🔄</div>
        <h3>发现上局进度</h3>
        <p>要继续上一局，还是开始新游戏？</p>
        <div class="resume-actions">
          <button class="continue-btn" @click="startCountdown">继续上局</button>
          <button class="new-btn" @click="$emit('new-game')">重新开始</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { usePauseCountdown } from '@/composables/useGamePause'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ continue: []; 'new-game': [] }>()

const countingDown = ref(false)
const countdownNum = ref(3)
let timer: ReturnType<typeof setTimeout> | null = null

// 注册取消回调给 useGamePause（P/Esc 可中断倒计时）
const { setCounting } = usePauseCountdown(cancelCountdown)

function cancelCountdown() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  countingDown.value = false
  countdownNum.value = 3
  setCounting(false)
}

function startCountdown() {
  countingDown.value = true
  countdownNum.value = 3
  setCounting(true)
  tick()
}

function tick() {
  timer = setTimeout(() => {
    if (countdownNum.value > 1) {
      countdownNum.value--
      tick()
    } else {
      // 倒计时结束
      countingDown.value = false
      countdownNum.value = 3
      timer = null
      setCounting(false)
      emit('continue')
    }
  }, 1000)
}

// visible 变 false 时（外部关闭）清理倒计时
watch(() => props.visible, (v) => {
  if (!v) cancelCountdown()
})

onUnmounted(() => cancelCountdown())
</script>

<style scoped>
.resume-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 260;
  padding: max(24px, env(safe-area-inset-top) + 16px) 20px max(24px, env(safe-area-inset-bottom) + 16px);
}

.resume-enter-active {
  animation: overlay-in 0.2s ease-out;
}
.resume-enter-active .resume-box {
  animation: dialog-in 0.25s ease-out;
}
.resume-leave-active {
  animation: overlay-out 0.15s ease-in;
}
.resume-leave-active .resume-box {
  animation: dialog-out 0.15s ease-in;
}

.resume-box {
  text-align: center;
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 1px solid color-mix(in srgb, var(--game-accent, #00FFFF) 30%, transparent);
  border-radius: 20px;
  padding: clamp(28px, 7vw, 40px) clamp(22px, 6vw, 50px);
  max-width: calc(100vw - 40px);
  width: auto;
  box-shadow: 0 0 50px color-mix(in srgb, var(--game-accent, #00FFFF) 20%, transparent);
}

.resume-icon {
  font-size: 2.2em;
  margin-bottom: 8px;
}

.resume-box h3 {
  color: #fff;
  font-size: 1.6em;
  margin-bottom: 10px;
}

.resume-box p {
  color: var(--game-text-info);
  margin-bottom: 24px;
}

.resume-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.continue-btn,
.new-btn {
  padding: 12px 28px;
  font-size: 1em;
  font-weight: 600;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.continue-btn {
  background: linear-gradient(135deg, var(--game-accent, #00FFFF), #818CF8);
  color: #0D0D1A;
}

.new-btn {
  background: transparent;
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
}

.continue-btn:hover {
  transform: scale(1.04);
  box-shadow: 0 0 18px color-mix(in srgb, var(--game-accent, #00FFFF) 40%, transparent);
}

.new-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--game-accent, #00FFFF);
}

/* ---- 倒计时数字 ---- */
.countdown-box {
  padding: 50px 60px;
  min-width: 180px;
}

.countdown-num {
  font-size: 5em;
  font-weight: 800;
  color: var(--game-accent, #00FFFF);
  text-shadow:
    0 0 30px color-mix(in srgb, var(--game-accent, #00FFFF) 60%, transparent),
    0 0 60px color-mix(in srgb, var(--game-accent, #00FFFF) 30%, transparent);
  animation: countdownTick 0.85s ease-out;
  line-height: 1;
}
</style>
