import { ref, onMounted, onUnmounted } from 'vue'
import { useSound } from './useSound'
import { useAutoPause } from './useAutoPause'

export interface UseGamePauseOptions {
  /** 实际暂停游戏逻辑（停 loop / 冻结状态 / 停计时器） */
  onPause?: () => void
  /** 恢复游戏逻辑 */
  onResume?: () => void
  /** 失焦自动暂停，默认 true */
  autoPause?: boolean
  /** 是否允许暂停的守卫（如游戏未开始、已结束、弹窗中）。返回 false 时不暂停 */
  canPause?: () => boolean
}

/**
 * 统一的暂停 / 恢复 composable（替代原先 4 套散落写法）：
 *  - 默认绑定 P / Esc 键切换暂停
 *  - 失焦（切后台）自动暂停，回前台由用户手动恢复
 *  - 暂停 / 恢复自动调用 sound.pause / sound.resume（一致体验，不再遗漏音效）
 *  - 暴露 paused / pause / resume / toggle，供视图绑定遮罩与按钮
 *  - canPause 守卫防止在结束 / 弹窗 / 未开始时误暂停
 */
export function useGamePause(opts: UseGamePauseOptions = {}) {
  const paused = ref(false)
  const sound = useSound()

  function pause() {
    if (paused.value) return
    if (opts.canPause && !opts.canPause()) return
    paused.value = true
    sound.pause()
    opts.onPause?.()
  }

  function resume() {
    if (!paused.value) return
    paused.value = false
    sound.resume()
    opts.onResume?.()
  }

  function toggle() {
    if (paused.value) resume()
    else pause()
  }

  // ---- 键盘：P / Esc ----
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault()
      toggle()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  // ---- 失焦自动暂停 ----
  if (opts.autoPause !== false) {
    useAutoPause(pause)
  }

  return { paused, pause, resume, toggle }
}
