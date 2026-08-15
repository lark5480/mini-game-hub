import { ref, provide, inject, onMounted, onUnmounted, type InjectionKey } from 'vue'
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

/** 暂停遮罩 / 恢复提示 → useGamePause 的通信通道 */
interface PauseCountdownCtx {
  /** 子组件注册取消回调；返回 unregister 函数 */
  registerCancel: (cancel: () => void) => () => void
  /** 通知 useGamePause 倒计时状态变化（P/Esc 拦截用） */
  setCounting: (v: boolean) => void
}
const PAUSE_COUNTDOWN_KEY: InjectionKey<PauseCountdownCtx> = Symbol('pause-countdown')

/** 供 PauseOverlay / ResumePrompt 注入：注册倒计时取消回调 + 同步倒计时状态 */
export function usePauseCountdown(cancel: () => void) {
  const ctx = inject(PAUSE_COUNTDOWN_KEY, null)
  if (ctx) {
    ctx.registerCancel(cancel)
    return { setCounting: ctx.setCounting }
  }
  return { setCounting: (_v: boolean) => {} }
}

/**
 * 统一的暂停 / 恢复 composable（替代原先 4 套散落写法）：
 *  - 默认绑定 P / Esc 键切换暂停
 *  - 失焦（切后台）自动暂停，回前台由用户手动恢复
 *  - 暂停 / 恢复自动调用 sound.pause / sound.resume（一致体验，不再遗漏音效）
 *  - 暴露 paused / pause / resume / toggle，供视图绑定遮罩与按钮
 *  - canPause 守卫防止在结束 / 弹窗 / 未开始时误暂停
 *  - 恢复前 3-2-1 倒计时（子组件通过 provide/inject 协调）
 */
export function useGamePause(opts: UseGamePauseOptions = {}) {
  const paused = ref(false)
  const countingDown = ref(false)
  const sound = useSound()

  // ---- 子组件注册倒计时取消回调 ----
  const cancels = new Set<() => void>()
  provide(PAUSE_COUNTDOWN_KEY, {
    registerCancel: (cancel: () => void) => {
      cancels.add(cancel)
      return () => cancels.delete(cancel)
    },
    setCounting: (v: boolean) => { countingDown.value = v }
  })

  function cancelAllCountdowns() {
    cancels.forEach(fn => fn())
    countingDown.value = false
  }

  function pause() {
    if (paused.value) return
    if (opts.canPause && !opts.canPause()) return
    cancelAllCountdowns()
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
    if (paused.value) {
      if (countingDown.value) {
        // 倒计时中按 P/Esc → 取消倒计时，保持暂停
        cancelAllCountdowns()
        return
      }
      resume()
    } else {
      pause()
    }
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

  return { paused, pause, resume, toggle, countingDown }
}
