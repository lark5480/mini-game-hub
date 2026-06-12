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
  let intervalId: number | null = null
  let animationId: number | null = null
  let lastTime = 0

  function start() {
    stop()
    isRunning.value = true
    lastTime = 0

    if (options.mode === 'raf') {
      const fixedStep = options.fixedStep || 0
      let accumulator = 0

      function loop(timestamp: number) {
        if (!isRunning.value) return
        const dt = lastTime ? (timestamp - lastTime) : 16.67
        lastTime = timestamp

        if (fixedStep > 0) {
          accumulator += dt
          while (accumulator >= fixedStep) {
            options.onUpdate(fixedStep)
            accumulator -= fixedStep
          }
        } else {
          options.onUpdate(dt)
        }

        animationId = requestAnimationFrame(loop)
      }
      animationId = requestAnimationFrame(loop)
    } else {
      // interval 模式
      const ms = options.intervalMs || 150
      intervalId = window.setInterval(() => {
        options.onUpdate(ms)
      }, ms)
    }
  }

  function stop() {
    isRunning.value = false
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
    start,
    stop
  }
}
