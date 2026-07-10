import { ref } from 'vue'

export interface ScorePopup {
  id: number
  x: number
  y: number
  text: string
}

/**
 * 浮动分数反馈。游戏在得分点调用 pop('+10', x, y)，
 * x/y 为相对棋盘容器的像素坐标，由 ScoreFloat 组件渲染并自动消失。
 */
export function useScoreFloats() {
  const popups = ref<ScorePopup[]>([])
  let pid = 0

  function pop(text: string, x: number, y: number) {
    const id = pid++
    popups.value.push({ id, x, y, text })
    window.setTimeout(() => {
      popups.value = popups.value.filter(p => p.id !== id)
    }, 800)
  }

  return { popups, pop }
}
