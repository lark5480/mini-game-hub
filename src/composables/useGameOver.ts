import { useGameStore } from '@/stores/game'
import { useSound } from '@/composables/useSound'
import { useAchievements } from '@/stores/achievements'

export interface GameOverResult {
  /** 是否打破个人最佳 */
  isNewRecord: boolean
  /** 成就接近提示（如"还差 50 分解锁蛇王"），null 表示无 */
  achievementHint: string | null
}

interface ProximityRule {
  achievementId: string
  name: string
  icon: string
  threshold: number
}

/** 基于分数可测算"接近程度"的成就规则 */
const PROXIMITY_RULES: Record<string, ProximityRule> = {
  snake:      { achievementId: 'snake_king',    name: '蛇王',     icon: '🐍', threshold: 200 },
  link:       { achievementId: 'link_master',    name: '连连看达人', icon: '🔗', threshold: 200 },
  'whackamole': { achievementId: 'whack_master', name: '神速', icon: '🔨', threshold: 300 },
}

/** 达成提示的"接近"阈值：达到目标的 75% 以上才提示 */
const PROXIMITY_RATIO = 0.75

export function useGameOver() {
  const gameStore = useGameStore()
  const sound = useSound()
  const achievements = useAchievements()

  /**
   * 处理游戏结束：检测新记录 + 写入分数 + 播放音效。
   * 返回元数据供 UI 层展示。
   */
  function checkGameOver(gameName: string, score: number): GameOverResult {
    const prevBest = gameStore.getTopScore(gameName)
    const isNewRecord = score > 0 && score > prevBest

    // 写入分数（store 自动排序 + 持久化 + 截断 top 10）
    if (score > 0) {
      gameStore.addScore(gameName, score)
    }

    // 新记录用胜利音效，否则用常规结束音效
    if (isNewRecord) {
      sound.win()
    } else {
      sound.gameOver()
    }

    // 成就接近提示
    const achievementHint = getAchievementHint(gameName, score)

    return { isNewRecord, achievementHint }
  }

  /** 检查是否接近某个未解锁的成就 */
  function getAchievementHint(gameName: string, score: number): string | null {
    const rule = PROXIMITY_RULES[gameName]
    if (!rule) return null
    if (achievements.isUnlocked(rule.achievementId)) return null
    // 已达成：解锁成就（unlock 内部 idempotent，重复调用安全）
    if (score >= rule.threshold) {
      achievements.unlock(rule.achievementId)
      return null
    }

    const minHintScore = Math.floor(rule.threshold * PROXIMITY_RATIO)
    if (score < minHintScore) return null  // 差得太远，不提示

    const diff = rule.threshold - score
    return `还差 ${diff} 分解锁${rule.icon}${rule.name}`
  }

  return { checkGameOver }
}
