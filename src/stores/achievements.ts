import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'

export interface Achievement {
  id: string
  name: string
  icon: string
  desc: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'snake_king', name: '蛇王', icon: '🐍', desc: '贪吃蛇单局得分 >= 200' },
  { id: 'breakout_master', name: '砖块终结者', icon: '🧱', desc: '弹球打砖块通关' },
  { id: 'number_master', name: '数字大师', icon: '🔢', desc: '2048 达到 4096' },
  { id: 'link_master', name: '连连看达人', icon: '🔗', desc: '连连看单局得分 >= 200' },
  { id: 'sokoban_master', name: '搬运工', icon: '📦', desc: '推箱子通过第 5 关' },
  { id: 'tetris_master', name: '建筑大师', icon: '🎯', desc: '俄罗斯方块消除 50 行' },
  { id: 'whack_master', name: '神速', icon: '🔨', desc: '打地鼠 30 秒得分 >= 300' },
  { id: 'first_submit', name: '排行榜新人', icon: '🏆', desc: '首次提交分数到排行榜' },
  { id: 'all_games', name: '全能玩家', icon: '🎮', desc: '所有 8 款游戏都提交过分数' },
  { id: 'perfectionist', name: '完美主义者', icon: '⭐', desc: '解锁以上所有成就' },
]

const STORAGE_KEY = 'game-achievements'

function loadUnlocked(): Set<string> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) return new Set(JSON.parse(data))
  } catch { /* ignore */ }
  return new Set()
}

export const useAchievements = defineStore('achievements', () => {
  const unlocked = ref<Set<string>>(loadUnlocked())

  watch(unlocked, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...val]))
  }, { deep: true })

  const progress = computed(() => ({
    unlocked: unlocked.value.size,
    total: ACHIEVEMENTS.length
  }))

  function isUnlocked(id: string): boolean {
    return unlocked.value.has(id)
  }

  function unlock(id: string): boolean {
    if (unlocked.value.has(id)) return false
    unlocked.value = new Set(unlocked.value).add(id)

    // 解锁瞬间给音效 + 震动反馈
    useSound().unlock()
    useHaptics().success()

    // 检查完美主义者
    if (id !== 'perfectionist') {
      const baseAchievements = ACHIEVEMENTS.filter(a => a.id !== 'perfectionist')
      const allBaseUnlocked = baseAchievements.every(a => unlocked.value.has(a.id))
      if (allBaseUnlocked && !unlocked.value.has('perfectionist')) {
        unlocked.value = new Set(unlocked.value).add('perfectionist')
      }
    }

    return true
  }

  function getAchievement(id: string): Achievement | undefined {
    return ACHIEVEMENTS.find(a => a.id === id)
  }

  return {
    unlocked,
    progress,
    isUnlocked,
    unlock,
    getAchievement,
    list: ACHIEVEMENTS
  }
})
