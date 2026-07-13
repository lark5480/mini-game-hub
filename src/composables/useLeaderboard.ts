import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import { GAMES } from '@/lib/games'

const SUBMITTED_GAMES_KEY = 'game-submitted-games'

function loadSubmittedGames(): Set<string> {
  try {
    const data = localStorage.getItem(SUBMITTED_GAMES_KEY)
    if (data) return new Set(JSON.parse(data))
  } catch { /* ignore */ }
  return new Set()
}

function saveSubmittedGames(games: Set<string>) {
  localStorage.setItem(SUBMITTED_GAMES_KEY, JSON.stringify([...games]))
}

export interface LeaderboardEntry {
  id: number
  game: string
  nickname: string
  score: number
  created_at: string
}

// 全局刷新信号：每次成功提交后递增，所有 LeaderboardStrip 自动重新拉取
export const leaderboardVersion = ref(0)

export function useLeaderboard(game: string, limit = 10) {
  const entries = ref<LeaderboardEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 给任意 Promise 加超时保护
  function withTimeout<T>(p: PromiseLike<T>, ms = 5000): Promise<T> {
    return Promise.race([
      Promise.resolve(p),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ])
  }

  // 后端错误 → 友好中文文案
  function friendlyError(raw: string): string {
    if (raw === 'timeout') return '网络超时，请检查网络后重试'
    if (/fetch|network|failed to fetch/i.test(raw)) return '网络连接失败，请检查网络'
    if (/unauthorized|401/i.test(raw)) return '服务未授权，请联系管理员'
    return '提交失败，请稍后重试'
  }

  async function fetch() {
    if (!supabase) return
    loading.value = true
    error.value = null
    try {
      const query = supabase
        .from('leaderboard')
        .select('*')
        .eq('game', game)
        .order('score', { ascending: false })
        .limit(limit)
        .then()
      const { data, error: err } = await withTimeout(query)
      if (err) throw err
      entries.value = data ?? []
    } catch (e) {
      error.value = friendlyError((e as Error).message)
    } finally {
      loading.value = false
    }
  }

  async function submit(nickname: string, score: number): Promise<boolean> {
    if (!supabase) return false
    const name = nickname.trim() || '匿名玩家'
    try {
      const { data: existing } = await withTimeout(
        supabase.from('leaderboard').select('id, score').eq('game', game).eq('nickname', name).maybeSingle().then()
      )
      if (existing) {
        if (score > existing.score) {
          const { error: err } = await withTimeout(
            supabase.from('leaderboard').update({ score }).eq('id', existing.id).then()
          )
          if (err) throw err
        }
      } else {
        const { error: err } = await withTimeout(
          supabase.from('leaderboard').insert({ game, nickname: name, score }).then()
        )
        if (err) throw err
      }
    } catch (e) {
      error.value = friendlyError((e as Error).message)
      return false
    }
    leaderboardVersion.value++
    // 全局广播会自动触发 strip 刷新，此处无需单独 await fetch()

    // 排行榜成就检查（异步，不阻塞提交流程，隔离避免抛出影响 submit）
    setTimeout(() => {
      try {
        const store = useAchievements()
        const toast = useToast()
        if (store.unlock('first_submit')) toast.show('成就解锁：排行榜新人', '🏆')
        const submittedGames = loadSubmittedGames()
        submittedGames.add(game)
        saveSubmittedGames(submittedGames)
        if (submittedGames.size >= GAMES.length && store.unlock('all_games')) toast.show('成就解锁：全能玩家', '🎮')
      } catch { /* 成就/Toast 异常不应影响提交主流程 */ }
    }, 0)

    return true
  }

  return { entries, loading, error, fetch, submit }
}

// 供 LeaderboardStrip 调用：监听全局版本号变化自动刷新
export function useLeaderboardAutoRefresh(fetch: () => Promise<void>) {
  watch(leaderboardVersion, () => { fetch() })
}
