import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

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

  async function fetch() {
    if (!supabase) return
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('game', game)
        .order('score', { ascending: false })
        .limit(limit)
      if (err) throw err
      entries.value = data ?? []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function submit(nickname: string, score: number): Promise<boolean> {
    if (!supabase) return false
    const name = nickname.trim() || '匿名玩家'
    const { data: existing } = await supabase
      .from('leaderboard')
      .select('id, score')
      .eq('game', game)
      .eq('nickname', name)
      .maybeSingle()
    if (existing) {
      if (score > existing.score) {
        const { error: err } = await supabase
          .from('leaderboard')
          .update({ score })
          .eq('id', existing.id)
        if (err) { error.value = err.message; await fetch(); return false }
      }
    } else {
      const { error: err } = await supabase
        .from('leaderboard')
        .insert({ game, nickname: name, score })
      if (err) { error.value = err.message; return false }
    }
    leaderboardVersion.value++
    await fetch()
    return true
  }

  return { entries, loading, error, fetch, submit }
}

// 供 LeaderboardStrip 调用：监听全局版本号变化自动刷新
export function useLeaderboardAutoRefresh(fetch: () => Promise<void>) {
  watch(leaderboardVersion, () => { fetch() })
}
