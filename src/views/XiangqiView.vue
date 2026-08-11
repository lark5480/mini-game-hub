<template>
<GameLayout
    :title="layoutTitle"
    :accentColor="layoutAccent"
    :gradientEnd="layoutGradient"
    :entrance="layoutEntrance"
    :hints="layoutHints"
    :infoItems="layoutInfoItems"
    :tutorial="layoutTutorial"
    :confirmRestart="mode !== 'online'"
    @back="goHome"
    @restart="onRestart"
  >
    <!-- 模式选择屏 -->
    <div v-if="mode === null" class="mode-panel">
      <h2 class="mode-title">中国象棋</h2>
      <p class="mode-sub">选择对战模式</p>
      <div class="mode-buttons">
        <button class="mode-card" @click="startLocal">
          <span class="mode-name">本地双人</span>
          <span class="mode-desc">同设备轮流走子</span>
        </button>
        <button class="mode-card" @click="startOnline">
          <span class="mode-name">联机对战</span>
          <span class="mode-desc">分享房间号实时对战</span>
        </button>
        <button class="mode-card" @click="startAI">
          <span class="mode-name">单人挑战 AI</span>
          <span class="mode-desc">与电脑对战</span>
        </button>
      </div>
      <p class="mode-tip">联机需配置 Supabase（见 .env.example）；未配置会提示。</p>
    </div>

    <!-- 本地双人 -->
    <template v-else-if="mode === 'local'">
      <div class="game-container">
        <div class="turn-indicator" :class="{ 'red-turn': currentSide === 'red', 'black-turn': currentSide === 'black' }">
          <span class="turn-dot" :class="{ red: currentSide === 'red', black: currentSide === 'black' }"></span>
          {{ turnLabel }}
        </div>

        <XiangqiBoard
          :board="board"
          :selected="selected"
          :legalTargets="legalTargets"
          :interactive="!gameOver && !isCheckmate && reviewMove === null"
          :lastMove="lastMove"
          :check-side="checkSide"
          :flipped="false"
          :hint="hintMove"
          :highlight="highlightPositions"
          @tap="handleTap"
        />

        <div class="controls-row">
          <button class="ctrl-btn" :disabled="history.length === 0 || gameOver || reviewMove !== null" @click="undoMove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 10h10a5 5 0 0 1 0 10H9"/>
              <path d="M7 14l-4-4 4-4"/>
            </svg>
            悔棋
          </button>
          <button class="ctrl-btn" :disabled="gameOver" @click="surrender">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            认输
          </button>
          <button class="ctrl-btn" :disabled="gameOver || reviewMove !== null" @click="offerDraw">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            求和
          </button>
          <button class="ctrl-btn" :disabled="notationList.length === 0" @click="openNotation">棋谱</button>
        </div>

        <div class="move-count">
          <span class="count-label">步数</span>
          <span class="count-value">{{ moveCount }}</span>
        </div>
      </div>

      <div v-if="showNotation" class="notation-panel">
        <div class="notation-header">
          <span class="notation-title">棋谱</span>
          <button class="notation-close" @click="closeNotation">×</button>
        </div>
        <div class="notation-controls">
          <button class="nc-btn" :disabled="reviewMove === null" @click="goToStart">⏮</button>
          <button class="nc-btn" :disabled="reviewMove === null" @click="stepBack">◀</button>
          <button class="nc-btn" :disabled="notationList.length === 0" @click="togglePlay">{{ playing ? '⏸' : '▶' }}</button>
          <button class="nc-btn" :disabled="notationList.length === 0 || (reviewMove !== null && reviewMove >= notationList.length - 1)" @click="stepForward">▶▶</button>
          <button class="nc-btn" @click="cycleSpeed">{{ playSpeed === 800 ? '慢' : playSpeed === 500 ? '中' : '快' }}</button>
        </div>
        <div class="notation-list">
          <div v-for="(item, i) in notationList" :key="i" class="notation-item" :class="{ active: reviewMove === item.index, red: item.side === 'red', black: item.side === 'black' }" @click="onNotationClick(item.index)">
            <span class="move-num">{{ Math.floor(i / 2) + 1 }}{{ i % 2 === 0 ? '.' : '...' }}</span>
            <span class="move-text">{{ item.notation }}</span>
          </div>
          <div v-if="notationList.length === 0" class="notation-empty">暂无着法</div>
        </div>
      </div>

      <GameDialog
        v-model:visible="gameOverDialog"
        accentColor="#FF4D4D"
        :icon="resultIcon"
        :title="resultTitle"
        :message="resultMessage"
      >
        <template #action>
          <div class="dialog-actions">
            <button class="dialog-btn" @click="resetGame">再来一局</button>
            <button class="dialog-btn dialog-btn-secondary" @click="openNotation">查看棋谱</button>
          </div>
        </template>
      </GameDialog>

      <ResumePrompt :visible="paused" @continue="continueGame" @new-game="newGame" />

      <GameDialog
        v-model:visible="drawOffered"
        accentColor="#FF9E00"
        icon="info"
        title="对方提议和棋"
        message="是否接受和棋？"
      >
        <template #action>
          <div class="dialog-actions">
            <button class="dialog-btn" @click="respondDraw(true)">接受</button>
            <button class="dialog-btn dialog-btn-secondary" @click="respondDraw(false)">拒绝</button>
          </div>
        </template>
      </GameDialog>
    </template>

    <!-- 人机模式 -->
    <template v-else-if="mode === 'ai'">
      <div class="game-container">
        <div class="ai-settings" v-if="!gameStarted">
          <span class="ai-label">难度</span>
          <button class="diff-btn" :class="{ active: difficulty === 'easy' }" @click="difficulty = 'easy'">简单</button>
          <button class="diff-btn" :class="{ active: difficulty === 'medium' }" @click="difficulty = 'medium'">中等</button>
          <button class="diff-btn" :class="{ active: difficulty === 'hard' }" @click="difficulty = 'hard'">困难</button>
          <span class="ai-divider">|</span>
          <span class="ai-label">执子</span>
          <button class="diff-btn" :class="{ active: aiSide === 'black' }" @click="aiSide = 'black'">我执红（先手）</button>
          <button class="diff-btn" :class="{ active: aiSide === 'red' }" @click="aiSide = 'red'">我执黑（后手）</button>
          <button class="start-ai-btn" @click="startAIGame">开始对局</button>
        </div>

        <div class="turn-indicator" :class="{ 'red-turn': currentSide === 'red', 'black-turn': currentSide === 'black' }">
          <span class="turn-dot" :class="{ red: currentSide === 'red', black: currentSide === 'black' }"></span>
          {{ turnLabel }}
        </div>

        <XiangqiBoard
          :board="board"
          :selected="selected"
          :legalTargets="legalTargets"
          :interactive="!gameOver && !isCheckmate && !(mode === 'ai' && (aiThinking || currentSide === aiSide)) && reviewMove === null"
          :lastMove="lastMove"
          :check-side="checkSide"
          :flipped="humanSide === 'black'"
          :hint="hintMove"
          :highlight="highlightPositions"
          @tap="handleTap"
        />

        <div class="controls-row">
          <button class="ctrl-btn" :disabled="history.length === 0 || gameOver || aiThinking || reviewMove !== null" @click="undoMove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 10h10a5 5 0 0 1 0 10H9"/>
              <path d="M7 14l-4-4 4-4"/>
            </svg>
            悔棋
          </button>
          <button class="ctrl-btn" :disabled="gameOver || aiThinking" @click="surrender">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            认输
          </button>
          <button class="ctrl-btn" :disabled="currentSide === aiSide || aiThinking || hintThinking || gameOver || reviewMove !== null" :class="{ 'hint-active': hintMove }" @click="showHint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            提示
          </button>
          <button class="ctrl-btn" :disabled="notationList.length === 0" @click="openNotation">棋谱</button>
        </div>

        <div class="move-count">
          <span class="count-label">步数</span>
          <span class="count-value">{{ moveCount }}</span>
        </div>
      </div>

      <div v-if="showNotation" class="notation-panel">
        <div class="notation-header">
          <span class="notation-title">棋谱</span>
          <button class="notation-close" @click="closeNotation">×</button>
        </div>
        <div class="notation-controls">
          <button class="nc-btn" :disabled="reviewMove === null" @click="goToStart">⏮</button>
          <button class="nc-btn" :disabled="reviewMove === null" @click="stepBack">◀</button>
          <button class="nc-btn" :disabled="notationList.length === 0" @click="togglePlay">{{ playing ? '⏸' : '▶' }}</button>
          <button class="nc-btn" :disabled="notationList.length === 0 || (reviewMove !== null && reviewMove >= notationList.length - 1)" @click="stepForward">▶▶</button>
          <button class="nc-btn" @click="cycleSpeed">{{ playSpeed === 800 ? '慢' : playSpeed === 500 ? '中' : '快' }}</button>
        </div>
        <div class="notation-list">
          <div v-for="(item, i) in notationList" :key="i" class="notation-item" :class="{ active: reviewMove === item.index, red: item.side === 'red', black: item.side === 'black' }" @click="onNotationClick(item.index)">
            <span class="move-num">{{ Math.floor(i / 2) + 1 }}{{ i % 2 === 0 ? '.' : '...' }}</span>
            <span class="move-text">{{ item.notation }}</span>
          </div>
          <div v-if="notationList.length === 0" class="notation-empty">暂无着法</div>
        </div>
      </div>

      <GameDialog
        v-model:visible="gameOverDialog"
        accentColor="#FF4D4D"
        :icon="resultIcon"
        :title="resultTitle"
        :message="resultMessage"
      >
        <template #action>
          <div class="dialog-actions">
            <button class="dialog-btn" @click="resetGame">再来一局</button>
            <button class="dialog-btn dialog-btn-secondary" @click="openNotation">查看棋谱</button>
          </div>
        </template>
      </GameDialog>

      <ResumePrompt :visible="paused" @continue="continueGame" @new-game="newGame" />
    </template>

    <!-- 联机模式 -->
    <XiangqiOnlineView v-else ref="onlineRef" />

    <PauseOverlay :visible="paused" @resume="continueGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useGamePause } from '@/composables/useGamePause'
import { useToast } from '@/composables/useToast'
import { useXiangqiAI } from '@/composables/useXiangqiAI'
import { useAchievements } from '@/stores/achievements'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'
import ResumePrompt from '@/components/ResumePrompt.vue'
import XiangqiBoard from '@/components/XiangqiBoard.vue'
import XiangqiOnlineView from '@/views/XiangqiOnlineView.vue'
import type { Board, Position, Move, Side } from '@/engine/xiangqi/types'
import { cloneBoard } from '@/engine/xiangqi/types'
import { initialBoard, generateMoves, applyMove, isInCheck, getGameStatus, classifyMove, isPinned, toNotation, checkRepetitionViolation } from '@/engine/xiangqi/rules'
import { boardKey } from '@/engine/xiangqi/ai'
import { lookupOpening } from '@/engine/xiangqi/openings'

type GameMode = 'local' | 'online' | 'ai'
type AISide = 'red' | 'black'
type Difficulty = 'easy' | 'medium' | 'hard'
type GameResult = 'red-win' | 'black-win' | 'draw' | null

const router = useRouter()
const route = useRoute()

const ROOM_RE = /^[A-Z0-9]{4}$/
const mode = ref<GameMode | null>(
  (typeof route.query.room === 'string' && ROOM_RE.test(route.query.room)) ? 'online' : null
)
const onlineRef = ref<InstanceType<typeof XiangqiOnlineView> | null>(null)

const aiSide = ref<AISide>('black')
const difficulty = ref<Difficulty>('hard')
const aiThinking = ref(false)
const gameStarted = ref(false)

const sound = useSound()
const haptics = useHaptics()
const toast = useToast()
  const achievements = useAchievements()
  const gameRecord = ref<{ moves: Move[]; sides: Side[] }>({ moves: [], sides: [] })
  const notations = ref<string[]>([])
  const reviewMove = ref<number | null>(null)
  // 复盘演示：播放速度三档 + 播放中标志 + 播放定时器（onUnmounted/resetGame 清理）
  const playSpeed = ref<800 | 500 | 250>(500)
  const playing = ref(false)
  let playTimer: ReturnType<typeof setInterval> | null = null
  const hintMove = ref<Move | null>(null)
  const drawOffered = ref(false)
  const showNotation = ref(false)

  const board = ref<Board>(initialBoard())
const currentSide = ref<Side>('red')
const selected = ref<Position | null>(null)
const legalTargets = ref<Position[]>([])
const history = ref<any[]>([])
const lastMove = ref<Move | null>(null)
const moveCount = ref(0)
const gameOver = ref(false)
const result = ref<GameResult>(null)
const gameOverDialog = ref(false)
const isCheckmate = ref(false)
// 重复局面判定：positions[k] = 走完 k 个半步后的局面（positions[0] = 初始局面），
// playedMoves 与 positions[1..] 一一对应
const positions = ref<Board[]>([initialBoard()])
const playedMoves = ref<Move[]>([])
const violationSide = ref<Side | null>(null)
const violationReason = ref<'perpetual_check' | 'perpetual_chase' | 'perpetual_mate' | 'perpetual_attack' | null>(null)
const drawByRepetition = ref<'mutual_attack' | 'mutual_idle' | null>(null)
const staleMated = ref(false) // 困毙（无子可走）判负标志：区别于将死，用于结果文案
const { paused, resume: resumeGame } = useGamePause({
  canPause: () => mode.value !== 'online' && mode.value !== 'ai' && !gameOver.value && result.value === null,
})

// ---- 模式相关 UI ----
const layoutTitle = computed(() => mode.value === 'online' ? '中国象棋·联机' : '中国象棋')
const layoutAccent = computed(() => mode.value === 'online' ? '#FF9E00' : '#FF4D4D')
const layoutGradient = computed(() => mode.value === 'online' ? '#B967FF' : '#FF6B6B')
const layoutEntrance = computed(() => mode.value === 'online' ? 'xq-online' : 'xq-local')
const layoutHints = computed(() => {
  if (mode.value === 'local') return ['红先黑后，一人一步', '点选棋子再点落点']
  if (mode.value === 'online') return ['分享房间号给好友', '实时同步对战']
  if (mode.value === 'ai') return ['挑战电脑玩家', '简单/中等/困难三档难度']
  return ['选择对战模式开始']
})
const layoutInfoItems = computed(() => {
  if (mode.value === 'local') return [{ label: '步数', value: moveCount.value }]
  if (mode.value === 'online') return [{ label: '模式', value: '联机对战' }]
  if (mode.value === 'ai') return [{ label: '难度', value: difficulty.value === 'easy' ? '简单' : difficulty.value === 'medium' ? '中等' : '困难' }, { label: 'AI', value: aiSide.value === 'red' ? 'AI 先手' : '你先手' }]
  return [{ label: '模式', value: '选择中' }]
})
const layoutTutorial = computed(() =>
  mode.value === 'online'
    ? '和好友实时对战：分享房间号，两人各执红/黑，先将死对方将/帅者获胜。'
    : mode.value === 'ai'
      ? '挑战电脑 AI：选择难度和执子，击败 AI 获得胜利。'
      : '经典中国象棋：红先黑后，一人一步，将死对方将/帅者获胜。'
)

const humanSide = computed(() => aiSide.value === 'red' ? 'black' : 'red')

const notationList = computed(() => {
  return gameRecord.value.moves.map((_move, i) => ({
    index: i,
    side: gameRecord.value.sides[i],
    notation: notations.value[i] || ''
  }))
})

const highlightPositions = computed(() => {
  if (reviewMove.value === null) return null
  const move = gameRecord.value.moves[reviewMove.value]
  if (!move) return null
  return { from: move.from, to: move.to }
})

const turnLabel = computed(() => {
  if (gameOver.value) {
    if (result.value === 'red-win') return '红方获胜！'
    if (result.value === 'black-win') return '黑方获胜！'
    return '和棋'
  }
  if (mode.value === 'ai' && aiThinking.value) return 'AI 思考中...'
  if (mode.value === 'ai') {
    return currentSide.value === aiSide.value ? 'AI 回合' : '你的回合'
  }
  return currentSide.value === 'red' ? '红方走子' : '黑方走子'
})

const checkSide = computed(() => {
  if (gameOver.value) return null
  if (isInCheck(board.value, currentSide.value)) return currentSide.value
  return null
})

const resultTitle = computed(() => {
  if (result.value === 'red-win') return '红方获胜！'
  if (result.value === 'black-win') return '黑方获胜！'
  return '和棋'
})

const resultMessage = computed(() => {
  if (staleMated.value) {
    const loser = result.value === 'red-win' ? '黑方' : '红方'
    return `${loser}困毙（无子可走）判负，共 ${moveCount.value} 步`
  }
  if (result.value === 'draw') {
    if (drawByRepetition.value === 'mutual_attack') return `双方长打，不变作和（共 ${moveCount.value} 步）`
    if (drawByRepetition.value === 'mutual_idle') return `双方循环重复不变着，判和（共 ${moveCount.value} 步）`
    return `双方握手言和，共 ${moveCount.value} 步`
  }
  if (violationSide.value) {
    const who = violationSide.value === 'red' ? '红方' : '黑方'
    const winner = violationSide.value === 'red' ? '黑方' : '红方'
    const why = violationReason.value === 'perpetual_check' ? '长将' :
      violationReason.value === 'perpetual_chase' ? '长捉' :
      violationReason.value === 'perpetual_mate' ? '长杀' : '长打'
    return `${who}${why}违规判负，${winner}获胜`
  }
  return `${result.value === 'red-win' ? '红方' : '黑方'}在 ${moveCount.value} 步内取胜`
})

const resultIcon = computed<'success' | 'fail' | 'info'>(() => {
  if (result.value === 'draw') return 'info'
  return 'success'
})

// ---- 交互逻辑 ----
// 送将提示节流：2 秒内不重复弹，避免连点刷屏
let lastExposeTipAt = 0

// ---- AI 走子调度 ----
let aiTimer: ReturnType<typeof setTimeout> | null = null
// AI 搜索调度器：搜索在 Worker 内运行（主线程零阻塞），cancel 中断引擎内搜索（保留 TT）
const { requestSearch, cancel, dispose } = useXiangqiAI()
// AI 回合身份序号：取消点（悔棋/认输/重开/离开）递增，使进行中的 AI 异步回调过期
let aiSeq = 0
// 提示请求序号：递增使旧请求过期（又点提示/走子/取消后旧结果丢弃）
let hintSeq = 0
const hintThinking = ref(false)
onUnmounted(() => {
  dispose()
  stopPlayback()
})

function recentHistoryKeys(): bigint[] {
  // 最近 32 个半步的历史局面 key（与 checkRepetitionViolation 的 MAX_PERIOD=32 判定窗口一致；
  // positions[k] 为走完 k 个半步后的局面，行棋方 = k 偶红先）
  const len = positions.value.length
  if (len <= 1) return []
  const keys: bigint[] = []
  const start = Math.max(0, len - 33)
  for (let i = start; i < len - 1; i++) {
    keys.push(boardKey(positions.value[i], i % 2 === 0 ? 'red' : 'black'))
  }
  return keys
}

async function showHint() {
  if (gameOver.value || aiThinking.value || currentSide.value === aiSide.value) return
  const seq = ++hintSeq
  hintThinking.value = true
  // 开局库：命中主变直接给提示（零延迟），未命中才进 Worker 搜索
  const opening = lookupOpening(board.value, humanSide.value)
  if (opening) {
    if (seq !== hintSeq) return // 过期（又点/走子/取消），丢弃
    hintThinking.value = false
    hintMove.value = opening
    sound.select()
    haptics.tap()
    return
  }
  // 提示与 AI 同强度：简单固定深度 2，中等深度 4，困难迭代加深（限 2s 保证响应，异步不阻塞 UI）
  // 均传入对局历史 key：提示不走进长将/长捉判负的着法
  const hint = await requestSearch({
    board: board.value,
    side: humanSide.value,
    depth: difficulty.value === 'easy' ? 2 : difficulty.value === 'medium' ? 4 : 8,
    timeLimitMs: difficulty.value === 'easy' ? undefined : difficulty.value === 'medium' ? 1200 : 2000,
    historyKeys: recentHistoryKeys(),
  })
  if (seq !== hintSeq) return // 过期（又点/走子/取消），丢弃
  hintThinking.value = false
  if (hint) {
    hintMove.value = hint
    sound.select()
    haptics.tap()
  }
}

function clearHint() {
  hintMove.value = null
  hintSeq++ // 使进行中的提示请求过期
  hintThinking.value = false
  cancel()
}

function offerDraw() {
  if (gameOver.value || mode.value !== 'local') return
  drawOffered.value = true
  sound.select()
  haptics.light()
}

function respondDraw(accepted: boolean) {
  drawOffered.value = false
  if (accepted) {
    gameOver.value = true
    result.value = 'draw'
    sound.win()
    haptics.success()
    gameOverDialog.value = true
  } else {
    sound.select()
    haptics.light()
  }
}

function reviewMoveAt(index: number) {
  if (index < 0 || index >= gameRecord.value.moves.length) return // 空谱/越界防御
  reviewMove.value = index
  // 回放核心：棋盘切到该步走完后的局面快照（positions[k] = 走完 k 步后的局面，moves[i] ↔ positions[i+1]）
  board.value = positions.value[index + 1]
  lastMove.value = gameRecord.value.moves[index] ?? null
  clearSelection()
  sound.select()
  haptics.tap()
}

// 手动点击棋谱条目：先停播放再切局面（播放 tick 内部的 reviewMoveAt 不触发停止）
function onNotationClick(index: number) {
  stopPlayback()
  reviewMoveAt(index)
}

// ---- 复盘演示：逐手回放 + 自动播放 ----
function stopPlayback() {
  playing.value = false
  if (playTimer) { clearInterval(playTimer); playTimer = null }
}

function goToStart() {
  stopPlayback()
  reviewMove.value = null
  board.value = positions.value[0]
  lastMove.value = null
  clearSelection()
}

function stepBack() {
  stopPlayback() // 手动步进停止播放
  if (reviewMove.value === null) return
  if (reviewMove.value - 1 < 0) goToStart()
  else reviewMoveAt(reviewMove.value - 1)
}

function stepForward() {
  stopPlayback() // 手动步进停止播放
  if (reviewMove.value === null) {
    reviewMoveAt(0)
    return
  }
  if (reviewMove.value + 1 >= gameRecord.value.moves.length) return
  reviewMoveAt(reviewMove.value + 1)
}

function togglePlay() {
  if (playing.value) {
    stopPlayback()
    return
  }
  // 未选步从首手开始；已在末手则从头播放（此时 playing 仍为 false，reviewMoveAt 内的 stopPlayback 无害）
  if (reviewMove.value === null) reviewMoveAt(0)
  else if (reviewMove.value >= gameRecord.value.moves.length - 1) {
    goToStart()
    reviewMoveAt(0)
  }
  playing.value = true
  playTimer = setInterval(() => {
    // 暂停（PauseOverlay）中播放空转不前进，恢复后继续
    if (paused.value) return
    if (reviewMove.value === null || reviewMove.value + 1 >= gameRecord.value.moves.length) {
      stopPlayback()
      return
    }
    reviewMoveAt(reviewMove.value + 1)
  }, playSpeed.value)
}

function cycleSpeed() {
  playSpeed.value = playSpeed.value === 800 ? 500 : playSpeed.value === 500 ? 250 : 800
  // 播放中切速度：重建定时器（播放中不可能处于末手，togglePlay 不会从头播）
  if (playing.value) {
    stopPlayback()
    togglePlay()
  }
}

function exitReview() {
  stopPlayback()
  reviewMove.value = null
  board.value = positions.value[positions.value.length - 1]
  lastMove.value = gameRecord.value.moves[gameRecord.value.moves.length - 1] ?? null
  clearSelection()
  clearHint()
  // 对局中退出回放：若轮到 AI，恢复 AI 调度（打开棋谱时已取消）
  if (mode.value === 'ai' && !gameOver.value && currentSide.value === aiSide.value) {
    scheduleAIMove()
  }
}

function openNotation() {
  // 查看棋谱时关闭结算弹窗，避免弹窗遮挡棋谱面板
  gameOverDialog.value = false
  // 对局中打开棋谱：取消 AI 待执行调度/搜索，防止回放期间 AI 走子（退出回放时恢复）
  aiSeq++
  cancel()
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
  aiThinking.value = false
  showNotation.value = true
  sound.select()
  haptics.tap()
}

function closeNotation() {
  // 关闭面板 = 退出回放恢复对局现场（对局中恢复当前局面，终局后恢复终局局面）
  exitReview()
  showNotation.value = false
  // 棋谱关闭后若对局已结束，恢复结算弹窗（保留「再来一局」入口）
  if (gameOver.value) gameOverDialog.value = true
}

function scheduleAIMove() {
  if (mode.value !== 'ai') return
  if (gameOver.value) return
  if (currentSide.value === aiSide.value) {
    aiThinking.value = true
    const seq = ++aiSeq
    aiTimer = setTimeout(async () => {
      aiTimer = null
      // 开局库：命中主变直接走（零搜索延迟），未命中才进 Worker 搜索
      const opening = lookupOpening(board.value, aiSide.value)
      if (opening) {
        aiThinking.value = false
        if (seq !== aiSeq) return
        if (!gameOver.value && currentSide.value === aiSide.value && mode.value === 'ai') {
          executeMove(opening.from, opening.to)
        }
        return
      }
      // 简单固定深度 2；中等深度 4、限 1.2s；困难迭代加深至多 8 层、限 4s（超时回退已完成深度的最佳着法）
      // 均传入对局历史 key：AI 不走进长将/长捉判负的着法
      const move = await requestSearch({
        board: board.value,
        side: aiSide.value,
        depth: difficulty.value === 'easy' ? 2 : difficulty.value === 'medium' ? 4 : 8,
        timeLimitMs: difficulty.value === 'easy' ? undefined : difficulty.value === 'medium' ? 1200 : 4000,
        historyKeys: recentHistoryKeys(),
      })
      aiThinking.value = false
      // 过期校验：await 期间可能已悔棋/认输/重开/离开（seq 失效）或轮到玩家
      if (seq !== aiSeq) return
      if (move && !gameOver.value && currentSide.value === aiSide.value && mode.value === 'ai') {
        executeMove(move.from, move.to)
      }
    }, 400)
  }
}

function showExposeTip(message: string) {
  const now = Date.now()
  if (now - lastExposeTipAt < 2000) return
  lastExposeTipAt = now
  toast.show(message, '⚠️')
  haptics.light()
}

// 将军提示节流：独立计时，2 秒内不重复弹，避免与送将提示互相压制
let lastCheckAlertAt = 0
function showCheckAlert() {
  const now = Date.now()
  if (now - lastCheckAlertAt < 2000) return
  lastCheckAlertAt = now
  // 统一走 useToast（GameToast）游戏内主题化反馈，不弹原生警告框
  toast.show('将军！', '⚔️')
  sound.hit()
  haptics.pulse()
}

function handleTap(pos: Position) {
  if (reviewMove.value !== null) return // 回放中禁走子（与 interactive 双保险）
  if (gameOver.value || (mode.value !== 'local' && mode.value !== 'ai')) return
  if (mode.value === 'ai' && (aiThinking.value || currentSide.value === aiSide.value)) return

  const piece = board.value[pos.row][pos.col]

  // 已选棋子，点击落点
  if (selected.value) {
    const target = legalTargets.value.find(t => t.row === pos.row && t.col === pos.col)
    if (target) {
      executeMove(selected.value, target)
      return
    }
    // 点击其他己方棋子，切换选择
    if (piece && piece.side === currentSide.value) {
      selectPiece(pos)
      return
    }
    // 送将拦截反馈：符合走子规则但走后会送将，明确告知玩家原因（保持选中便于另选落点）
    if (classifyMove(board.value, selected.value, pos) === 'exposes-general') {
      showExposeTip('不能送将：这样走会让自己的将/帅被将军')
      return
    }
    // 取消选择
    clearSelection()
    return
  }

  // 未选棋子，选择己方棋子
  if (piece && piece.side === currentSide.value) {
    selectPiece(pos)
  }
}

function selectPiece(pos: Position) {
  selected.value = pos
  legalTargets.value = generateMoves(board.value, currentSide.value)
    .filter(m => m.from.row === pos.row && m.from.col === pos.col)
    .map(m => m.to)
  // 被钉死的棋子无任何合法落点，提示玩家原因，避免误以为棋子锁死/bug
  if (legalTargets.value.length === 0 && isPinned(board.value, pos)) {
    showExposeTip('该棋子被钉死：任何移动都会让将/帅被将军')
  }
  sound.select()
  haptics.tap()
}

function clearSelection() {
  selected.value = null
  legalTargets.value = []
}

function executeMove(from: Position, to: Position) {
  const move: Move = { from, to, captured: board.value[to.row][to.col] || undefined }

  // 保存历史
  history.value.push({
    board: cloneBoard(board.value),
    side: currentSide.value,
    lastMove: lastMove.value ? { ...lastMove.value } : null
  })

  // 执行走子
  notations.value.push(toNotation(move, board.value))
  board.value = applyMove(board.value, move)
  playedMoves.value.push(move)
  positions.value.push(cloneBoard(board.value))
  gameRecord.value.moves.push(move)
  gameRecord.value.sides.push(currentSide.value)
  localStorage.setItem('xiangqi_record', JSON.stringify({ ...gameRecord.value, timestamp: Date.now() }))
  lastMove.value = move
  moveCount.value++
  // 走子后立即清除选中态与合法落点提示（修复：走子后提示点残留）
  clearSelection()
  clearHint()

  // 音效
  if (move.captured) {
    sound.hit()
    haptics.pulse()
  } else {
    sound.select()
    haptics.tap()
  }

  // 切换回合
  currentSide.value = currentSide.value === 'red' ? 'black' : 'red'

  // 检查游戏状态
  checkGameState()
  // 人机模式：轮到 AI 时自动走子
  scheduleAIMove()
}

function checkGameState() {
  const status = getGameStatus(board.value, currentSide.value)
  const inCheck = isInCheck(board.value, currentSide.value)

  if (inCheck && status !== 'checkmate' && status !== 'stalemate') {
    showCheckAlert()
  }

  // 重复局面判定（长将/长捉/双方长打）：同一局面第 3 次出现且构成循环时裁决
  const verdict = checkRepetitionViolation(playedMoves.value, positions.value)
  if (verdict) {
    gameOver.value = true
    if (verdict.type === 'mutual_draw') {
      drawByRepetition.value = verdict.reason
      result.value = 'draw'
      sound.win()
      haptics.success()
      toast.show(verdict.reason === 'mutual_attack' ? '双方长打，判和' : '双方循环重复，判和', '⚖️')
    } else {
      violationSide.value = verdict.side
      violationReason.value = verdict.reason
      result.value = verdict.side === 'red' ? 'black-win' : 'red-win'
      sound.win()
      haptics.win()
      const who = verdict.side === 'red' ? '红方' : '黑方'
      const why = verdict.reason === 'perpetual_check' ? '长将' : verdict.reason === 'perpetual_chase' ? '长捉' : verdict.reason === 'perpetual_mate' ? '长杀' : '长打'
      toast.show(`${who}${why}违规，判负！`, '⚖️')
    }
    gameOverDialog.value = true
    return
  }

  if (status === 'checkmate') {
    isCheckmate.value = true
    gameOver.value = true
    result.value = currentSide.value === 'red' ? 'black-win' : 'red-win'
    sound.win()
    haptics.win()
    if (achievements.unlock('xiangqi_first_game')) {
      toast.show('成就解锁：象棋新手 ♟️', '🏆')
    }
    if (result.value === 'red-win' || result.value === 'black-win') {
      if (achievements.unlock('xiangqi_first_win')) {
        toast.show('成就解锁：象棋胜利 🏆', '🏆')
      }
    }
    gameOverDialog.value = true
  } else if (status === 'stalemate') {
    // 困毙（无子可走）：中国象棋规则判走子方负、对方胜（与国际象棋不同，非和棋）
    isCheckmate.value = true
    gameOver.value = true
    staleMated.value = true
    result.value = currentSide.value === 'red' ? 'black-win' : 'red-win'
    sound.win()
    haptics.win()
    if (achievements.unlock('xiangqi_first_game')) {
      toast.show('成就解锁：象棋新手 ♟️', '🏆')
    }
    if (result.value === 'red-win' || result.value === 'black-win') {
      if (achievements.unlock('xiangqi_first_win')) {
        toast.show('成就解锁：象棋胜利 🏆', '🏆')
      }
    }
    gameOverDialog.value = true
  }
}

function undoMove() {
  if (history.value.length === 0 || gameOver.value) return
  // 人机模式：撤销 AI 一步 + 玩家一步，确保回到玩家回合
  const stepsToUndo = mode.value === 'ai' ? 2 : 1
  for (let i = 0; i < stepsToUndo && history.value.length > 0; i++) {
    const prev = history.value.pop()!
    board.value = prev.board
    currentSide.value = prev.side
    lastMove.value = prev.lastMove
    moveCount.value = Math.max(0, moveCount.value - 1)
    playedMoves.value.pop()
    positions.value.pop()
    notations.value.pop()
  }
  clearSelection()
  reviewMove.value = null
  clearHint()
  violationSide.value = null
  violationReason.value = null
  drawByRepetition.value = null
  aiThinking.value = false
  aiSeq++ // 使进行中的 AI 搜索过期
  cancel()
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
  sound.select()
  haptics.light()
}

function surrender() {
  if (gameOver.value) return
  gameOver.value = true
  result.value = currentSide.value === 'red' ? 'black-win' : 'red-win'
  // 清理 AI 定时器/搜索，防止认输后 AI 继续走子
  aiSeq++
  cancel()
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
  aiThinking.value = false
  sound.miss()
  haptics.error()
  gameOverDialog.value = true
}

function resetGame() {
  stopPlayback() // 停止回放播放，避免重开后旧定时器继续推进
  aiSeq++ // 使进行中的 AI 搜索过期（重开旧异步结果丢弃）
  cancel()
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
  aiThinking.value = false
  gameStarted.value = true
  gameRecord.value = { moves: [], sides: [] }
  notations.value = []
  gameOverDialog.value = false
  board.value = initialBoard()
  currentSide.value = 'red'
  selected.value = null
  legalTargets.value = []
  history.value = []
  positions.value = [initialBoard()]
  playedMoves.value = []
  violationSide.value = null
  violationReason.value = null
  drawByRepetition.value = null
  staleMated.value = false
  lastMove.value = null
  moveCount.value = 0
  gameOver.value = false
  result.value = null
  isCheckmate.value = false
  reviewMove.value = null
  hintMove.value = null
  drawOffered.value = false
  showNotation.value = false
  // 人机模式：AI 执红（先手）时，重启后需手动调度首步
  if (mode.value === 'ai' && aiSide.value === 'red') {
    scheduleAIMove()
  }
}

function continueGame() {
  resumeGame()
}

function newGame() {
  resumeGame()
  resetGame()
}

function goHome() {
  // 清理 AI 定时器/搜索，防止导航离开后回调在已卸载组件上执行
  aiSeq++
  cancel()
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
  aiThinking.value = false
  router.push('/')
}

function startLocal() {
  mode.value = 'local'
  resetGame()
}

function startOnline() {
  mode.value = 'online'
}

function startAI() {
  mode.value = 'ai'
  resetGame()
  gameStarted.value = false
}

function startAIGame() {
  gameStarted.value = true
  resetGame()
  // AI 首步调度已统一在 resetGame() 中处理（aiSide === 'red' 时）
}

function onRestart() {
  if (mode.value === 'local' || mode.value === 'ai') resetGame()
  else if (mode.value === 'online') onlineRef.value?.resetBoard(true)
}
</script>

<style scoped>
.mode-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
}

.mode-title {
  font-size: 2em;
  font-weight: 700;
  color: #FF4D4D;
  text-shadow: 0 0 20px rgba(255, 77, 77, 0.5);
}
.mode-sub {
  color: #9aa0b5;
  font-size: 1em;
}
.mode-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}
.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  background: rgba(255, 77, 77, 0.08);
  border: 1px solid rgba(255, 77, 77, 0.3);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 160px;
}
.mode-card:hover {
  background: rgba(255, 77, 77, 0.15);
  border-color: #FF4D4D;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 77, 77, 0.3);
}
.mode-name {
  font-size: 1.15em;
  font-weight: 600;
  color: #fff;
}
.mode-desc {
  font-size: 0.85em;
  color: #9aa0b5;
}
.mode-tip {
  color: #6b7280;
  font-size: 0.85em;
  text-align: center;
}

.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.turn-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.05em;
  color: #fff;
  padding: 10px 22px;
  background: rgba(255, 77, 77, 0.08);
  border: 1px solid rgba(255, 77, 77, 0.3);
  border-radius: 30px;
  transition: all 0.3s ease;
}
.turn-indicator.black-turn {
  background: rgba(44, 62, 80, 0.15);
  border-color: rgba(44, 62, 80, 0.5);
}
.turn-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #FF4D4D;
  box-shadow: 0 0 12px #FF4D4D;
}
.turn-dot.black {
  background: #2c3e50;
  box-shadow: 0 0 12px rgba(44, 62, 80, 0.6);
}

.controls-row {
  display: flex;
  gap: 12px;
}
.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 10px 20px;
  border-radius: 14px;
  font-size: 0.95em;
  cursor: pointer;
  transition: all 0.2s ease;
}
.ctrl-btn:hover:not(:disabled) {
  background: rgba(255, 77, 77, 0.15);
  border-color: #FF4D4D;
}
.ctrl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.move-count {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.count-label {
  font-size: 0.85em;
  color: #9aa0b5;
}
.count-value {
  font-size: 1.2em;
  font-weight: 700;
  color: #fff;
}

.dialog-btn {
  background: linear-gradient(135deg, #FF4D4D, #FF6B6B);
  color: #fff;
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
  box-shadow: 0 8px 25px rgba(255, 77, 77, 0.4);
}

@media (max-width: 640px) {
  .mode-card {
    padding: 18px 24px;
    min-width: 130px;
  }
  .controls-row {
    gap: 8px;
  }
  .ctrl-btn {
    padding: 8px 16px;
    font-size: 0.85em;
  }
}

.ai-settings {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 16px 20px;
  background: rgba(255, 77, 77, 0.06);
  border: 1px solid rgba(255, 77, 77, 0.2);
  border-radius: 14px;
  margin-bottom: 8px;
}
.ai-label {
  font-size: 0.9em;
  color: #9aa0b5;
}
.ai-divider {
  color: #4a4f5c;
  font-size: 0.85em;
}
.diff-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ccc;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s ease;
}
.diff-btn:hover {
  background: rgba(255, 77, 77, 0.12);
  border-color: rgba(255, 77, 77, 0.4);
}
.diff-btn.active {
  background: rgba(255, 77, 77, 0.2);
  border-color: #FF4D4D;
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 77, 77, 0.3);
}
.start-ai-btn {
  background: linear-gradient(135deg, #FF4D4D, #FF6B6B);
  color: #fff;
  border: none;
  padding: 9px 22px;
  font-size: 0.95em;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 4px;
}
.start-ai-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(255, 77, 77, 0.4);
}

@media (max-width: 640px) {
  .ai-settings {
    gap: 6px;
    padding: 12px 14px;
  }
  .diff-btn {
    padding: 6px 10px;
    font-size: 0.8em;
  }
  .start-ai-btn {
    padding: 7px 16px;
    font-size: 0.85em;
  }
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.dialog-btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}
.dialog-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.hint-active {
  background: rgba(255, 165, 0, 0.15) !important;
  border-color: rgba(255, 165, 0, 0.5) !important;
  color: #FFA500 !important;
}

.notation-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  width: 100%;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.notation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.notation-title {
  font-size: 0.95em;
  font-weight: 600;
  color: #fff;
}
.notation-close {
  background: none;
  border: none;
  color: #9aa0b5;
  font-size: 1.3em;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}
.notation-close:hover {
  color: #fff;
}
.notation-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.nc-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 0.85em;
  min-width: 34px;
  height: 30px;
  padding: 0 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.nc-btn:hover:not(:disabled) {
  background: rgba(0, 191, 255, 0.15);
  border-color: rgba(0, 191, 255, 0.4);
}
.nc-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.notation-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
}
.notation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.9em;
}
.notation-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.notation-item.active {
  background: rgba(0, 191, 255, 0.12);
  border: 1px solid rgba(0, 191, 255, 0.3);
}
.notation-item.red {
  color: #FF6B6B;
}
.notation-item.black {
  color: #9aa0b5;
}
.notation-item.red.active {
  color: #FF4D4D;
}
.notation-item.black.active {
  color: #fff;
}
.move-num {
  font-size: 0.8em;
  color: #6b7280;
  min-width: 28px;
}
.move-text {
  font-weight: 500;
  font-family: serif;
}
.notation-empty {
  padding: 20px;
  text-align: center;
  color: #6b7280;
  font-size: 0.85em;
}

@media (max-width: 640px) {
  .notation-panel {
    max-width: 100%;
  }
  .notation-list {
    max-height: 180px;
  }
  .dialog-actions {
    gap: 8px;
  }
  .dialog-btn {
    padding: 10px 24px;
    font-size: 1em;
  }
}
</style>

