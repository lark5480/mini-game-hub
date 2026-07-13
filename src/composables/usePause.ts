import { ref, onMounted, onUnmounted } from 'vue'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'

export interface UsePauseOptions {
  /** 游戏是否正在运行（非 gameOver、非开始界面） */
  isPlaying: () => boolean
  /** 游戏是否已结束 */
  isGameOver: () => boolean
  /** 暂停时调用 */
  onPause: () => void
  /** 恢复时调用 */
  onResume: () => void
  /** 切到后台时是否自动暂停，默认 true */
  autoPause?: boolean
}

/**
 * 统一的暂停 / 恢复 composable：
 *  - 默认绑定 P / Esc 键暂停
 *  - 切到后台自动暂停
 *  - 恢复时给出明显反馈
 *  - 暴露 `pause`/`resume` 方法供 view 主动调用（如读存档后拉起恢复提示）
 */
export function usePause(opts: UsePauseOptions) {
  const paused = ref(false)
  const canResume = ref(false)
  const sound = useSound()
  const haptics = useHaptics?.()

  function _pause() {
    if (!opts.isPlaying() || opts.isGameOver()) return
    if (paused.value) return
    paused.value = true
    canResume.value = true
    opts.onPause?.()
    sound.pause()
  }

  function _resume() {
    if (!paused.value) return
    paused.value = false
    canResume.value = false
    opts.onResume?.()
    sound.resume()
    try { haptics?.pulse?.() } catch { /* noop */ }
  }

  function togglePause() {
    if (paused.value) _resume()
    else _pause()
  }

  // ---- 键盘：P / Esc ----
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault()
      togglePause()
    }
  }

  // ---- 失焦自动暂停 ----
  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (opts.autoPause !== false && opts.isPlaying() && !opts.isGameOver()) {
        _pause()
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('visibilitychange', onVisibility)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { paused, canResume, togglePause, pause: _pause, resume: _resume }
}
