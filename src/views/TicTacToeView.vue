<template>
  <GameLayout
    title="井字棋"
    accentColor="#FF006E"
    gradientEnd="#00CFFF"
    :hints="['点击空位落子', 'X 先手，AI 为 O']"
    :infoItems="[{ label: '状态', value: statusLabel }]"
    tutorial="在3×3棋盘上先连成三子即获胜。你执X先手，AI执O。"
    @back="goHome"
    @restart="() => resetGame(false)"
  >
    <div class="game-container">
      <div class="turn-indicator" :class="{ 'bot-turn': !isPlayerTurn }">
        <span class="turn-dot" :class="{ player: isPlayerTurn, bot: !isPlayerTurn }"></span>
        {{ statusLabel }}
      </div>

      <div class="board">
        <button
          v-for="(cell, i) in board"
          :key="i"
          class="cell"
          :class="{ x: cell === 'X', o: cell === 'O', 'win-cell': winningLine.includes(i), disabled: !!cell || !isPlayerTurn || gameOver }"
          :disabled="!!cell || !isPlayerTurn || gameOver"
          @click="handleCellClick(i)"
        >
          <svg v-if="cell === 'X'" viewBox="0 0 24 24" class="mark x-mark">
            <path d="M6 6l12 12M18 6L6 18" stroke="#FF006E" stroke-width="3" fill="none" stroke-linecap="round"/>
          </svg>
          <svg v-else-if="cell === 'O'" viewBox="0 0 24 24" class="mark o-mark">
            <circle cx="12" cy="12" r="8" stroke="#00CFFF" stroke-width="3" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="score-row">
        <div class="score-box">
          <span class="score-label">胜利</span>
          <span class="score-value wins">{{ stats.wins }}</span>
        </div>
        <div class="score-box">
          <span class="score-label">平局</span>
          <span class="score-value draws">{{ stats.draws }}</span>
        </div>
        <div class="score-box">
          <span class="score-label">失败</span>
          <span class="score-value losses">{{ stats.losses }}</span>
        </div>
      </div>

      <button class="reset-btn" @click="resetGame(false)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M8 16H3v5"/>
        </svg>
        重新开始
      </button>
    </div>

    <LeaderboardStrip game="tic-tac-toe" />

    <template #controls>
      <button class="submit-score-btn" @click="openLeaderboard">查看排行榜</button>
    </template>

    <GameDialog
      v-model:visible="gameOverDialog"
      accentColor="#FF006E"
      :icon="resultIcon"
      :title="resultTitle"
      :message="resultMessage"
      :actionText="lastScore > 0 ? '提交分数' : undefined"
      @action="openLeaderboardFromDialog"
    >
      <template v-if="lastScore === 0" #action>
        <button class="dialog-btn" @click="resetGame(false)">再来一局</button>
      </template>
    </GameDialog>

    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="tic-tac-toe"
      gameName="井字棋"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="resetGame(false)"
    />
    <ResumePrompt :visible="paused" @continue="continueGame" @new-game="newGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useSound } from '@/composables/useSound'
import { useGameSave } from '@/composables/useGameSave'
import { useHaptics } from '@/composables/useHaptics'
import { usePause } from '@/composables/usePause'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import ResumePrompt from '@/components/ResumePrompt.vue'

type Cell = 'X' | 'O' | null
type Board = Cell[]
type Result = 'win' | 'lose' | 'draw' | null

const PLAYER: Cell = 'X'
const BOT: Cell = 'O'
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()
const haptics = useHaptics()
const board = ref<Board>(Array(9).fill(null))
const isPlayerTurn = ref(true)
const gameOver = ref(false)
const result = ref<Result>(null)
const winningLine = ref<number[]>([])

const gameOverDialog = ref(false)
const showLeaderboard = ref(false)
const lastScore = ref(0)
const stats = ref({ wins: 0, draws: 0, losses: 0 })

const save = useGameSave('tic-tac-toe')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let botTimer: ReturnType<typeof setTimeout> | null = null

// 暂停/恢复：回合制游戏仅在非结束状态且轮到玩家时可暂停
const { paused, pause: pauseGame, resume: resumeGame } = usePause({
  isPlaying: () => !gameOver.value && result.value === null,
  isGameOver: () => gameOver.value,
  onPause: () => { if (botTimer) { clearTimeout(botTimer); botTimer = null } },
  onResume: () => { if (!isPlayerTurn.value && !gameOver.value) botTimer = setTimeout(makeBotMove, 380) }
})

const statusLabel = computed(() => {
  if (gameOver.value) {
    if (result.value === 'win') return '你赢了！'
    if (result.value === 'lose') return 'AI 获胜'
    return '平局'
  }
  return isPlayerTurn.value ? '你的回合 (X)' : 'AI 思考中...'
})

const resultTitle = computed(() => {
  if (result.value === 'win') return '恭喜你获胜！'
  if (result.value === 'lose') return '再接再厉'
  return '势均力敌'
})

const resultMessage = computed(() => {
  if (result.value === 'win') return `战胜了 AI，获得 ${lastScore.value} 分`
  if (result.value === 'lose') return 'AI 更胜一筹，再来一局？'
  return `不分胜负，获得 ${lastScore.value} 分`
})

const resultIcon = computed<'success' | 'fail' | 'info'>(() => {
  if (result.value === 'win') return 'success'
  if (result.value === 'lose') return 'fail'
  return 'info'
})

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (gameOver.value) return
    save.saveGame({
      board: board.value,
      isPlayerTurn: isPlayerTurn.value,
      gameOver: gameOver.value,
      result: result.value,
      stats: stats.value
    })
  }, 300)
}

function clearSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  save.clearGame()
}

function handleCellClick(index: number) {
  if (gameOver.value || !isPlayerTurn.value || board.value[index] !== null) return
  board.value[index] = PLAYER
  sound.select()
  haptics.tap()

  const line = findWinningLine(board.value)
  if (line) {
    endGame('win', line)
    return
  }
  if (isBoardFull(board.value)) {
    endGame('draw', [])
    return
  }

  isPlayerTurn.value = false
  scheduleSave()
  botTimer = setTimeout(makeBotMove, 380)
}

function makeBotMove() {
  if (gameOver.value) return
  const move = bestMove(board.value)
  if (move !== -1) {
    board.value[move] = BOT
    sound.select()
    haptics.tap()
  }

  const line = findWinningLine(board.value)
  if (line) {
    endGame('lose', line)
    return
  }
  if (isBoardFull(board.value)) {
    endGame('draw', [])
    return
  }

  isPlayerTurn.value = true
  scheduleSave()
}

function endGame(res: Exclude<Result, null>, line: number[]) {
  gameOver.value = true
  result.value = res
  winningLine.value = line

  let score = 0
  if (res === 'win') {
    stats.value.wins++
    score = 100
    sound.win()
    haptics.win()
  } else if (res === 'draw') {
    stats.value.draws++
    score = 50
    haptics.tap()
  } else {
    stats.value.losses++
    sound.gameOver()
    haptics.error()
  }
  lastScore.value = score
  gameStore.addScore('tic-tac-toe', score)
  clearSave()
  gameOverDialog.value = true
}

function continueGame() {
  resumeGame()
}

function newGame() {
  resumeGame()
  resetGame(false)
}

function resetGame(restoring: boolean) {
  gameOverDialog.value = false
  showLeaderboard.value = false
  if (botTimer) { clearTimeout(botTimer); botTimer = null }
  board.value = Array(9).fill(null)
  isPlayerTurn.value = true
  gameOver.value = false
  result.value = null
  winningLine.value = []
  lastScore.value = 0
  if (!restoring) clearSave()
}

function openLeaderboard() {
  showLeaderboard.value = true
}

function openLeaderboardFromDialog() {
  gameOverDialog.value = false
  showLeaderboard.value = true
}

function goHome() {
  clearSave()
  router.push('/')
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

function winnerOf(b: Board): Cell {
  for (const line of WIN_LINES) {
    const [x, y, z] = line
    if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x]
  }
  return null
}

function minimax(b: Board, current: Cell, alpha: number, beta: number): number {
  const w = winnerOf(b)
  if (w === BOT) return 10
  if (w === PLAYER) return -10
  if (isBoardFull(b)) return 0

  if (current === BOT) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (b[i] !== null) continue
      b[i] = BOT
      const score = minimax(b, PLAYER, alpha, beta)
      b[i] = null
      best = Math.max(best, score)
      alpha = Math.max(alpha, score)
      if (beta <= alpha) break
    }
    return best
  }

  let best = Infinity
  for (let i = 0; i < 9; i++) {
    if (b[i] !== null) continue
    b[i] = PLAYER
    const score = minimax(b, BOT, alpha, beta)
    b[i] = null
    best = Math.min(best, score)
    beta = Math.min(beta, score)
    if (beta <= alpha) break
  }
  return best
}

// AI 犯错概率：在"不立即输"的走法中随机选，给玩家留出可乘之机
const BOT_MISTAKE_CHANCE = 0.3

function bestMove(b: Board): number {
  const moves: { idx: number; score: number }[] = []
  for (let i = 0; i < 9; i++) {
    if (b[i] !== null) continue
    b[i] = BOT
    const score = minimax(b, PLAYER, -Infinity, Infinity)
    b[i] = null
    moves.push({ idx: i, score })
  }
  if (moves.length === 0) return -1

  // 找出最优分数
  const bestScore = Math.max(...moves.map(m => m.score))

  // 以一定概率"犯错"：从"不能获胜"的走法中随机选（含平局/落败局面）
  if (Math.random() < BOT_MISTAKE_CHANCE) {
    const nonWinning = moves.filter(m => m.score <= 0)
    const pool = nonWinning.length > 0 ? nonWinning : moves
    return pool[Math.floor(Math.random() * pool.length)].idx
  }

  // 正常情况：选最优
  const best = moves.filter(m => m.score === bestScore)
  return best[Math.floor(Math.random() * best.length)].idx
}

onMounted(() => {
  const data = save.loadGame()
  if (data && Array.isArray(data.board) && data.board.length === 9 && data.gameOver === false) {
    const savedResult = data.result as Result | undefined
    if (savedResult === null || savedResult === undefined) {
      board.value = data.board as Board
      isPlayerTurn.value = data.isPlayerTurn === undefined ? true : !!data.isPlayerTurn
      gameOver.value = false
      result.value = null
      if (data.stats && typeof data.stats === 'object') {
        const s = data.stats as { wins?: number; draws?: number; losses?: number }
        stats.value = {
          wins: s.wins || 0,
          draws: s.draws || 0,
          losses: s.losses || 0
        }
      }
      pauseGame()
      return
    }
  }
  resetGame(true)
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  if (botTimer) clearTimeout(botTimer)
})
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px;
}

.turn-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.05em;
  color: #fff;
  padding: 10px 22px;
  background: rgba(255, 0, 110, 0.08);
  border: 1px solid rgba(255, 0, 110, 0.3);
  border-radius: 30px;
  transition: all 0.3s ease;
}

.turn-indicator.bot-turn {
  background: rgba(0, 207, 255, 0.08);
  border-color: rgba(0, 207, 255, 0.35);
}

.turn-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #FF006E;
  box-shadow: 0 0 12px #FF006E;
  transition: all 0.3s ease;
}

.turn-dot.bot {
  background: #00CFFF;
  box-shadow: 0 0 12px #00CFFF;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: min(360px, 80vw);
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 18px;
  border: 2px solid rgba(255, 0, 110, 0.25);
  box-shadow: 0 0 40px rgba(255, 0, 110, 0.15);
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
  background: rgba(255, 0, 110, 0.1);
  border-color: rgba(255, 0, 110, 0.5);
  transform: scale(1.03);
}

.cell.disabled {
  cursor: default;
}

.cell.x {
  background: rgba(255, 0, 110, 0.12);
  border-color: rgba(255, 0, 110, 0.4);
}

.cell.o {
  background: rgba(0, 207, 255, 0.1);
  border-color: rgba(0, 207, 255, 0.35);
}

.cell.win-cell {
  animation: winPulse 1s ease-in-out infinite;
  border-color: #FFD700;
  background: rgba(255, 215, 0, 0.15);
}

@keyframes winPulse {
  0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.4); }
  50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8); }
}

.mark {
  width: 75%;
  height: 75%;
  animation: appear 0.25s ease;
}

@keyframes appear {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.score-row {
  display: flex;
  gap: 16px;
}

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

.score-label {
  font-size: 0.78em;
  color: var(--game-text-muted);
}

.score-value {
  font-size: 1.5em;
  font-weight: 700;
  color: #fff;
}

.score-value.wins { color: #05FFA1; }
.score-value.draws { color: #FFD700; }
.score-value.losses { color: #FF6B6B; }

.reset-btn,
.submit-score-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #FF006E, #00CFFF);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 14px;
  font-size: 1.05em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover,
.submit-score-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 0, 110, 0.4);
}

.submit-score-btn {
  background: linear-gradient(135deg, #818CF8, #B967FF);
}

.dialog-btn {
  background: linear-gradient(135deg, var(--game-accent, #00FFFF), #00CFFF);
  color: #0D0D1A;
  border: none;
  padding: 12px 35px;
  font-size: 1.1em;
  font-weight: 600;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent, #00FFFF) 40%, transparent);
}

@media (max-width: 640px) {
  .board {
    width: min(300px, 85vw);
  }
  .score-box {
    padding: 8px 14px;
    min-width: 65px;
  }
}
</style>
