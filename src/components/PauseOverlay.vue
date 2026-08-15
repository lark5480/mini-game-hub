<template>
  <Transition name="pause">
    <div v-if="visible" class="pause-overlay">
      <div v-if="countingDown" class="pause-box countdown-box">
        <div class="countdown-num" :key="countdownNum">{{ countdownNum }}</div>
      </div>
      <div v-else class="pause-box">
        <div class="pause-icon">⏸</div>
        <h3>已暂停</h3>
        <button class="resume-btn" @click="startCountdown">继续游戏</button>
        <p class="hint">按 P 或 Esc 继续</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { usePauseCountdown } from '@/composables/useGamePause'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ resume: [] }>()

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
      emit('resume')
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
.pause-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 250;
  padding: max(24px, env(safe-area-inset-top) + 16px) 20px max(24px, env(safe-area-inset-bottom) + 16px);
}

.pause-enter-active {
  animation: overlay-in 0.2s ease-out;
}
.pause-enter-active .pause-box {
  animation: dialog-in 0.25s ease-out;
}
.pause-leave-active {
  animation: overlay-out 0.15s ease-in;
}
.pause-leave-active .pause-box {
  animation: dialog-out 0.15s ease-in;
}

.pause-box {
  text-align: center;
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 1px solid color-mix(in srgb, var(--game-accent, #00FFFF) 30%, transparent);
  border-radius: 20px;
  padding: 35px 45px;
  max-width: calc(100vw - 40px);
  box-shadow: 0 0 50px color-mix(in srgb, var(--game-accent, #00FFFF) 20%, transparent);
}

.pause-icon {
  font-size: 2.4em;
  margin-bottom: 10px;
}

.pause-box h3 {
  color: #fff;
  font-size: 1.8em;
  margin-bottom: 20px;
}

.resume-btn {
  background: linear-gradient(135deg, var(--game-accent, #00FFFF), #818CF8);
  color: #0D0D1A;
  border: none;
  padding: 12px 40px;
  font-size: 1.1em;
  font-weight: 600;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.resume-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent, #00FFFF) 40%, transparent);
}

.hint {
  color: var(--game-text-info);
  margin-top: 14px;
  font-size: 0.85em;
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
