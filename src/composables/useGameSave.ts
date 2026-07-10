const SAVE_VERSION = 1
const SAVE_PREFIX = 'game-save-'

function storageKey(gameName: string): string {
  return SAVE_PREFIX + gameName
}

/**
 * 通用游戏存档 composable。
 * 保存格式：{ v: SAVE_VERSION, ...state }。
 * 版本不匹配时静默清除，返回 null。
 */
export function useGameSave(gameName: string) {
  function saveGame(state: Record<string, unknown>): void {
    try {
      localStorage.setItem(storageKey(gameName), JSON.stringify({ v: SAVE_VERSION, ...state }))
    } catch { /* quota / disabled storage — ignore */ }
  }

  function loadGame(): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(storageKey(gameName))
      if (!raw) return null
      const data = JSON.parse(raw) as Record<string, unknown> & { v?: number }
      if (data.v !== SAVE_VERSION) {
        clearGame()
        return null
      }
      delete data.v
      return data
    } catch {
      clearGame()
      return null
    }
  }

  function clearGame(): void {
    try { localStorage.removeItem(storageKey(gameName)) } catch { /* ignore */ }
  }

  function hasGameSave(): boolean {
    try { return localStorage.getItem(storageKey(gameName)) !== null } catch { return false }
  }

  return { saveGame, loadGame, clearGame, hasGameSave }
}
