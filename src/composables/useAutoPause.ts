import { onMounted, onUnmounted } from 'vue'

/**
 * 页面切到后台（如接电话、切换 App）时自动触发回调，通常用于暂停游戏。
 * 返回前台时不自动恢复，由用户手动继续，避免回前台时状态突变。
 */
export function useAutoPause(handler: () => void) {
  function onVisibility() {
    if (document.visibilityState === 'hidden') handler()
  }
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisibility))
}
