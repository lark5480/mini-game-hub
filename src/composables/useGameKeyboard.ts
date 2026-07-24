import { onMounted, onUnmounted, type Ref } from 'vue'

export interface KeyBinding {
  key: string | string[]
  handler: (e?: KeyboardEvent) => void
  preventDefault?: boolean
  /** 设为 true 则在 keyup 时触发，而非 keydown */
  onKeyUp?: boolean
  /** 长按连发：首次触发后每 intervalMs 毫秒再次调用 handler（仅 keydown） */
  repeat?: { initialDelay?: number; intervalMs: number }
}

export interface UseGameKeyboardOptions {
  bindings: KeyBinding[]
  active?: Ref<boolean> | boolean
}

export function useGameKeyboard(options: UseGameKeyboardOptions) {
  /** 当前按下的所有键（小写）——实例级，避免多实例共享状态 */
  const heldKeys = new Set<string>()

  /** 连发定时器——实例级，onUnmounted 只清理本实例的定时器 */
  const repeatTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const preventKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '])

  function isActive(): boolean {
    const a = options.active
    if (a === undefined) return true
    return typeof a === 'object' ? a.value : a !== false
  }

  function findBinding(e: KeyboardEvent, keyUp: boolean): KeyBinding | undefined {
    for (const binding of options.bindings) {
      const keys = (Array.isArray(binding.key) ? binding.key : [binding.key]).map(k => k.toLowerCase())
      if (keys.includes(e.key.toLowerCase()) && !!binding.onKeyUp === keyUp) return binding
    }
    return undefined
  }

  function startRepeat(binding: KeyBinding, key: string) {
    const cfg = binding.repeat
    if (!cfg) return
    const initialDelay = cfg.initialDelay ?? 180
    const interval = cfg.intervalMs

    // 首次延迟后触发一次 + 启动循环
    const firstTimer = setTimeout(() => {
      if (!heldKeys.has(key) || !isActive()) return
      binding.handler()
      const loop = setInterval(() => {
        if (!heldKeys.has(key) || !isActive()) {
          clearInterval(loop)
          repeatTimers.delete(key)
          return
        }
        binding.handler()
      }, interval)
      repeatTimers.set(key, loop as unknown as ReturnType<typeof setTimeout>)
    }, initialDelay)

    repeatTimers.set(key, firstTimer)
  }

  function stopRepeat(key: string) {
    const timer = repeatTimers.get(key)
    if (timer !== undefined) {
      clearTimeout(timer)
      clearInterval(timer as unknown as number)
      repeatTimers.delete(key)
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isActive()) return
    const binding = findBinding(e, false)
    if (!binding) return
    if (binding.preventDefault !== false || preventKeys.has(e.key)) {
      e.preventDefault()
    }
    binding.handler(e)

    // 连发支持
    const key = e.key.toLowerCase()
    if (binding.repeat && !e.repeat) {
      heldKeys.add(key)
      startRepeat(binding, key)
    }
  }

  function handleKeyup(e: KeyboardEvent) {
    if (!isActive()) return
    const binding = findBinding(e, true)
    if (!binding) return
    binding.handler(e)

    const key = e.key.toLowerCase()
    heldKeys.delete(key)
    stopRepeat(key)
  }

  // 窗口失焦时清空所有按下状态，避免"粘键"
  function onBlur() {
    heldKeys.clear()
    for (const [key, timer] of repeatTimers) {
      clearTimeout(timer)
      clearInterval(timer as unknown as number)
      repeatTimers.delete(key)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
    window.addEventListener('blur', onBlur)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup', handleKeyup)
    window.removeEventListener('blur', onBlur)
    // 清理本实例残留的连发定时器
    for (const [key, timer] of repeatTimers) {
      clearTimeout(timer)
      clearInterval(timer as unknown as number)
      repeatTimers.delete(key)
    }
  })

  return {
    /** 查询某键当前是否被按住 */
    isDown(key: string) { return heldKeys.has(key.toLowerCase()) },
    /** 刷新绑定（绑定里用了 ref 的必须主动传新数组） */
    refresh(newBindings: KeyBinding[]) { options.bindings = newBindings }
  }
}
