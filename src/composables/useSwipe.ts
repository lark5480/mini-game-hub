import { onMounted, onUnmounted } from 'vue'

export type SwipeDir = 'up' | 'down' | 'left' | 'right'

export interface SwipeOptions {
  onSwipe: (dir: SwipeDir) => void
  threshold?: number
  el: () => HTMLElement | null
  active?: () => boolean
  /**
   * 方向一旦在 touchmove 中确定就不再改变（直到 touchend 重置）。
   * 默认 false，向后兼容——不传时行为与旧版完全一致（touchend 时才确定方向）。
   */
  lockDirection?: boolean
  /**
   * 一次滑动完成后短暂禁用输入的冷却时间（ms）。
   * 默认 0，不锁定。对贪吃蛇等需要防误触的场景设为 150–200。
   */
  lockDuration?: number
  /**
   * 方向预判触发阈值（px）。touchmove 中手指移动超过此距离即锁定方向。
   * 仅 lockDirection=true 时生效。默认 10。
   */
  directionThreshold?: number
}

export function useSwipe(options: SwipeOptions) {
  const threshold = options.threshold ?? 20
  const lockDirection = options.lockDirection ?? false
  const lockDuration = options.lockDuration ?? 0
  const directionThreshold = options.directionThreshold ?? 10

  let startX = 0
  let startY = 0
  // 本次触摸是否已触发过 onSwipe（用于 touchend 去重）
  let fired = false
  // lockDirection 模式下已锁定的方向，null 表示尚未锁定
  let lockedDir: SwipeDir | null = null
  // 冷却定时器
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null
  let inCooldown = false
  // 当前触摸是否有效（touchstart 时不在冷却中）
  let touchActive = false

  function resolveDir(dx: number, dy: number): SwipeDir {
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up')
  }

  function onTouchStart(e: TouchEvent) {
    if (options.active && !options.active()) return
    // 冷却中则忽略本次触摸
    if (inCooldown) {
      touchActive = false
      return
    }
    touchActive = true
    fired = false
    lockedDir = null
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
  }

  function onTouchMove(e: TouchEvent) {
    if (!touchActive) return
    if (options.active && !options.active()) return

    if (lockDirection && lockedDir === null) {
      const touch = e.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      // 超过方向预判阈值，立即锁定方向并触发
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= directionThreshold) {
        lockedDir = resolveDir(dx, dy)
        fired = true
        options.onSwipe(lockedDir)
      }
    }
    // lockDirection=false 时不做任何事（旧行为：touchend 才判断）
  }

  function onTouchEnd(e: TouchEvent) {
    if (!touchActive) return
    if (options.active && !options.active()) return

    if (!fired) {
      // 旧路径：lockDirection 未开启，或方向未达到 directionThreshold
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) >= threshold) {
        options.onSwipe(resolveDir(dx, dy))
        fired = true
      }
    }

    // 滑动冷却锁定
    if (fired && lockDuration > 0) {
      inCooldown = true
      cooldownTimer = setTimeout(() => {
        inCooldown = false
        cooldownTimer = null
      }, lockDuration)
    }

    // 重置本次触摸状态
    touchActive = false
    lockedDir = null
  }

  function onTouchCancel() {
    touchActive = false
    lockedDir = null
  }

  let el: HTMLElement | null = null

  onMounted(() => {
    el = options.el()
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })
  })

  onUnmounted(() => {
    if (cooldownTimer !== null) clearTimeout(cooldownTimer)
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchCancel)
  })
}
