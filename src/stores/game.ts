import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface GameScore {
  name: string
  score: number
  date: string
}

const STORAGE_KEY = 'game-collection-scores'

function defaultScores(): Record<string, GameScore[]> {
  return { sokoban: [], link: [], 'catch-fruit': [], snake: [], tetris: [], breakout: [], '2048': [], whackamole: [], 'tic-tac-toe': [] }
}

function loadScores(): Record<string, GameScore[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : defaultScores()
  } catch {
    return defaultScores()
  }
}

export const useGameStore = defineStore('game', () => {
  const currentGame = ref('')
  const scores = ref<Record<string, GameScore[]>>(loadScores())

  // 持久化：scores 变化时自动写入 localStorage
  watch(scores, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function setCurrentGame(game: string) {
    currentGame.value = game
  }

  function addScore(game: string, score: number) {
    const entry: GameScore = {
      name: game,
      score,
      date: new Date().toLocaleString('zh-CN')
    }
    if (!scores.value[game]) scores.value[game] = []
    scores.value[game].push(entry)
    scores.value[game].sort((a, b) => b.score - a.score)
    if (scores.value[game].length > 10) {
      scores.value[game] = scores.value[game].slice(0, 10)
    }
  }

  function getTopScore(game: string): number {
    return scores.value[game]?.[0]?.score || 0
  }

  return {
    currentGame,
    scores,
    setCurrentGame,
    addScore,
    getTopScore
  }
})
