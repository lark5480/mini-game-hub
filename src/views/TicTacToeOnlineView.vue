<template>
  <div class="game-container">
      <!-- 未配置 Supabase：优雅降级，不崩溃 -->
      <div v-if="room.status.value === 'no-supabase'" class="notice">
        <div class="notice-icon">🔌</div>
        <h3>联机功能未开启</h3>
        <p>本项目用 Supabase Realtime 做双人实时对战。在 <code>.env</code> 配置
          <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_ANON_KEY</code>（参考 <code>.env.example</code>）后重启即可联机。</p>
      </div>

      <template v-else>
        <!-- 房间号 + 复制 -->
        <div class="room-bar" :class="{ 'is-waiting': !opponentPresent }">
          <span class="room-label">房间号</span>
          <span class="room-code">{{ roomCode }}</span>
          <button class="copy-btn" @click="copyRoom">
            {{ copied ? '已复制 ✓' : '复制邀请链接' }}
          </button>
        </div>

        <div v-if="room.status.value === 'connecting'" class="banner">连接中…</div>
        <div v-else-if="room.status.value === 'reconnecting'" class="banner banner-warn">网络不稳定，正在重新连接…</div>
        <div v-else-if="room.status.value === 'error'" class="banner banner-warn">连接异常，请刷新重试</div>
        <div v-else-if="amSpectator" class="banner banner-warn">房间已满（已有两人），请换房间或刷新等待空位</div>
        <div v-else-if="!opponentPresent" class="banner banner-wait">
          等待对手加入…（把上面的房间号发给好友即可同玩）
        </div>
        <div v-else-if="opponentLeft" class="banner banner-warn">对手已离开，可点"重新开始"重置或刷新重新匹配</div>

        <div
          class="turn-indicator"
          :class="{ 'opp-turn': myRole && turn !== myRole }"
        >
          <span class="turn-dot" :class="{ me: myRole && turn === myRole, opp: myRole && turn !== myRole }"></span>
          {{ turnLabel }}
        </div>

        <div class="board">
          <button
            v-for="(cell, i) in board"
            :key="i"
            class="cell"
            :class="{ x: cell === 'X', o: cell === 'O', 'win-cell': winningLine.includes(i), disabled: !!cell || !myTurn || gameOver }"
            :disabled="!!cell || !myTurn || gameOver"
            @click="handleCellClick(i)"
          >
            <svg v-if="cell === 'X'" viewBox="0 0 24 24" class="mark x-mark">
              <path d="M6 6l12 12M18 6L6 18" stroke="#FF9E00" stroke-width="3" fill="none" stroke-linecap="round"/>
            </svg>
            <svg v-else-if="cell === 'O'" viewBox="0 0 24 24" class="mark o-mark">
              <circle cx="12" cy="12" r="8" stroke="#B967FF" stroke-width="3" fill="none"/>
            </svg>
          </button>
        </div>

        <div class="score-row">
          <div class="score-box">
            <span class="score-label">我方胜</span>
            <span class="score-value wins">{{ record.win }}</span>
          </div>
          <div class="score-box">
            <span class="score-label">平局</span>
            <span class="score-value draws">{{ record.draw }}</span>
          </div>
          <div class="score-box">
            <span class="score-label">我方负</span>
            <span class="score-value losses">{{ record.lose }}</span>
          </div>
        </div>

        <button class="reset-btn" @click="resetBoard(true)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          重新开始
        </button>
      </template>
    </div>

    <GameDialog
      v-model:visible="gameOverDialog"
      accentColor="#FF9E00"
      :icon="resultIcon"
      :title="resultTitle"
      :message="resultMessage"
    >
      <template #action>
        <button class="dialog-btn" @click="resetBoard(true)">再来一局</button>
      </template>
    </GameDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useRealtimeRoom } from '@/composables/useRealtimeRoom'
import GameDialog from '@/components/GameDialog.vue'

type Cell = 'X' | 'O' | null
type Board = Cell[]
type Result = 'win' | 'lose' | 'draw' | null

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

const router = useRouter()
const route = useRoute()
const sound = useSound()
const haptics = useHaptics()

// 房间号：优先用 URL 上的 ?room=XXXX（好友分享进来的），否则生成并写回 URL 方便复制。
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

const room = useRealtimeRoom(roomCode.value, { game: 'tic-tac-toe-2p' })

const board = ref<Board>(Array(9).fill(null))
const myRole = ref<Cell>(null)
const turn = ref<'X' | 'O'>('X')
const gameOver = ref(false)
const result = ref<Result>(null)
const winningLine = ref<number[]>([])
const record = ref({ win: 0, lose: 0, draw: 0 })
const copied = ref(false)

// 锁定两名玩家（[X_id, O_id]）：两人同时在线即锁定，任一人离开不足两人时解锁重排，
// 避免第三人加入时因 id 排序而抢占角色。
const lockedPlayers = ref<string[]>([])
const opponentId = ref<string | null>(null)
const amSpectator = computed(() => lockedPlayers.value.length >= 2 && !lockedPlayers.value.includes(room.myId))
const opponentPresent = computed(
  () => !!opponentId.value && room.peerIds.value.includes(opponentId.value),
)
const opponentLeft = computed(() => !opponentPresent.value && boardHasMoves())
const myTurn = computed(
  () => myRole.value !== null && !gameOver.value && turn.value === myRole.value && opponentPresent.value,
)
const turnLabel = computed(() => {
  if (amSpectator.value) return '房间已满，无法加入'
  if (room.status.value !== 'connected') return '连接中…'
  if (!opponentPresent.value) return '等待对手加入…'
  if (gameOver.value) {
    if (result.value === 'win') return '你赢了！'
    if (result.value === 'lose') return '对手获胜'
    return '平局'
  }
  if (!myRole.value) return '分配角色中…'
  return turn.value === myRole.value ? `你的回合（${myRole.value}）` : `对手回合（${turn.value}）`
})

const resultTitle = computed(() => {
  if (result.value === 'win') return '恭喜你获胜！'
  if (result.value === 'lose') return '再接再厉'
  return '势均力敌'
})
const resultMessage = computed(() => {
  if (result.value === 'win') return '击败了对手，干得漂亮！'
  if (result.value === 'lose') return '对手更胜一筹，再来一局？'
  return '不分胜负，再战一回？'
})
const resultIcon = computed<'success' | 'fail' | 'info'>(() => {
  if (result.value === 'win') return 'success'
  if (result.value === 'lose') return 'fail'
  return 'info'
})
const gameOverDialog = ref(false)

// ---- 角色分配：锁定前两位在线成员为 [X, O]，避免第三人加入时抢占角色 ----
let peerCountPrev = 0
room.onPresenceSync((ids: string[]) => {
  const present = ids.slice().sort()
  // 已锁定：仅当原两人都离开才解锁，保证单人掉线重连后角色不翻转
  if (lockedPlayers.value.length === 2) {
    const here = lockedPlayers.value.filter(id => present.includes(id))
    if (here.length === 0) lockedPlayers.value = []
  }
  if (lockedPlayers.value.length === 0 && present.length >= 2) {
    lockedPlayers.value = present.slice(0, 2)
  }
  const iAmP = lockedPlayers.value.includes(room.myId)
  myRole.value = iAmP ? (lockedPlayers.value[0] === room.myId ? 'X' : 'O') : null
  opponentId.value = iAmP ? (lockedPlayers.value.find(id => id !== room.myId) ?? null) : null
  // 中途加入 / 重连且本地无棋局 → 向对手请求权威状态（双向：任一有棋局的端都会回）
  if (peerCountPrev < 2 && present.length >= 2 && !boardHasMoves() && iAmP) {
    setTimeout(() => room.send('sync-req', {}), 300)
  }
  peerCountPrev = present.length
})

// 仅接受对手(锁定玩家中的另一方)的消息，忽略第三者；离散落子事件，各自确定性推进
room.on('move', (data: any, from?: string) => {
  if (!from || from !== opponentId.value) return
  if (!data || typeof data.index !== 'number') return
  applyMove(data.index, data.by as Cell)
})
room.on('reset', (_data: any, from?: string) => {
  if (from && opponentId.value && from !== opponentId.value) return
  resetBoard(false)
})
room.on('sync-req', () => {
  if (!boardHasMoves()) return
  room.send('state', authorizedState())
})
room.on('state', (s: any) => applyRemoteState(s))

// 仅同步权威所需的最小状态（不含 result，result 由接收方按自身角色推导，避免视角错乱）
function authorizedState() {
  return {
    board: board.value.slice(),
    turn: turn.value,
    gameOver: gameOver.value,
  }
}

// 接收方采用对手的权威局面；若已终局则按本地角色推导胜负并更新战绩
function applyRemoteState(s: any) {
  if (!s || !Array.isArray(s.board) || s.board.length !== 9) return
  board.value = s.board
  turn.value = s.turn === 'O' ? 'O' : 'X'
  gameOver.value = !!s.gameOver
  if (gameOver.value) {
    if (result.value === null) finalizeFromBoard()
  } else {
    result.value = null
    winningLine.value = []
    gameOverDialog.value = false
  }
}

// 从棋盘推导终局结果（按本端角色），更新战绩与反馈
function finalizeFromBoard() {
  const line = findWinningLine(board.value)
  winningLine.value = line ?? []
  if (line) {
    result.value = board.value[line[0]] === myRole.value ? 'win' : 'lose'
  } else {
    result.value = 'draw'
  }
  if (result.value === 'win') { record.value.win++; sound.win(); haptics.win() }
  else if (result.value === 'lose') { record.value.lose++; sound.gameOver(); haptics.error() }
  else { record.value.draw++; haptics.tap() }
  gameOverDialog.value = true
}

function boardHasMoves(): boolean {
  return board.value.some(c => c !== null)
}

function handleCellClick(i: number) {
  if (!myTurn.value || board.value[i] !== null || !myRole.value) return
  applyMove(i, myRole.value)
  room.send('move', { index: i, by: myRole.value })
}

// 本地落子 + 推进回合；广播接收方也走这里（self:false 保证发起方不会收到自己的广播）
function applyMove(i: number, by: Cell) {
  if (gameOver.value || board.value[i] !== null) return
  board.value[i] = by
  sound.select()
  haptics.tap()

  const line = findWinningLine(board.value)
  if (line) {
    endGame(by, line)
    return
  }
  if (isBoardFull(board.value)) {
    endGame(null, [])
    return
  }
  turn.value = by === 'X' ? 'O' : 'X'
}

function endGame(winner: Cell, line: number[]) {
  gameOver.value = true
  winningLine.value = line
  if (winner === null) {
    result.value = 'draw'
    record.value.draw++
    haptics.tap()
  } else if (winner === myRole.value) {
    result.value = 'win'
    record.value.win++
    sound.win()
    haptics.win()
  } else {
    result.value = 'lose'
    record.value.lose++
    sound.gameOver()
    haptics.error()
  }
  gameOverDialog.value = true
}

function resetBoard(broadcast: boolean) {
  board.value = Array(9).fill(null)
  turn.value = 'X'
  gameOver.value = false
  result.value = null
  winningLine.value = []
  gameOverDialog.value = false
  if (broadcast) room.send('reset', {})
}

// 复制文本：优先 Clipboard API（需安全上下文），HTTP 局域网下降级到 execCommand
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到降级方案
  }
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
  // localhost / 127.0.0.1 下 window.location.href 指向对方自己的机器，复制出去无效；
  // 这种开发场景改为复制房间号，对方在自己设备上打开应用输入即可加入。
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const text = isLocalhost ? `房间号 ${roomCode.value}` : window.location.href
  const ok = await copyText(text)
  copied.value = ok
  if (ok) setTimeout(() => (copied.value = false), 1500)
}

// ---- 游戏逻辑 ----
function findWinningLine(b: Board): number[] | null {
  for (const line of WIN_LINES) {
    const [a, c, d] = line
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return line
  }
  return null
}
function isBoardFull(b: Board): boolean {
  return b.every(c => c !== null)
}

onMounted(() => {
  if (!(typeof route.query.room === 'string' && /^[A-Z0-9]{4}$/.test(route.query.room))) {
    router.replace({ query: { ...route.query, room: roomCode.value } })
  }
})

// 作为 TicTacToeView 的联机子组件时，由父组件的重启按钮触发
defineExpose({ resetBoard })
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 20px;
}

.notice {
  max-width: 420px;
  text-align: center;
  background: rgba(255, 158, 0, 0.06);
  border: 1px solid rgba(255, 158, 0, 0.3);
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
  color: #FF9E00;
  font-size: 0.9em;
}

.room-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: rgba(255, 158, 0, 0.07);
  border: 1px solid rgba(255, 158, 0, 0.3);
  border-radius: 30px;
}
.room-label { color: #9aa0b5; font-size: 0.9em; }
.room-code {
  font-size: 1.4em;
  font-weight: 700;
  letter-spacing: 4px;
  color: #FF9E00;
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
.copy-btn:hover { background: rgba(185, 103, 255, 0.18); border-color: #B967FF; }

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

.turn-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.05em;
  color: #fff;
  padding: 10px 22px;
  background: rgba(255, 158, 0, 0.08);
  border: 1px solid rgba(255, 158, 0, 0.3);
  border-radius: 30px;
  transition: all 0.3s ease;
}
.turn-indicator.opp-turn {
  background: rgba(185, 103, 255, 0.08);
  border-color: rgba(185, 103, 255, 0.35);
}
.turn-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #FF9E00;
  box-shadow: 0 0 12px #FF9E00;
}
.turn-dot.opp { background: #B967FF; box-shadow: 0 0 12px #B967FF; }

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: min(360px, 80vw);
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 18px;
  border: 2px solid rgba(255, 158, 0, 0.25);
  box-shadow: 0 0 40px rgba(255, 158, 0, 0.15);
}
.cell {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}
.cell:hover:not(.disabled) {
  background: rgba(255, 158, 0, 0.1);
  border-color: rgba(255, 158, 0, 0.5);
  transform: scale(1.03);
}
.cell.disabled { cursor: default; }
.cell.x { background: rgba(255, 158, 0, 0.12); border-color: rgba(255, 158, 0, 0.4); }
.cell.o { background: rgba(185, 103, 255, 0.1); border-color: rgba(185, 103, 255, 0.35); }
.cell.win-cell {
  animation: winPulse 1s ease-in-out infinite;
  border-color: #FFD700;
  background: rgba(255, 215, 0, 0.15);
}
.mark { width: 75%; height: 75%; animation: appear 0.25s ease; }

.score-row { display: flex; gap: 16px; }
.score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 22px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  min-width: 80px;
}
.score-label { font-size: 0.78em; color: var(--game-text-muted); }
.score-value { font-size: 1.5em; font-weight: 700; color: #fff; }
.score-value.win { color: #05FFA1; }
.score-value.draw { color: #FFD700; }
.score-value.lose { color: #FF6B6B; }

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #FF9E00, #B967FF);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 14px;
  font-size: 1.05em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.reset-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255, 158, 0, 0.4); }

.dialog-btn {
  background: linear-gradient(135deg, var(--game-accent, #FF9E00), #B967FF);
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

@keyframes winPulse {
  0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }
  50% { box-shadow: 0 0 26px rgba(255, 215, 0, 0.8); }
}
@keyframes appear {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 640px) {
  .board { width: min(300px, 85vw); }
  .score-box { padding: 8px 14px; min-width: 65px; }
}
</style>
