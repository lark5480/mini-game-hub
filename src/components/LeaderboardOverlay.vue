<template>
  <Transition name="leaderboard">
    <div v-if="visible" class="overlay" @click.self="$emit('update:visible', false)">
      <div class="panel">
      <button class="close-btn" @click="$emit('update:visible', false)" title="关闭">✕</button>

      <!-- 标题 -->
      <h3>{{ gameName }} 排行榜</h3>

      <!-- 提交阶段：已配置 Supabase 且尚未提交 -->
      <div v-if="supabaseConfigured && mode === 'submit'" class="submit-area">
        <p class="score-line">你的得分 <strong>{{ score }}</strong></p>
        <div class="nickname-row">
          <input
            v-model="nickname"
            maxlength="12"
            placeholder="输入昵称（可选）"
            @keyup.enter="handleSubmit"
          />
          <button class="submit-btn" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? '提交中…' : '提交分数' }}
          </button>
        </div>
        <button class="skip-btn" @click="switchToView">稍后再说</button>
      </div>

      <!-- 排行榜展示（已配置） -->
      <div v-else-if="supabaseConfigured" class="leaderboard-area">
        <p v-if="loading" class="status">加载中…</p>
        <template v-else-if="error">
          <p class="status error">{{ error }}</p>
          <button class="retry-btn" @click="fetch">重试</button>
        </template>
        <p v-else-if="entries.length === 0" class="status">还没有人上榜，快来抢第一！</p>
        <ul v-else class="rank-list">
          <li
            v-for="(entry, idx) in entries"
            :key="entry.id"
            :class="['rank-item', { top: idx < 3, isMe: entry.id === lastInsertedId }]"
          >
            <span class="rank-num">{{ rankLabel(idx) }}</span>
            <span class="rank-name">{{ entry.nickname }}</span>
            <span class="rank-score">{{ entry.score }}</span>
          </li>
        </ul>
      </div>

      <!-- Supabase 未配置：仅展示成绩（成绩仍可分享） -->
      <div v-else class="submit-area">
        <p v-if="props.score > 0" class="score-line">你的得分 <strong>{{ score }}</strong></p>
        <p class="status error">排行榜未配置（成绩仍可分享）</p>
      </div>

      <!-- 分享成绩：只要有分数就常驻，不依赖 Supabase -->
      <button
        v-if="props.score > 0"
        class="share-btn"
        :class="{ done: shareState !== 'idle' }"
        @click="shareScore"
      >
        {{ shareLabel }}
      </button>

      <!-- 再来一局：非提交阶段 -->
      <button
        v-if="props.score > 0 && mode !== 'submit'"
        class="play-again-btn"
        @click="emit('replay')"
      >
        再来一局
      </button>
    </div>
  </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useLeaderboard, useLeaderboardAutoRefresh } from '@/composables/useLeaderboard'
import { rankLabel } from '@/lib/rank'

type Mode = 'submit' | 'view' | 'viewing-after-submit'

const supabaseConfigured = computed(() => supabase !== null)

const props = defineProps<{
  visible: boolean
  game: string
  score: number
  gameName: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  replay: []
}>()

const { entries, loading, error, fetch, submit } = useLeaderboard(props.game)
useLeaderboardAutoRefresh(fetch)

const nickname = ref('')
const submitting = ref(false)
const lastInsertedId = ref<number | null>(null)

const mode = ref<Mode>('view')

watch(() => props.visible, (val) => {
  if (!val) return
  if (props.score > 0 && supabaseConfigured.value) {
    mode.value = 'submit'
  } else {
    mode.value = 'view'
    if (supabaseConfigured.value) fetch()
  }
}, { immediate: true })

async function handleSubmit() {
  submitting.value = true
  const ok = await submit(nickname.value, props.score)
  submitting.value = false
  if (ok) {
    await fetch()
    lastInsertedId.value = entries.value[0]?.id ?? null
    mode.value = 'viewing-after-submit'
  }
}

function switchToView() {
  mode.value = 'view'
  fetch()
}

// 一键分享成绩：移动端走原生系统分享面板；桌面端直接复制到剪贴板（更稳，避免系统分享面板卡死）
const shareState = ref<'idle' | 'shared' | 'copied'>('idle')
let shareTimer: number | undefined

// 触屏设备（手机/平板）才走 navigator.share；桌面直接复制，避免系统分享面板卡死转圈
const isTouchDevice = computed(
  () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
)

const shareLabel = computed(() => {
  if (shareState.value === 'shared') return '已分享 ✓'
  if (shareState.value === 'copied') return '已复制 ✓'
  return isTouchDevice.value ? '分享成绩' : '复制成绩'
})

async function shareScore() {
  const url = `${location.origin}/#/${props.game}`
  const text = `我在「${props.gameName}」拿了 ${props.score} 分！来小游戏合集挑战我：${url}`
  // 桌面端 navigator.share 常打开系统分享面板后卡死（无可用目标/缺 url），直接复制最稳；
  // 仅移动端走原生分享（可分享到微信等）。
  if (navigator.share && isTouchDevice.value) {
    try {
      await navigator.share({ title: '小游戏合集', text, url })
      markShared('shared')
      return
    } catch (err) {
      // 用户主动取消（AbortError）则保持原状；其它失败（无分享目标等）降级复制
      if ((err as Error)?.name === 'AbortError') return
    }
  }
  try {
    await copyText(text)
    markShared('copied')
  } catch {
    // 复制也失败：保持原状
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  } else {
    fallbackCopy(text)
  }
}

function markShared(state: 'shared' | 'copied') {
  shareState.value = state
  clearTimeout(shareTimer)
  shareTimer = window.setTimeout(() => (shareState.value = 'idle'), 2000)
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.top = '-9999px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try { document.execCommand('copy') } catch { /* ignore */ }
  document.body.removeChild(ta)
}

onUnmounted(() => clearTimeout(shareTimer))
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: max(24px, env(safe-area-inset-top) + 16px) 20px max(24px, env(safe-area-inset-bottom) + 16px);
}

.leaderboard-enter-active {
  animation: overlay-in 0.2s ease-out;
}
.leaderboard-enter-active .panel {
  animation: dialog-in 0.25s ease-out;
}
.leaderboard-leave-active {
  animation: overlay-out 0.18s ease-in;
}
.leaderboard-leave-active .panel {
  animation: dialog-out 0.18s ease-in;
}

.panel {
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 1px solid rgba(129, 140, 248, 0.3);
  border-radius: 20px;
  padding: 35px 30px;
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 0 60px rgba(129, 140, 248, 0.15);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  color: #6B7280;
  font-size: 1.2em;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover { color: #fff; }

h3 {
  text-align: center;
  color: #fff;
  font-size: 1.5em;
  margin-bottom: 25px;
}

/* 提交区域 */
.score-line {
  text-align: center;
  color: var(--game-text-info);
  margin-bottom: 15px;
}

.score-line strong {
  color: #FFD700;
  font-size: 1.4em;
  margin-left: 5px;
}

.nickname-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.nickname-row input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 10px 14px;
  color: #fff;
  font-size: 1em;
  outline: none;
  transition: border-color 0.2s;
}

.nickname-row input:focus { border-color: #818CF8; }

.submit-btn {
  background: linear-gradient(135deg, #818CF8, #B967FF);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.submit-btn:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow: 0 0 15px rgba(129, 140, 248, 0.4);
}

.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.skip-btn {
  display: block;
  margin: 0 auto;
  background: none;
  border: none;
  color: #6B7280;
  cursor: pointer;
  font-size: 0.9em;
  text-decoration: underline;
}

.skip-btn:hover { color: #818CF8; }

/* 排行榜 */
.status {
  text-align: center;
  color: var(--game-text-info);
  padding: 30px 0;
}

.status.error { color: #FF6B6B; }

.retry-btn {
  display: block;
  margin: 12px auto 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--game-text);
  padding: 8px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(129, 140, 248, 0.15);
  border-color: #818CF8;
}

.rank-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.03);
  transition: background 0.2s;
}

.rank-item.top { background: rgba(255, 215, 0, 0.08); }
.rank-item.isMe {
  background: rgba(129, 140, 248, 0.15);
  border: 1px solid rgba(129, 140, 248, 0.3);
}

.rank-num {
  width: 30px;
  font-size: 1.1em;
  text-align: center;
}

.rank-name {
  flex: 1;
  color: #fff;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-score {
  color: #FFD700;
  font-weight: 600;
  font-size: 1.05em;
}

.play-again-btn {
  display: block;
  width: 100%;
  margin-top: 20px;
  background: linear-gradient(135deg, var(--game-accent, #818CF8), #B967FF);
  color: #fff;
  border: none;
  padding: 13px;
  font-size: 1.05em;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.play-again-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent, #818CF8) 40%, transparent);
}

/* 分享成绩（次级按钮，区别于主按钮"再来一局"） */
.share-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  background: rgba(129, 140, 248, 0.1);
  border: 1px solid rgba(129, 140, 248, 0.4);
  color: #C7D2FE;
  padding: 12px;
  font-size: 1em;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.share-btn:hover {
  background: rgba(129, 140, 248, 0.2);
  box-shadow: 0 0 16px rgba(129, 140, 248, 0.3);
}

.share-btn.done {
  border-color: #34D399;
  color: #34D399;
  background: rgba(52, 211, 153, 0.12);
}
</style>
