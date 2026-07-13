<template>
  <GameLayout
    title="连连看"
    accentColor="#FF006E"
    gradientEnd="#B967FF"
    :hints="['方向键/WASD 移动', 'Enter/空格 确认', 'R 重置']"
    :infoItems="[{ label: '分数', value: score }, { label: '剩余', value: remaining }]"
    :confirmRestart="score > 0"
    tutorial="找出相同图案，用不超过两个弯的路径连接消除。全部消除即胜利！"
    @back="router.push('/')"
    @restart="initGame"
  >
    <div class="game-board" ref="boardEl">
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
      <ScoreFloat :popups="popups" />
    </div>
    <LeaderboardStrip game="link" />
    <template #controls>
      <button @click="submitScore" class="reset-btn">提交分数</button>
      <button @click="shuffle(true)" class="reset-btn">重置</button>
    </template>
    <GameDialog
      v-model:visible="winDialog"
      accentColor="#FF006E"
      icon="success"
      title="全部消除！"
      :message="'得分: ' + score"
      actionText="提交分数"
      @action="openLeaderboard"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="link"
      gameName="连连看"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="initGame"
    />
    <ResumePrompt :visible="showResume" @continue="continueGame" @new-game="newGame" />
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
import { useHaptics } from '@/composables/useHaptics'
import { useScoreFloats } from '@/composables/useScoreFloats'
import { useAutoPause } from '@/composables/useAutoPause'
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
const showResume = ref(false)

interface Cell { type: number; matched: boolean }

const ROWS = 6, COLS = 8, TYPES = 12
const board = ref<Cell[][]>([])
const selected = ref<{ x: number; y: number } | null>(null)
const cursor = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const score = ref(0)
const winDialog = ref(false)
const showLeaderboard = ref(false)
const lastScore = ref(0)

// 消除连接线（瞬时动画）
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

/** 把网格坐标（可超出棋盘边界，用于外环绕）映射到棋盘内像素坐标 */
function gridToScreen(p: Pt): { x: number; y: number } {
  const board = boardEl.value!
  const boardRect = board.getBoundingClientRect()
  const cells = board.querySelectorAll('.game-cell')
  const gx = Math.max(0, Math.min(COLS - 1, p.x))
  const gy = Math.max(0, Math.min(ROWS - 1, p.y))
  const cellEl = cells[gy * COLS + gx] as HTMLElement
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

const remaining = computed(() => board.value.flat().filter(c => !c.matched).length)

const icons = ['🍎','🍊','🍋','🍇','🍓','🍑','🥝','🍒','🥭','🍍','🥥','🫐']

// 存档
const save = useGameSave('link')
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (winDialog.value) return
    save.saveGame({ board: board.value, score: score.value })
  }, 300)
}

function clearSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  save.clearGame()
}

watch([board, score], scheduleSave, { deep: true })
onMounted(() => {
  const data = save.loadGame()
  if (data && Array.isArray(data.board) && typeof data.score === 'number') {
    const b = data.board as unknown[][]
    if (b.length === ROWS && b.every(r => r.length === COLS)) {
      showResume.value = true
      board.value = data.board as typeof board.value
      score.value = data.score
      selected.value = null
      cursor.value = { x: 0, y: 0 }
      winDialog.value = false
    }
  } else {
    initGame()
  }
})
onUnmounted(() => { if (saveTimer) clearTimeout(saveTimer); if (linkTimer) clearTimeout(linkTimer) })

useGameKeyboard({
  bindings: [
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => {
        if (winDialog.value || showResume.value) return
        cursor.value = { x: cursor.value.x, y: Math.max(0, cursor.value.y - 1) }
      }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => {
        if (winDialog.value || showResume.value) return
        cursor.value = { x: cursor.value.x, y: Math.min(ROWS - 1, cursor.value.y + 1) }
      }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => {
        if (winDialog.value || showResume.value) return
        cursor.value = { x: Math.max(0, cursor.value.x - 1), y: cursor.value.y }
      }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => {
        if (winDialog.value || showResume.value) return
        cursor.value = { x: Math.min(COLS - 1, cursor.value.x + 1), y: cursor.value.y }
      }
    },
    {
      key: ['Enter', ' '],
      handler: () => {
        if (showResume.value) return
        if (winDialog.value) { initGame(); clearSave(); return }
        selectCell(cursor.value.x, cursor.value.y)
      }
    },
    {
      key: ['r', 'R'],
      handler: () => { if (!winDialog.value && !showResume.value) shuffle(true) }
    },
    {
      key: ['p', 'P', 'Escape'],
      handler: () => { if (!winDialog.value && !showResume.value) showResume.value = true }
    }
  ]
})

// 失焦自动暂停
useAutoPause(() => {
  if (!winDialog.value && !showResume.value) showResume.value = true
})

function getIcon(type: number): string { return icons[type] || '❓' }

function openLeaderboard() {
  winDialog.value = false
  lastScore.value = score.value
  gameStore.addScore('link', score.value)
  showLeaderboard.value = true
  clearSave()
}

function submitScore() {
  lastScore.value = score.value
  winDialog.value = false
  showLeaderboard.value = true
  clearSave()
}

function continueGame() {
  showResume.value = false
}

function newGame() {
  showResume.value = false
  clearSave()
  initGame()
}

function popScoreAt(ax: number, ay: number, bx: number, by: number) {
  const ra = gridToScreen({ x: ax, y: ay })
  const rb = gridToScreen({ x: bx, y: by })
  pop('+10', (ra.x + rb.x) / 2, (ra.y + rb.y) / 2)
}

function initGame() {
  showLeaderboard.value = false
  const pairs: number[] = []
  for (let i = 0; i < ROWS * COLS / 2; i++) {
    pairs.push(i % TYPES, i % TYPES)
  }
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }

  board.value = []
  let idx = 0
  for (let y = 0; y < ROWS; y++) {
    const row: Cell[] = []
    for (let x = 0; x < COLS; x++) row.push({ type: pairs[idx++], matched: false })
    board.value.push(row)
  }
  score.value = 0
  winDialog.value = false
  selected.value = null
  linkShow.value = false
}

function isSelected(x: number, y: number): boolean {
  return selected.value?.x === x && selected.value?.y === y
}

/** 检查 (x,y) 是否为空（已消除或棋盘外） */
function isEmpty(x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true
  return board.value[y][x].matched
}

/** 检查同行/同列两点之间（不含端点）是否全空 */
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

interface Pt { x: number; y: number }

/** 查找 (x1,y1) 到 (x2,y2) 的 ≤2 转弯连通路径，返回拐点序列（含端点），不可连返回 null */
function findPath(x1: number, y1: number, x2: number, y2: number): Pt[] | null {
  // 同一位置
  if (x1 === x2 && y1 === y2) return null

  // 0 转弯：直线连接
  if ((x1 === x2 || y1 === y2) && isLineEmpty(x1, y1, x2, y2)) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  }

  // 1 转弯：通过一个拐点
  if (isEmpty(x1, y2) && isLineEmpty(x1, y1, x1, y2) && isLineEmpty(x1, y2, x2, y2)) {
    return [{ x: x1, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }]
  }
  if (isEmpty(x2, y1) && isLineEmpty(x1, y1, x2, y1) && isLineEmpty(x2, y1, x2, y2)) {
    return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }]
  }

  // 2 转弯：通过两个拐点 — 水平扫描线
  for (let x = -1; x <= COLS; x++) {
    if (isEmpty(x, y1) && isEmpty(x, y2) &&
        isLineEmpty(x1, y1, x, y1) && isLineEmpty(x, y1, x, y2) && isLineEmpty(x, y2, x2, y2)) {
      return [{ x: x1, y: y1 }, { x, y: y1 }, { x, y: y2 }, { x: x2, y: y2 }]
    }
  }
  // 2 转弯：垂直扫描线
  for (let y = -1; y <= ROWS; y++) {
    if (isEmpty(x1, y) && isEmpty(x2, y) &&
        isLineEmpty(x1, y1, x1, y) && isLineEmpty(x1, y, x2, y) && isLineEmpty(x2, y, x2, y2)) {
      return [{ x: x1, y: y1 }, { x: x1, y }, { x: x2, y }, { x: x2, y: y2 }]
    }
  }

  return null
}

/** 检查 (x1,y1) 到 (x2,y2) 是否能通过 ≤2 转弯路径连通 */
function canConnect(x1: number, y1: number, x2: number, y2: number): boolean {
  return findPath(x1, y1, x2, y2) !== null
}

/** 死局检测：是否存在至少一对可连通的同类型方块 */
function hasValidPair(): boolean {
  const cells: { x: number; y: number; type: number }[] = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
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

function selectCell(x: number, y: number) {
  if (showResume.value) return
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
      winDialog.value = true
      sound.win()
      lastScore.value = score.value
      if (score.value >= 200) {
        if (achievements.unlock('link_master')) {
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

function shuffle(explicit = false) {
  const cells = board.value.flat().filter(c => !c.matched)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i].type, cells[j].type] = [cells[j].type, cells[i].type]
  }
  selected.value = null
  sound.click()
  if (explicit) clearSave()
}

</script>

<style scoped>
.game-board {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,0,110,0.2);
  border-radius: 12px;
  padding: 12px;
  display: inline-block;
  width: 100%;
  max-width: 520px;
  box-sizing: border-box;
  box-shadow: 0 0 30px rgba(255,0,110,0.1);
  position: relative;
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

@keyframes linkDraw {
  to { stroke-dashoffset: 0; }
}

@keyframes linkFade {
  to { opacity: 0; }
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
  background: rgba(26,26,46,0.9);
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
  background: rgba(255,0,110,0.15);
  border-color: rgba(255,0,110,0.3);
}

.game-cell.selected {
  background: rgba(255,0,110,0.3);
  border-color: #FF006E;
  box-shadow: 0 0 15px rgba(255,0,110,0.4);
}

.game-cell.matched {
  background: rgba(255,255,255,0.02);
  cursor: default;
}

.game-cell.cursor {
  border-color: #00FFFF;
  box-shadow: 0 0 10px rgba(0,255,255,0.5);
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
  background: rgba(255,0,110,0.15);
  border-color: #FF006E;
}
</style>
