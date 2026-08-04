<template>
  <div class="game-container">
    <!-- 未配置 Supabase：优雅降级 -->
    <div v-if="room.status.value === 'no-supabase'" class="notice">
      <div class="notice-icon">🔌</div>
      <h3>联机功能未开启</h3>
      <p>本项目用 Supabase Realtime 做双人实时对战。在 <code>.env</code> 配置
        <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_ANON_KEY</code>（参考 <code>.env.example</code>）后重启即可联机。</p>
    </div>

    <template v-else>
      <!-- 房间号 + 复制 -->
      <div class="room-bar" :class="{ 'is-waiting': !room.opponentPresent.value }">
        <span class="room-label">房间号</span>
        <span class="room-code">{{ roomCode }}</span>
        <button class="copy-btn" @click="copyRoom">
          {{ copied ? '已复制 ✓' : '复制邀请链接' }}
        </button>
      </div>

      <!-- 状态 banner -->
      <div v-if="room.status.value === 'connecting'" class="banner">连接中…</div>
      <div v-else-if="room.status.value === 'reconnecting'" class="banner banner-warn">网络不稳定，正在重新连接…</div>
      <div v-else-if="room.status.value === 'error'" class="banner banner-warn">连接异常，请刷新重试</div>
      <div v-else-if="room.amSpectator.value" class="banner banner-warn">房间已满（已有两人），请换房间或刷新等待空位</div>
      <div v-else-if="room.opponentLeft.value" class="banner banner-warn">{{ phase === 'playing' ? '对手已离开，时间到后结算（标注"对手已离开"）' : '对手已离开' }}</div>
      <div v-else-if="!room.opponentPresent.value" class="banner banner-wait">
        等待对手加入…（把上面的房间号发给好友即可同玩）
      </div>

      <!-- 对手实时分数条 -->
      <div v-if="room.opponentPresent.value || room.opponentLeft.value" class="opponent-bar">
        <span class="opp-label">对手</span>
        <span class="opp-score">{{ room.opponentScore.value }}</span>
        <span class="opp-divider">|</span>
        <span class="opp-label">我方</span>
        <span class="opp-score me">{{ myScore }}</span>
      </div>

      <!-- 倒计时覆盖层 -->
      <div v-if="countdown !== null" class="countdown-overlay">
        <div class="countdown-num" :key="countdown">{{ countdown === 0 ? '开始!' : countdown }}</div>
      </div>

      <!-- 棋盘 -->
      <WhackAMoleBoard
        ref="boardRef"
        :difficulty="room.difficulty.value"
        @score="onScore"
        @gameover="onGameOver"
        @start="onStart"
      />

      <!-- 房主操作区：选难度 + 开始 -->
      <div v-if="room.isHost.value && phase === 'idle'" class="host-controls">
        <div class="difficulty-buttons">
          <button
            v-for="d in difficulties"
            :key="d.name"
            class="diff-btn"
            :class="{ active: room.difficulty.value === d.name }"
            @click="onSelectDifficulty(d.name)"
          >
            {{ d.label }}
          </button>
        </div>
        <button class="start-btn" :disabled="!room.opponentPresent.value" @click="onHostStart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8v7a4 4 0 0 0 8 0V8"/>
          </svg>
          {{ room.opponentPresent.value ? '开始游戏' : '等待对手…' }}
        </button>
      </div>
      <div v-else-if="phase === 'idle' && !room.isHost.value" class="banner banner-wait">
        等待房主开始…
      </div>
    </template>
  </div>

  <!-- 结算弹窗 -->
  <GameDialog
    v-model:visible="showSettle"
    accentColor="#FF7A3D"
    :icon="settleIcon"
    :title="settleTitle"
    :message="settleMessage"
  >
    <template #action>
      <button v-if="room.isHost.value && !playAgainWaiting" class="dialog-btn" @click="onPlayAgain">再来一局</button>
      <span v-else-if="playAgainWaiting" class="wait-hint">等待对方确认…</span>
      <span v-else-if="!room.isHost.value && !playAgainConfirm" class="wait-hint">等待房主开始下一局…</span>
    </template>
  </GameDialog>

  <!-- 客人再来一局确认面板 -->
  <div v-if="playAgainConfirm" class="play-again-confirm">
    <p class="play-again-text">房主邀请再来一局</p>
    <div class="play-again-actions">
      <button class="dialog-btn" @click="acceptPlayAgain">接受</button>
      <button class="dialog-btn dialog-btn-ghost" @click="declinePlayAgain">拒绝</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useRaceRoom } from '@/composables/useRaceRoom'
import WhackAMoleBoard from '@/components/WhackAMoleBoard.vue'
import GameDialog from '@/components/GameDialog.vue'

const difficulties = [
  { name: 'easy', label: '简单' },
  { name: 'normal', label: '普通' },
  { name: 'hard', label: '困难' },
]

type Phase = 'idle' | 'countdown' | 'playing' | 'settled'

const router = useRouter()
const route = useRoute()
const sound = useSound()
const haptics = useHaptics()
const toast = useToast()

// 房间号：沿用 TTT 格式（4 位字母数字）
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode(): string {
  let c = ''
  for (let i = 0; i < 4; i++) c += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]
  return c
}
const roomCode = ref('')
const q = route.query.room
if (typeof q === 'string' && /^[A-Z0-9]{4}$/.test(q)) roomCode.value = q
else roomCode.value = genCode()

const boardRef = ref<InstanceType<typeof WhackAMoleBoard> | null>(null)
const phase = ref<Phase>('idle')
const myScore = ref(0)
const countdown = ref<number | null>(null)
const showSettle = ref(false)
const settleResult = ref<{ me: number; opponent: number; outcome: string } | null>(null)
const copied = ref(false)
// 再来一局：房主等待客人确认 / 客人确认面板
const playAgainWaiting = ref(false)
const playAgainConfirm = ref(false)
// 倒计时挂起的 setTimeout id（可取消）
let countdownTimer: number | undefined

const room = useRaceRoom(roomCode.value, {
  game: 'whackamole-race',
  onStartCountdown: () => { if (phase.value === 'idle') runCountdown() },
  onSettle: (r) => showSettleResult(r.me, r.opponent, r.outcome),
  onPlayAgainRequest: () => { playAgainConfirm.value = true },
  onPlayAgainAccept: () => { resetForNextRound(); runCountdown() },
  onPlayAgainDeclined: () => {
    playAgainWaiting.value = false
    toast.show('对方拒绝了再来一局', 'info')
  },
})

const settleIcon = computed<'success' | 'fail' | 'info'>(() => {
  const o = settleResult.value?.outcome
  if (o === 'win') return 'success'
  if (o === 'lose') return 'fail'
  return 'info'
})
const settleTitle = computed(() => {
  const o = settleResult.value?.outcome
  if (o === 'win') return '你赢了！'
  if (o === 'lose') return '对手获胜'
  if (o === 'opponent-left') return '对手已离开'
  return '平局'
})
const settleMessage = computed(() => {
  const r = settleResult.value
  if (!r) return ''
  if (r.outcome === 'opponent-left') return `本局对手中途离开。你的得分 ${r.me}。`
  return `你的得分 ${r.me} · 对手得分 ${r.opponent}`
})

function onSelectDifficulty(name: string) {
  if (phase.value !== 'idle') return
  room.setDifficulty(name)
}

function onHostStart() {
  if (phase.value !== 'idle') return
  if (!room.isHost.value || !room.opponentPresent.value) return
  room.requestStart()
  runCountdown()
}

function runCountdown() {
  phase.value = 'countdown'
  countdown.value = 3
  const tick = () => {
    if (countdown.value !== null && countdown.value > 0) {
      countdownTimer = window.setTimeout(() => {
        countdown.value!--
        tick()
      }, 700)
    } else {
      // 开始!
      countdownTimer = window.setTimeout(() => {
        countdownTimer = undefined
        countdown.value = null
        phase.value = 'playing'
        boardRef.value?.startGame()
      }, 500)
    }
  }
  tick()
}

function onStart() {
  myScore.value = 0
}

function onScore(score: number) {
  myScore.value = score
  room.sendScore(score)
}

function onGameOver(score: number) {
  myScore.value = score
  room.sendFinalScore(score)
}

function showSettleResult(me: number, opponent: number, outcome: string) {
  settleResult.value = { me, opponent, outcome }
  phase.value = 'settled'
  if (outcome === 'win') { sound.win(); haptics.win() }
  else if (outcome === 'lose') { sound.gameOver(); haptics.error() }
  else { haptics.tap() }
  showSettle.value = true
}

function resetForNextRound() {
  if (countdownTimer !== undefined) {
    window.clearTimeout(countdownTimer)
    countdownTimer = undefined
  }
  countdown.value = null
  showSettle.value = false
  settleResult.value = null
  myScore.value = 0
  phase.value = 'idle'
  boardRef.value?.stopGame()
}

function onPlayAgain() {
  if (!room.isHost.value) return
  room.requestPlayAgain()
  playAgainWaiting.value = true
}

function acceptPlayAgain() {
  playAgainConfirm.value = false
  room.acceptPlayAgain()
  resetForNextRound()
}
function declinePlayAgain() {
  playAgainConfirm.value = false
  room.declinePlayAgain()
}

// 复制邀请链接
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 降级 */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

async function copyRoom() {
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const text = isLocalhost ? `房间号 ${roomCode.value}` : window.location.href
  const ok = await copyText(text)
  copied.value = ok
  if (ok) setTimeout(() => (copied.value = false), 1500)
}

onMounted(() => {
  if (!(typeof route.query.room === 'string' && /^[A-Z0-9]{4}$/.test(route.query.room))) {
    router.replace({ query: { ...route.query, room: roomCode.value } })
  }
})

onUnmounted(() => {
  if (countdownTimer !== undefined) {
    window.clearTimeout(countdownTimer)
    countdownTimer = undefined
  }
})

defineExpose({ resetForNextRound })
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 20px;
  position: relative;
}

.notice {
  max-width: 420px;
  text-align: center;
  background: rgba(255, 122, 61, 0.06);
  border: 1px solid rgba(255, 122, 61, 0.3);
  border-radius: 18px;
  padding: 28px 24px;
  color: #fff;
}
.notice-icon { font-size: 2.4em; margin-bottom: 10px; }
.notice h3 { font-size: 1.3em; margin-bottom: 12px; }
.notice p { color: #9aa0b5; line-height: 1.7; font-size: 0.95em; }
.notice code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 7px;
  border-radius: 6px;
  color: #FF7A3D;
  font-size: 0.9em;
}

.room-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: rgba(255, 122, 61, 0.07);
  border: 1px solid rgba(255, 122, 61, 0.3);
  border-radius: 30px;
}
.room-label { color: #9aa0b5; font-size: 0.9em; }
.room-code {
  font-size: 1.4em;
  font-weight: 700;
  letter-spacing: 4px;
  color: #FF7A3D;
}
.copy-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 7px 14px;
  border-radius: 16px;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s ease;
}
.copy-btn:hover { background: rgba(255, 122, 61, 0.18); border-color: #FF7A3D; }

.banner {
  font-size: 0.95em;
  padding: 9px 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cfd3e0;
}
.banner-wait { color: #FFD700; border-color: rgba(255, 215, 0, 0.3); background: rgba(255, 215, 0, 0.06); }
.banner-warn { color: #FF6B6B; border-color: rgba(255, 107, 107, 0.3); background: rgba(255, 107, 107, 0.06); }

.opponent-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  background: rgba(255, 122, 61, 0.08);
  border: 1px solid rgba(255, 122, 61, 0.25);
  border-radius: 20px;
  font-size: 0.95em;
}
.opp-label { color: #9aa0b5; font-size: 0.85em; }
.opp-score { font-weight: 700; color: #FF7A3D; font-size: 1.1em; }
.opp-score.me { color: #05FFA1; }
.opp-divider { color: rgba(255,255,255,0.2); }

.countdown-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  pointer-events: none;
}
.countdown-num {
  font-size: 5em;
  font-weight: 800;
  color: #FFD700;
  text-shadow: 0 0 40px rgba(255, 215, 0, 0.6);
  animation: countPop 0.5s ease-out;
}

.host-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.difficulty-buttons { display: flex; gap: 10px; }

.diff-btn {
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.diff-btn:hover { border-color: var(--game-accent); }
.diff-btn.active {
  background: rgba(255, 122, 61, 0.3);
  border-color: #FF7A3D;
  color: #FF7A3D;
}

.start-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #FF7A3D, #FF8E8E);
  border: none;
  color: #fff;
  padding: 14px 35px;
  border-radius: 15px;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.start-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(255,122,61,0.4); }
.start-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.dialog-btn {
  background: linear-gradient(135deg, var(--game-accent, #FF7A3D), #FFD700);
  color: #0D0D1A;
  border: none;
  padding: 12px 35px;
  font-size: 1.1em;
  font-weight: 600;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}
.dialog-btn:hover { transform: scale(1.05); }

.wait-hint { color: #9aa0b5; font-size: 0.9em; }

.play-again-confirm {
  margin-top: 16px;
  padding: 18px 22px;
  background: rgba(255, 122, 61, 0.08);
  border: 1px solid rgba(255, 122, 61, 0.3);
  border-radius: 16px;
  text-align: center;
}
.play-again-text {
  color: #cfd3e0;
  font-size: 0.95em;
  margin: 0 0 12px;
}
.play-again-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.dialog-btn-ghost {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #cfd3e0;
}
.dialog-btn-ghost:hover { background: rgba(255, 255, 255, 0.12); }

@media (max-width: 640px) {
  .countdown-num { font-size: 3.5em; }
}
</style>
