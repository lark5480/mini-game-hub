import { ref } from 'vue'

export interface ToastState {
  message: string
  icon: string
  visible: boolean
}

const state = ref<ToastState>({
  message: '',
  icon: '',
  visible: false
})

let timer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function show(message: string, icon = '', duration = 2000) {
    if (timer) clearTimeout(timer)
    state.value = { message, icon, visible: true }
    timer = setTimeout(() => {
      state.value.visible = false
    }, duration)
  }

  function hide() {
    if (timer) clearTimeout(timer)
    state.value.visible = false
  }

  return { state, show, hide }
}
