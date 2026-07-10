<template>
  <Transition name="leaderboard">
    <div v-if="visible" class="overlay" @click.self="$emit('update:visible', false)">
      <div class="panel">
      <button class="close-btn" @click="$emit('update:visible', false)" title="关闭">✕</button>

      <!-- 标题 -->
      <h3>{{ gameName }} 排行榜</h3>

      <!-- Supabase 未配置 -->
      <div v-if="!supabaseConfigured" class="submit-area">
        <p class="status error">排行榜未配置：缺少 Supabase 环境变量</p>
      </div>

      <!-- 提交阶段：有分数且尚未提交 -->
      <div v-else-if="mode === 'submit'" class="submit-area">
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

      <!-- 排行榜展示 -->
      <div v-else class="leaderboard-area">
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
        <button
          v-if="props.score > 0"
          class="play-again-btn"
          @click="emit('replay')"
        >
          再来一局
        </button>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useLeaderboard } from '@/composables/useLeaderboard'

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

const nickname = ref('')
const submitting = ref(false)
const lastInsertedId = ref<number | null>(null)

const mode = ref<Mode>('view')

watch(() => props.visible, (val) => {
  if (!val) return
  if (props.score > 0) {
    mode.value = 'submit'
  } else {
    mode.value = 'view'
    fetch()
  }
}, { immediate: true })

async function handleSubmit() {
  submitting.value = true
  const ok = await submit(nickname.value, props.score)
  submitting.value = false
  if (ok) {
    lastInsertedId.value = entries.value[0]?.id ?? null
    mode.value = 'viewing-after-submit'
  }
}

function switchToView() {
  mode.value = 'view'
  fetch()
}

function rankLabel(idx: number): string {
  return ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}`
}
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
  padding: max(20px, env(safe-area-inset-top) + 16px) 20px max(20px, env(safe-area-inset-bottom) + 16px);
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
</style>
