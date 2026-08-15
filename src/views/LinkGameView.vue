<template>
  <GameLayout
    title="连连看"
    accentColor="#FF006E"
    entrance="linkgame"
    gradientEnd="#B967FF"
    :hints="['方向键/WASD 移动', 'Enter/空格 确认', 'R 重置']"
    :infoItems="infoItems"
    :confirmRestart="score > 0"
    tutorial="找出相同图案，用不超过两个弯的路径连接消除。全部消除即胜利！"
    @back="router.push('/')"
    @restart="initGame"
  >
    <div class="game-board" :class="{ 'board-wide': config.cols >= 12 }" ref="boardEl">
      <template v-if="started">
        <div v-if="timeLimitActive" class="timer-bar">
          <div class="timer-fill" :style="{ width: timerPct + '%' }"></div>
        </div>
        <div v-for="(row, y) in board" :key="y" class="game-row">
          <div
            v-for="(cell, x) in row"
            :key="x"
            class="game-cell"
            :class="{ selected: isSelected(x, y), matched: cell.matched, cursor: cursor.x === x && cursor.y === y }"
            @click="selectCell(x, y)"
          >
            <svg v-if="!cell.matched" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <text x="12" y="17" font-size="20" text-anchor="middle">{{ getIcon(cell.type) }}</text>
            </svg>
          </div>
        </div>
        <svg
          v-if="linkShow"
          :key="linkId"
          class="link-overlay"
          :width="linkBox.w"
          :height="linkBox.h"
          :style="{ '--len': pathLen }"
        >
          <polyline :points="polyStr" class="link-line" />
          <circle v-for="(p, i) in linkPoints" :key="i" :cx="p.x" :cy="p.y" r="3.5" class="link-dot" />
        </svg>
      </template>
      <div v-else class="start-panel">
        <h2 class="start-title">连连看</h2>
        <p class="start-sub">选择模式开始</p>
        <div class="mode-row">
          <button type="button" class="mode-card" :class="{ active: pendingMode === 'classic' }" @click="pendingMode = 'classic'">经典模式</button>
          <button type="button" class="mode-card" @click="startCampaign">关卡模式</button>
        </div>
        <div v-if="pendingMode === 'classic'" class="diff-row">
          <button type="button" class="diff-btn" @click="startClassic('easy')">简单 6×8</button>
          <button type="button" class="diff-btn" @click="startClassic('normal')">普通 8×10</button>
          <button type="button" class="diff-btn" @click="startClassic('hard')">困难 10×12</button>
          <button type="button" class="back-btn" @click="pendingMode = null">返回</button>
        </div>
        <p v-if="pendingMode === 'classic'" class="start-hint">关卡模式：第1关简单 → 第2关普通 → 第3关困难 → 第4关起限时挑战</p>
      </div>
      <ScoreFloat :popups="popups" />
    </div>
    <LeaderboardStrip :game="currentGameKey" />
    <template #controls>
      <button type="button" @click="submitScore" class="reset-btn">提交分数</button>
      <button type="button" @click="shuffle(true)" class="reset-btn">重置</button>
    </template>
    <GameDialog
      v-model:visible="winDialog"
      accentColor="#FF006E"
      icon="success"
      :title="newRecord ? '新纪录！' : '全部消除！'"
      :message="'得分: ' + score"
      actionText="提交分数"
      @action="submitScore"
      :newRecord="newRecord"
      :achievementHint="achievementHintNew"
      :stats="gameStats"
    />
    <GameDialog
      v-model:visible="levelClearDialog"
      accentColor="#FF006E"
      icon="success"
      :title="'第 ' + level + ' 关完成'"
      :message="'累计得分: ' + score"
      actionText="进入下一关"
      @action="nextLevel"
    />
    <GameDialog
      v-model:visible="campaignClearDialog"
      accentColor="#FF006E"
      icon="info"
      title="闯关通关！"
      :message="'累计得分: ' + score"
    >
      <template #action>
        <div style="display:flex;gap:12px;justify-content:center">
          <button type="button" class="dialog-btn" @click="submitCampaign">提交分数</button>
          <button type="button" class="dialog-btn" @click="continueAfterClear">继续挑战</button>
        </div>
      </template>
    </GameDialog>
    <LeaderboardOverlay
      :visible="showLeaderboard"
      :game="currentGameKey"
      :gameName="currentGameName"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="initGame"
    />
    <ResumePrompt :visible="paused" @continue="continueGame" @new-game="newGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useSound } from '@/composables/useSound'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import { useGameStore } from '@/stores/game'
import { useGameSave } from '@/composables/useGameSave'
import { useAutoSave } from '@/composables/useAutoSave'
import { useHaptics } from '@/composables/useHaptics'
import { useScoreFloats } from '@/composables/useScoreFloats'
import { useGameOver, type GameStat } from '@/composables/useGameOver'
import { useGamePause } from '@/composables/useGamePause'
import { useGameLoop } from '@/composables/useGameLoop'
import { DIFFS, DIFF_LABELS, levelToDifficulty, type DiffKey, type LinkMode } from '@/lib/linkGame'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import ResumePrompt from '@/components/ResumePrompt.vue'
import ScoreFloat from '@/components/ScoreFloat.vue'

const router = useRouter()
const sound = useSound()
const achievements = useAchievements()
const toast = useToast()
const haptics = useHaptics()
const gameStore = useGameStore()
const { popups, pop } = useScoreFloats()
const { checkGameOver } = useGameOver()

// 暂停 / 恢复：回合制游戏统一 composable（失焦自动暂停 + P/Esc + 音效）
const { paused } = useGamePause({
  canPause: () => started.value && !winDialog.value && !levelClearDialog.value && !campaignClearDialog.value,
  autoPause: true
})

interface Cell { type: number; matched: boolean }

// 模式 / 难度 / 关卡状态
const mode = ref<LinkMode>('classic')
const difficulty = ref<DiffKey>('easy')
const level = ref(1)
const started = ref(false)
const pendingMode = ref<LinkMode | null>(null)

// 当前关卡的难度配置（classic 由手动选择，campaign 由关卡推导）
const config = computed(() =>
  mode.value === 'campaign' ? levelToDifficulty(level.value) : DIFFS[difficulty.value]
)
const timeLimitActive = computed(() => config.value.timeLimit !== undefined)

const board = ref<Cell[][]>([])
const selected = ref<{ x: number; y: number } | null>(null)
const cursor = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const score = ref(0)
const winDialog = ref(false)
const levelClearDialog = ref(false)
const campaignClearDialog = ref(false)
const showLeaderboard = ref(false)
const newRecord = ref(false)
const achievementHintNew = ref<string | null>(null)
const lastScore = ref(0)
const timeLeft = ref(0)
const gameStats = ref<GameStat[]>()

const currentGameKey = computed(() => (mode.value === 'campaign' ? 'link-campaign' : 'link'))
const currentGameName = computed(() => (mode.value === 'campaign' ? '连连看·闯关' : '连连看'))

const remaining = computed(() => board.value.flat().filter(c => !c.matched).length)

const infoItems = computed<Array<{ label: string; value: string | number }>>(() => {
  const items: Array<{ label: string; value: string | number }> = [
    { label: '分数', value: score.value },
    { label: '剩余', value: remaining.value }
  ]
  if (mode.value === 'campaign') items.push({ label: '关卡', value: level.value })
  else items.push({ label: '难度', value: DIFF_LABELS[difficulty.value] })
  if (timeLimitActive.value) items.push({ label: '时间', value: timeLeft.value + 's' })
  return items
})

const timerPct = computed(() => {
  const limit = config.value.timeLimit
  return limit ? (timeLeft.value / limit) * 100 : 0
})

// ---- 计时器（仅关卡模式 L4+ 限时） ----
const gameLoop = useGameLoop({
  mode: 'interval',
  intervalMs: 1000,
  onUpdate: () => {
    if (timeLeft.value > 0) {
      timeLeft.value--
      if (timeLeft.value <= 0) onTimeUp()
    }
  }
})
function startTimer() {
  timeLeft.value = config.value.timeLimit!
  if (paused.value) return
  gameLoop.start()
}
function stopTimer() { gameLoop.stop() }
watch(paused, (p) => {
  if (!timeLimitActive.value) return
  if (p) gameLoop.pause()
  else if (!gameLoop.isRunning.value) gameLoop.start()
})

const icons = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🥝', '🍒', '🥭', '🍍', '🥥', '🫐']

// ---- 存档（单键，payload 含 mode/difficulty/level/board/score） ----
const save = useGameSave('link')
const { scheduleSave, clearSave } = useAutoSave('link', () => ({
  mode: mode.value,
  difficulty: difficulty.value,
  level: level.value,
  board: board.value,
  score: score.value
}), {
  beforeSave: () => started.value && !winDialog.value && !levelClearDialog.value && !campaignClearDialog.value
})

watch([board, score], scheduleSave, { deep: true })

onMounted(() => {
  const data = save.loadGame()
  if (data && restoreFrom(data)) {
    paused.value = true // 有存档 → 展示"继续/新游戏"
  } else {
    started.value = false // 启动选择屏
  }
})

onUnmounted(() => { if (linkTimer) clearTimeout(linkTimer) })

function restoreFrom(data: Record<string, unknown>): boolean {
  const m = data.mode
  if (m !== 'classic' && m !== 'campaign') return false
  const diff = data.difficulty as DiffKey
  const lvl = typeof data.level === 'number' ? data.level : 1
  const cfg = m === 'campaign' ? levelToDifficulty(lvl) : DIFFS[diff as DiffKey]
  const b = data.board
  if (!Array.isArray(b) || b.length !== cfg.rows) return false
  if (!b.every((r: unknown) => Array.isArray(r) && (r as unknown[]).length === cfg.cols)) return false
  if (typeof data.score !== 'number') return false
  mode.value = m
  difficulty.value = diff
  level.value = lvl
  board.value = data.board as typeof board.value
  score.value = data.score
  selected.value = null
  cursor.value = { x: 0, y: 0 }
  started.value = true
  winDialog.value = false
  levelClearDialog.value = false
  campaignClearDialog.value = false
  if (cfg.timeLimit) timeLeft.value = cfg.timeLimit
  return true
}

// ---- 键盘 ----
function canPlay(): boolean {
  return started.value && !paused.value && !winDialog.value && !levelClearDialog.value && !campaignClearDialog.value
}

useGameKeyboard({
  bindings: [
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => {
        if (!canPlay()) return
        cursor.value = { x: cursor.value.x, y: Math.max(0, cursor.value.y - 1) }
      }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => {
        if (!canPlay()) return
        cursor.value = { x: cursor.value.x, y: Math.min(config.value.rows - 1, cursor.value.y + 1) }
      }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => {
        if (!canPlay()) return
        cursor.value = { x: Math.max(0, cursor.value.x - 1), y: cursor.value.y }
      }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => {
        if (!canPlay()) return
        cursor.value = { x: Math.min(config.value.cols - 1, cursor.value.x + 1), y: cursor.value.y }
      }
    },
    {
      key: ['Enter', ' '],
      handler: () => {
        if (!started.value) return
        if (winDialog.value) { submitScore(); return }
        if (levelClearDialog.value) { nextLevel(); return }
        if (campaignClearDialog.value) { submitCampaign(); return }
        if (paused.value) return
        selectCell(cursor.value.x, cursor.value.y)
      }
    },
    {
      key: ['r', 'R'],
      handler: () => { if (canPlay()) shuffle(true) }
    }
  ]
})

function getIcon(type: number): string { return icons[type] || '❓' }

function isSelected(x: number, y: number): boolean {
  return selected.value?.x === x && selected.value?.y === y
}

// ---- 启动各模式 / 关卡 ----
function startClassic(d: DiffKey) {
  pendingMode.value = null
  mode.value = 'classic'
  difficulty.value = d
  level.value = 1
  score.value = 0
  startBoard()
}

function startCampaign() {
  pendingMode.value = null
  mode.value = 'campaign'
  difficulty.value = 'easy'
  level.value = 1
  score.value = 0
  startBoard()
}

/** 按当前 mode/difficulty/level 重建棋盘（保留调用方设定的 score） */
function startBoard() {
  stopTimer()
  buildBoard(config.value.rows, config.value.cols, config.value.types)
  selected.value = null
  cursor.value = { x: 0, y: 0 }
  winDialog.value = false
  levelClearDialog.value = false
  campaignClearDialog.value = false
  linkShow.value = false
  started.value = true
  if (config.value.timeLimit) startTimer()
}

/** 关卡模式下进入下一关（累计分保留） */
function nextLevel() {
  level.value++
  difficulty.value = levelToDifficulty(level.value).diff
  startBoard()
}

/** 经典模式重开（沿用当前难度，分数清零）；关卡模式回到第 1 关 */
function initGame() {
  showLeaderboard.value = false
  if (mode.value === 'campaign') { level.value = 1; difficulty.value = 'easy' }
  score.value = 0
  startBoard()
}

function continueAfterClear() {
  nextLevel()
}

function continueGame() {
  paused.value = false
}

function newGame() {
  paused.value = false
  clearSave()
  initGame()
}

function submitScore() {
  if (mode.value === 'campaign') { submitCampaign(); return }
  lastScore.value = score.value
  const { achievementHint, stats } = checkGameOver('link', score.value, [
    { label: '得分', value: String(score.value) }
  ])
  achievementHintNew.value = achievementHint
  gameStats.value = stats
  winDialog.value = false
  showLeaderboard.value = true
  clearSave()
}

function submitCampaign() {
  campaignClearDialog.value = false
  levelClearDialog.value = false
  winDialog.value = false
  lastScore.value = score.value
  gameStore.addScore('link-campaign', score.value)
  showLeaderboard.value = true
  clearSave()
}

function onTimeUp() {
  gameLoop.stop()
  lastScore.value = score.value
  checkGameOver('link-campaign', score.value)
  showLeaderboard.value = true
  clearSave()
}

// ---- 棋盘生成 + 可解性保证 ----
function buildBoard(rows: number, cols: number, types: number) {
  const total = rows * cols
  const pairs: number[] = []
  for (let i = 0; i < total / 2; i++) {
    pairs.push(i % types, i % types)
  }
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  const newBoard: Cell[][] = []
  let idx = 0
  for (let y = 0; y < rows; y++) {
    const row: Cell[] = []
    for (let x = 0; x < cols; x++) row.push({ type: pairs[idx++], matched: false })
    newBoard.push(row)
  }
  board.value = newBoard
  // 开局可解性：若洗牌后仍死局，循环重洗（带上限保险）
  let attempts = 0
  while (!hasValidPair() && attempts < 100) {
    shuffleBoardCells()
    attempts++
  }
}

function shuffleBoardCells() {
  const cells = board.value.flat().filter(c => !c.matched)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cells[i].type, cells[j].type] = [cells[j].type, cells[i].type]
  }
}

function shuffle(explicit = false) {
  shuffleBoardCells()
  selected.value = null
  sound.click()
  if (explicit) clearSave()
}

// ---- 连接判定（≤2 转弯） ----
interface Pt { x: number; y: number }

function isEmpty(x: number, y: number): boolean {
  const cols = config.value.cols
  const rows = config.value.rows
  if (x < 0 || x >= cols || y < 0 || y >= rows) return true
  return board.value[y][x].matched
}

function isLineEmpty(x1: number, y1: number, x2: number, y2: number): boolean {
  if (x1 === x2) {
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
    for (let y = minY + 1; y < maxY; y++) {
      if (!isEmpty(x1, y)) return false
    }
    return true
  }
  if (y1 === y2) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
    for (let x = minX + 1; x < maxX; x++) {
      if (!isEmpty(x, y1)) return false
    }
    return true
  }
  return false
}

function findPath(x1: number, y1: number, x2: number, y2: number): Pt[] | null {
  const cols = config.value.cols
  const rows = config.value.rows
  if (x1 === x2 && y1 === y2) return null
  if ((x1 === x2 || y1 === y2) && isLineEmpty(x1, y1, x2, y2)) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  }
  if (isEmpty(x1, y2) && isLineEmpty(x1, y1, x1, y2) && isLineEmpty(x1, y2, x2, y2)) {
    return [{ x: x1, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }]
  }
  if (isEmpty(x2, y1) && isLineEmpty(x1, y1, x2, y1) && isLineEmpty(x2, y1, x2, y2)) {
    return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }]
  }
  for (let x = -1; x <= cols; x++) {
    if (isEmpty(x, y1) && isEmpty(x, y2) &&
      isLineEmpty(x1, y1, x, y1) && isLineEmpty(x, y1, x, y2) && isLineEmpty(x, y2, x2, y2)) {
      return [{ x: x1, y: y1 }, { x, y: y1 }, { x, y: y2 }, { x: x2, y: y2 }]
    }
  }
  for (let y = -1; y <= rows; y++) {
    if (isEmpty(x1, y) && isEmpty(x2, y) &&
      isLineEmpty(x1, y1, x1, y) && isLineEmpty(x1, y, x2, y) && isLineEmpty(x2, y, x2, y2)) {
      return [{ x: x1, y: y1 }, { x: x1, y }, { x: x2, y }, { x: x2, y: y2 }]
    }
  }
  return null
}

function canConnect(x1: number, y1: number, x2: number, y2: number): boolean {
  return findPath(x1, y1, x2, y2) !== null
}

function hasValidPair(): boolean {
  const cols = config.value.cols
  const rows = config.value.rows
  const cells: { x: number; y: number; type: number }[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!board.value[y][x].matched) cells.push({ x, y, type: board.value[y][x].type })
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[i].type === cells[j].type && canConnect(cells[i].x, cells[i].y, cells[j].x, cells[j].y)) {
        return true
      }
    }
  }
  return false
}

// ---- 消除连接线（瞬时动画） ----
const boardEl = ref<HTMLElement | null>(null)
const linkShow = ref(false)
const linkId = ref(0)
const linkPoints = ref<{ x: number; y: number }[]>([])
const linkBox = ref({ w: 0, h: 0 })
let linkTimer: ReturnType<typeof setTimeout> | null = null
const GAP = 4

const polyStr = computed(() => linkPoints.value.map(p => `${p.x},${p.y}`).join(' '))
const pathLen = computed(() =>
  linkPoints.value.reduce((acc, p, i) =>
    i === 0 ? 0 : acc + Math.hypot(p.x - linkPoints.value[i - 1].x, p.y - linkPoints.value[i - 1].y), 0)
)

function gridToScreen(p: Pt): { x: number; y: number } {
  const board = boardEl.value!
  const boardRect = board.getBoundingClientRect()
  const cells = board.querySelectorAll('.game-cell')
  const cols = config.value.cols
  const rows = config.value.rows
  const gx = Math.max(0, Math.min(cols - 1, p.x))
  const gy = Math.max(0, Math.min(rows - 1, p.y))
  const cellEl = cells[gy * cols + gx] as HTMLElement
  const r = cellEl.getBoundingClientRect()
  const x = r.left + r.width / 2 + (p.x - gx) * (r.width + GAP) - boardRect.left
  const y = r.top + r.height / 2 + (p.y - gy) * (r.height + GAP) - boardRect.top
  return { x, y }
}

function showLink(path: Pt[]) {
  const br = boardEl.value!.getBoundingClientRect()
  linkBox.value = { w: br.width, h: br.height }
  linkPoints.value = path.map(gridToScreen)
  linkId.value++
  linkShow.value = true
  if (linkTimer) clearTimeout(linkTimer)
  linkTimer = setTimeout(() => { linkShow.value = false }, 460)
}

function popScoreAt(ax: number, ay: number, bx: number, by: number) {
  const ra = gridToScreen({ x: ax, y: ay })
  const rb = gridToScreen({ x: bx, y: by })
  pop('+10', (ra.x + rb.x) / 2, (ra.y + rb.y) / 2)
}

function selectCell(x: number, y: number) {
  if (!started.value || paused.value) return
  const cell = board.value[y][x]
  if (cell.matched) return

  if (!selected.value) { selected.value = { x, y }; sound.select(); return }

  const sel = selected.value
  if (sel.x === x && sel.y === y) { selected.value = null; return }

  const selCell = board.value[sel.y][sel.x]
  const path = findPath(sel.x, sel.y, x, y)
  if (selCell.type === cell.type && path) {
    cell.matched = true; selCell.matched = true
    score.value += 10; selected.value = null
    sound.match()
    haptics.pulse()
    popScoreAt(sel.x, sel.y, x, y)
    showLink(path)
    if (remaining.value === 0) {
      stopTimer()
      sound.win()
      lastScore.value = score.value
      if (mode.value === 'campaign') {
        if (level.value >= 3) {
          if (achievements.unlock('link_campaign_clear')) toast.show('成就解锁：闯关连连看', '🏁')
          campaignClearDialog.value = true
        } else {
          levelClearDialog.value = true
        }
      } else {
        winDialog.value = true
        if (score.value >= 200 && achievements.unlock('link_master')) {
          toast.show('成就解锁：连连看达人', '🔗')
        }
      }
    } else if (!hasValidPair()) {
      // 死局自动洗牌（非用户重启，保留存档）
      shuffle()
    }
  } else {
    selected.value = { x, y }
    sound.select()
  }
}
</script>

<style scoped>
.game-board {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 0, 110, 0.2);
  border-radius: 12px;
  padding: 12px;
  display: inline-block;
  width: 100%;
  max-width: 520px;
  box-sizing: border-box;
  box-shadow: 0 0 30px rgba(255, 0, 110, 0.1);
  position: relative;
}

/* 限时进度条 */
.timer-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}
.timer-fill {
  height: 100%;
  background: #FF006E;
  transition: width 1s linear;
}

.link-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 6;
  overflow: visible;
}

.link-line {
  fill: none;
  stroke: #FF006E;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 6px rgba(255, 0, 110, 0.85));
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  animation: linkDraw 0.18s ease-out forwards, linkFade 0.3s ease-in 0.18s forwards;
}

.link-dot {
  fill: #fff;
  filter: drop-shadow(0 0 4px #FF006E);
  animation: linkFade 0.3s ease-in 0.18s forwards;
}

.game-row {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.game-cell {
  flex: 1 1 0;
  aspect-ratio: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 46, 0.9);
  border: 1px solid var(--game-cell-border);
  border-radius: 8px;
  margin: 0;
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.game-cell svg {
  width: 62%;
  height: 62%;
}

.game-cell:hover {
  background: rgba(255, 0, 110, 0.15);
  border-color: rgba(255, 0, 110, 0.3);
}

.game-cell.selected {
  background: rgba(255, 0, 110, 0.3);
  border-color: #FF006E;
  box-shadow: 0 0 15px rgba(255, 0, 110, 0.4);
}

.game-cell.matched {
  background: rgba(255, 255, 255, 0.02);
  cursor: default;
}

.game-cell.cursor {
  border-color: #00FFFF;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

/* 启动选择屏 */
.start-panel {
  width: 100%;
  max-width: 520px;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  box-sizing: border-box;
}
.start-title {
  font-size: 2em;
  color: #fff;
  margin: 0;
}
.start-sub {
  color: var(--game-text-info);
  margin: 0;
}
.mode-row {
  display: flex;
  gap: 14px;
}
.mode-card {
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 14px 28px;
  font-size: 1.05em;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.mode-card:hover,
.mode-card.active {
  background: rgba(255, 0, 110, 0.15);
  border-color: #FF006E;
  box-shadow: 0 0 15px rgba(255, 0, 110, 0.3);
}
.diff-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
.diff-btn,
.back-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--game-text);
  padding: 10px 18px;
  font-size: 0.95em;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.diff-btn:hover,
.back-btn:hover {
  background: rgba(255, 0, 110, 0.15);
  border-color: #FF006E;
}
.start-hint {
  color: var(--game-text-muted);
  font-size: 0.85em;
  text-align: center;
  margin: 0;
}

.reset-btn {
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 10px 28px;
  font-size: 0.95em;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 0, 110, 0.15);
  border-color: #FF006E;
}

.dialog-btn {
  background: linear-gradient(135deg, var(--game-accent, #FF006E), #B967FF);
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
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent, #FF006E) 40%, transparent);
}

/* 移动端大网格（困难 10×12 等 12 列宽网格）适配：
   窄屏下固定舒适格宽 + 横向滚动，避免格子被压到过小难以点按；
   桌面/平板（>480px）仍走流体布局（约 37px/格）。 */
@media (max-width: 480px) {
  .game-board {
    padding: 8px;
    max-width: 100%;
  }
  .game-row {
    gap: 3px;
    margin-bottom: 3px;
  }
  .game-cell svg {
    width: 70%;
    height: 70%;
  }
  .board-wide {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .board-wide .game-cell {
    flex: 0 0 32px;
    width: 32px;
    min-width: 32px;
  }
}
</style>
