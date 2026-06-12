import { onMounted, onUnmounted, type Ref } from 'vue'

export interface KeyBinding {
  key: string | string[]
  handler: (e: KeyboardEvent) => void
  preventDefault?: boolean
  /** 设为 true 则在 keyup 时触发，而非 keydown */
  onKeyUp?: boolean
}

export interface UseGameKeyboardOptions {
  bindings: KeyBinding[]
  active?: Ref<boolean> | boolean
}

export function useGameKeyboard(options: UseGameKeyboardOptions) {
  const preventKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '])

  function isActive(): boolean {
    return typeof options.active === 'object' ? options.active.value : options.active !== false
  }

  function findBinding(e: KeyboardEvent, keyUp: boolean): KeyBinding | undefined {
    for (const binding of options.bindings) {
      const keys = Array.isArray(binding.key) ? binding.key : [binding.key]
      if (keys.includes(e.key) && !!binding.onKeyUp === keyUp) return binding
    }
    return undefined
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isActive()) return
    const binding = findBinding(e, false)
    if (!binding) return
    if (binding.preventDefault !== false || preventKeys.has(e.key)) {
      e.preventDefault()
    }
    binding.handler(e)
  }

  function handleKeyup(e: KeyboardEvent) {
    if (!isActive()) return
    const binding = findBinding(e, true)
    if (!binding) return
    binding.handler(e)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup', handleKeyup)
  })

  return {
    refresh(newBindings: KeyBinding[]) {
      options.bindings = newBindings
    }
  }
}
