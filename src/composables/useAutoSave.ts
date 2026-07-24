import { onUnmounted } from 'vue'
import { useGameSave } from '@/composables/useGameSave'

export interface UseAutoSaveOptions {
  /** 防抖延迟（ms），默认 300 */
  delay?: number
  /** 存档前校验，返回 false 则跳过本次存档 */
  beforeSave?: () => boolean
}

/**
 * 防抖存盘三件套：scheduleSave / clearSave / onUnmounted 清理。
 * 替代各 view 中重复的 saveTimer + setTimeout/clearTimeout 模板。
 */
export function useAutoSave(
  gameName: string,
  getData: () => Record<string, unknown>,
  options: UseAutoSaveOptions = {}
) {
  const { delay = 300, beforeSave } = options
  const save = useGameSave(gameName)
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (beforeSave && !beforeSave()) return
      save.saveGame(getData())
    }, delay)
  }

  function clearSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    save.clearGame()
  }

  onUnmounted(() => { if (saveTimer) clearTimeout(saveTimer) })

  return { scheduleSave, clearSave }
}
