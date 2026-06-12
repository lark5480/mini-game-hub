import { onMounted, onUnmounted, type Ref } from 'vue'

export interface KeyBinding {
  key: string | string[]
  handler: (e: KeyboardEvent) => void
  preventDefault?: boolean
}

export interface UseGameKeyboardOptions {
  bindings: KeyBinding[]
  active?: Ref<boolean> | boolean
}

export function useGameKeyboard(options: UseGameKeyboardOptions) {
  const preventKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '])

  function handleKeydown(e: KeyboardEvent) {
    // 检查 active 状态
    const isActive = typeof options.active === 'object'
      ? options.active.value
      : options.active !== false

    if (!isActive) return

    for (const binding of options.bindings) {
      const keys = Array.isArray(binding.key) ? binding.key : [binding.key]
      if (keys.includes(e.key)) {
        if (binding.preventDefault !== false || preventKeys.has(e.key)) {
          e.preventDefault()
        }
        binding.handler(e)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

  return {
    refresh(newBindings: KeyBinding[]) {
      options.bindings = newBindings
    }
  }
}
