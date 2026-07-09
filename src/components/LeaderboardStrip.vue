<template>
  <div class="strip">
    <div class="strip-header">
      <span class="strip-title">排行榜</span>
      <span v-if="loading" class="strip-status">加载中…</span>
    </div>
    <p v-if="error" class="strip-error">{{ error }}</p>
    <p v-else-if="!loading && entries.length === 0" class="strip-empty">还没有人上榜，快来抢第一！</p>
    <ul v-else class="strip-list">
      <li
        v-for="(entry, idx) in entries"
        :key="entry.id"
        :class="['strip-item', { top: idx < 3 }]"
      >
        <span class="strip-rank">{{ rankLabel(idx) }}</span>
        <span class="strip-name">{{ entry.nickname }}</span>
        <span class="strip-score">{{ entry.score }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useLeaderboard, useLeaderboardAutoRefresh } from '@/composables/useLeaderboard'

const props = defineProps<{
  game: string
  limit?: number
}>()

const { entries, loading, error, fetch } = useLeaderboard(props.game, props.limit ?? 5)

onMounted(() => { fetch() })
useLeaderboardAutoRefresh(fetch)

function rankLabel(idx: number): string {
  return ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}`
}
</script>

<style scoped>
.strip {
  margin-top: 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(129, 140, 248, 0.15);
  border-radius: 14px;
  padding: 16px 18px;
}

.strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.strip-title {
  color: #fff;
  font-weight: 600;
  font-size: 0.95em;
}

.strip-status {
  color: var(--game-text-muted);
  font-size: 0.8em;
}

.strip-empty {
  color: var(--game-text-muted);
  font-size: 0.85em;
  text-align: center;
  padding: 12px 0;
}

.strip-error {
  color: #FF6B6B;
  font-size: 0.85em;
  text-align: center;
}

.strip-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.strip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.strip-item.top {
  background: rgba(255, 215, 0, 0.06);
}

.strip-rank {
  width: 24px;
  text-align: center;
  font-size: 0.95em;
  flex-shrink: 0;
}

.strip-name {
  flex: 1;
  color: #fff;
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strip-score {
  color: #FFD700;
  font-weight: 600;
  font-size: 0.9em;
  flex-shrink: 0;
}
</style>
