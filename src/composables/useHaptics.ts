/**
 * 触觉反馈封装。移动端在支持 navigator.vibrate 时触发震动；
 * 桌面端或不支持时静默无操作，所有函数都做能力检测，调用安全。
 */
export function useHaptics() {
  const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

  function vibrate(pattern: number | number[]) {
    if (!supported) return
    try {
      navigator.vibrate(pattern)
    } catch {
      /* 某些浏览器在用户手势外调用会抛错，忽略即可 */
    }
  }

  // 语义化快捷振动
  const light = () => vibrate(5)
  const tap = () => vibrate(10)
  const select = () => vibrate(15)
  const pulse = () => vibrate(25)
  const success = () => vibrate([20, 40, 20])
  const error = () => vibrate([60, 30, 60])
  const win = () => vibrate([30, 50, 30, 50, 60])

  return { vibrate, light, tap, select, pulse, success, error, win }
}
