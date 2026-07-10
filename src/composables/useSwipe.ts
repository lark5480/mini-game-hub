import { onMounted, onUnmounted } from 'vue'

export type SwipeDir = 'up' | 'down' | 'left' | 'right'

export interface SwipeOptions {
  onSwipe: (dir: SwipeDir) => void
  threshold?: number
  el: () => HTMLElement | null
  active?: () => boolean
}

export function useSwipe(options: SwipeOptions) {
  const threshold = options.threshold ?? 20
  let startX = 0
  let startY = 0

  function onTouchStart(e: TouchEvent) {
    if (options.active && !options.active()) return
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
  }

  function onTouchEnd(e: TouchEvent) {
    if (options.active && !options.active()) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (Math.max(absDx, absDy) < threshold) return

    if (absDx > absDy) {
      options.onSwipe(dx > 0 ? 'right' : 'left')
    } else {
      options.onSwipe(dy > 0 ? 'down' : 'up')
    }
  }

  let el: HTMLElement | null = null

  onMounted(() => {
    el = options.el()
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onTouchEnd)
  })
}
