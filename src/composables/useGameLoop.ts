import { ref, onUnmounted } from 'vue'

export type LoopMode = 'raf' | 'interval'

export interface UseGameLoopOptions {
  onUpdate: (deltaTime: number) => void
  mode?: LoopMode
  intervalMs?: number
  fixedStep?: number
}

export function useGameLoop(options: UseGameLoopOptions) {
  const isRunning = ref(false)
  const paused = ref(false)
  let intervalId: number | null = null
  let animationId: number | null = null
  let lastTime = 0

  // ---- rAF 模式：抽成内部函数方便 resume 复用 ----
  let rafAccumulator = 0
  function rafLoop(timestamp: number) {
    if (!isRunning.value || paused.value) {
      animationId = null
      return
    }
    // dt clamp：防止 tab 挂起回来后 dt 数秒导致瞬移
    const rawDt = lastTime ? (timestamp - lastTime) : 16.67
    const dt = Math.min(rawDt, 100)
    lastTime = timestamp

    const fixedStep = options.fixedStep || 0
    if (fixedStep > 0) {
      rafAccumulator += dt
      while (rafAccumulator >= fixedStep) {
        options.onUpdate(fixedStep)
        rafAccumulator -= fixedStep
      }
    } else {
      options.onUpdate(dt)
    }

    animationId = requestAnimationFrame(rafLoop)
  }

  function startRaf() {
    lastTime = 0
    rafAccumulator = 0
    animationId = requestAnimationFrame(rafLoop)
  }

  function start() {
    stop()
    isRunning.value = true
    paused.value = false

    if (options.mode === 'raf') {
      startRaf()
    } else {
      // interval 模式
      const ms = options.intervalMs || 150
      intervalId = window.setInterval(() => {
        if (paused.value) return
        options.onUpdate(ms)
      }, ms)
    }
  }

  function pause() {
    if (!isRunning.value) return
    paused.value = true
    // interval 模式下暂停时清除定时器，避免空转（与 rAF 模式对称）
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function resume() {
    if (!isRunning.value || !paused.value) return
    paused.value = false
    lastTime = 0
    // 暂停时 rAF 链已自行停止，需要重新启动
    if (options.mode === 'raf' && animationId === null) {
      startRaf()
    } else if (options.mode !== 'raf' && intervalId === null) {
      // interval 模式下定时器已被 pause 清除，重建
      const ms = options.intervalMs || 150
      intervalId = window.setInterval(() => {
        if (paused.value) return
        options.onUpdate(ms)
      }, ms)
    }
  }

  function stop() {
    isRunning.value = false
    paused.value = false
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  onUnmounted(() => stop())

  return {
    isRunning,
    paused,
    start,
    stop,
    pause,
    resume
  }
}
