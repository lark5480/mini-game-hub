<template>
  <div class="strip-wrapper">
    <button
      v-if="isMobile"
      class="strip-toggle"
      @click="toggle"
      :aria-expanded="!collapsed"
    >
      <span class="strip-toggle-title">排行榜</span>
      <span class="strip-toggle-icon">{{ collapsed ? '▶' : '▼' }}</span>
    </button>
    <div class="strip-body" :class="{ collapsed: isMobile && collapsed }">
      <div class="strip">
        <div class="strip-header">
          <span class="strip-title">排行榜</span>
          <span v-if="loading" class="strip-status">加载中…</span>
          <button v-if="isMobile && !collapsed" class="strip-close" @click="collapsed = true" aria-label="收起">▼</button>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useLeaderboard, useLeaderboardAutoRefresh } from '@/composables/useLeaderboard'

const props = defineProps<{
  game: string
  limit?: number
}>()

const { entries, loading, error, fetch } = useLeaderboard(props.game, props.limit ?? 5)

onMounted(() => { fetch() })
useLeaderboardAutoRefresh(fetch)

// 手机端折叠：小屏默认收起，大屏始终展开
const collapsed = ref(true)
const isMobile = ref(false)
let mq: MediaQueryList | null = null

function onMediaChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches
  if (!e.matches) collapsed.value = false
}

onMounted(() => {
  mq = window.matchMedia('(max-width: 640px)')
  isMobile.value = mq.matches
  if (!mq.matches) collapsed.value = false
  mq.addEventListener('change', onMediaChange)
})

onUnmounted(() => {
  mq?.removeEventListener('change', onMediaChange)
})

function toggle() {
  collapsed.value = !collapsed.value
}

function rankLabel(idx: number): string {
  return ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}`
}
</script>

<style scoped>
.strip-wrapper {
  margin-top: 20px;
}

/* 折叠按钮 */
.strip-toggle {
  width: 100%;
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(129, 140, 248, 0.15);
  border-radius: 14px;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9em;
  transition: background 0.2s, border-color 0.2s;
}

.strip-toggle:hover {
  background: rgba(0, 0, 0, 0.45);
  border-color: rgba(129, 140, 248, 0.35);
}

.strip-toggle-title {
  font-weight: 600;
}

.strip-toggle-icon {
  font-size: 0.75em;
  opacity: 0.7;
}

/* 折叠内容区 */
.strip-body {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease;
  max-height: 500px;
  opacity: 1;
}

/* 原有卡片样式 */
.strip {
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
  gap: 8px;
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

.strip-close {
  background: none;
  border: none;
  color: var(--game-text-muted);
  cursor: pointer;
  font-size: 0.75em;
  padding: 2px 6px;
  font-family: inherit;
  transition: color 0.2s;
}

.strip-close:hover {
  color: #fff;
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

/* 小屏：启用折叠 */
@media (max-width: 640px) {
  .strip-toggle {
    display: flex;
  }

  .strip-body.collapsed {
    max-height: 0;
    opacity: 0;
    margin-top: 0;
  }

  .strip-body:not(.collapsed) {
    margin-top: 8px;
  }

  .strip-body:not(.collapsed) .strip {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
}
</style>
