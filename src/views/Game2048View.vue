<template>
  <GameLayout
    title="2048"
    accentColor="#FFD700"
    entrance="game2048"
    gradientEnd="#FF6B6B"
    :hints="['方向键/WASD 移动', 'Z 撤销', 'R 重新开始']"
    :infoItems="infoItems"
    :confirmRestart="score > 0"
    tutorial="滑动合并相同数字的方块，目标达到2048！每次滑动会随机出现新方块。"
        mood="gold"
    @back="router.push('/')"
    @restart="restart"
  >
    <div class="game-board" ref="boardEl">
      <div class="grid-bg">
        <div class="grid-cell" v-for="n in 16" :key="n" />
      </div>
      <div class="tile-layer">
        <div
          v-for="t in renderTiles"
          :key="t.id"
          class="tile"
          :class="{ 'tile-source': t.kind === 'source' }"
          :style="tileStyle(t)"
        >
          <div :class="tileClass(t)">{{ t.value }}</div>
        </div>
      </div>
      <ScoreFloat :popups="popups" />
    </div>

    <div class="progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPct + '%' }" />
      </div>
      <div class="progress-label">
        最大 <b>{{ largestTile }}</b> / 目标 2048
        <span v-if="largestTile >= 2048" class="progress-next">· 继续挑战 {{ largestTile * 2 }}!</span>
      </div>
    </div>

    <LeaderboardStrip game="2048" />

    <template #controls>
      <DirectionPad
        :repeat="true"
        @up="(rep) => move('up', rep)"
        @down="(rep) => move('down', rep)"
        @left="(rep) => move('left', rep)"
        @right="(rep) => move('right', rep)"
      >
        <template #extra>
          <button @click="undo" class="extra-btn" :disabled="history.length === 0">撤销</button>
          <button @click="submitScore" class="extra-btn">提交分数</button>
          <button @click="restart()" class="extra-btn">重来</button>
        </template>
      </DirectionPad>
    </template>

    <GameDialog
      v-model:visible="winDialog"
      accentColor="#FFD700"
      icon="success"
      :title="newRecord ? '新纪录！' : '恭喜通关！'"
      :message="'达到 2048！得分: ' + score"
      actionText="继续挑战"
      @action="winDialog = false"
      :newRecord="newRecord"
      :achievementHint="achievementHint"
      :stats="gameStats"
    />
    <GameDialog
      v-model:visible="gameOverDialog"
      accentColor="#FFD700"
      :icon="newRecord ? 'success' : 'fail'"
      :title="newRecord ? '新纪录！' : '游戏结束'"
      :message="'最终得分: ' + score"
      :actionText="newRecord ? '提交新纪录' : '提交分数'"
      :newRecord="newRecord"
      :achievementHint="achievementHint"
      :stats="gameStats"
      @action="openLeaderboard"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="2048"
      gameName="2048"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="restart"
    />
    <ResumePrompt :visible="paused" @continue="continueGame" @new-game="newGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useSwipe } from '@/composables/useSwipe'
import { useSound } from '@/composables/useSound'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import { useGameSave } from '@/composables/useGameSave'
import { useAutoSave } from '@/composables/useAutoSave'
import { useHaptics } from '@/composables/useHaptics'
import { useGamePause } from '@/composables/useGamePause'
import { useScoreFloats } from '@/composables/useScoreFloats'
import { useGameOver, type GameStat } from '@/composables/useGameOver'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import DirectionPad from '@/components/DirectionPad.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import ResumePrompt from '@/components/ResumePrompt.vue'
import ScoreFloat from '@/components/ScoreFloat.vue'

type Direction = 'up' | 'down' | 'left' | 'right'
type Grid = (Tile | null)[][]
interface Tile {
  id: number
  value: number
  x: number
  y: number
  mergedFrom: [Tile, Tile] | null
  isNew: boolean
}
type History = { grid: number[][]; score: number }

const SIZE = 4
const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()
const achievements = useAchievements()
const toast = useToast()
const haptics = useHaptics()
const { popups, pop } = useScoreFloats()
const { checkGameOver } = useGameOver()

let tileId = 1
function createTile(x: number, y: number, value: number, isNew = false): Tile {
  return { id: tileId++, value, x, y, mergedFrom: null, isNew }
}

const grid = ref<Grid>(createEmptyGrid())
const score = ref(0)
const moves = ref(0)
const bestScore = computed(() => gameStore.getTopScore('2048'))
const winDialog = ref(false)
const newRecord = ref(false)
const achievementHint = ref<string | null>(null)
const gameOverDialog = ref(false)
const showLeaderboard = ref(false)
const lastScore = ref(0)
const won = ref(false)
const history = ref<History[]>([])
const gameStats = ref<GameStat[]>()

const largestTile = computed(() => {
  let m = 0
  for (const row of grid.value) for (const t of row) if (t && t.value > m) m = t.value
  return m
})

const progressPct = computed(() => {
  const m = largestTile.value
  if (m <= 2) return 0
  return Math.min(100, (Math.log2(m) / Math.log2(2048)) * 100)
})

const infoItems = computed(() => [
  { label: '分数', value: score.value },
  { label: '最高', value: bestScore.value },
  { label: '步数', value: moves.value }
])

// 渲染列表：普通方块 + 合并结果 + 合并来源（用于滑动动画）
interface RenderTile { id: number; value: number; x: number; y: number; kind: 'normal' | 'merged' | 'source'; isNew: boolean }
const renderTiles = computed<RenderTile[]>(() => {
  const list: RenderTile[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = grid.value[y][x]
      if (!t) continue
      if (t.mergedFrom) {
        for (const src of t.mergedFrom) {
          list.push({ id: src.id, value: src.value, x: t.x, y: t.y, kind: 'source', isNew: false })
        }
      }
      list.push({ id: t.id, value: t.value, x: t.x, y: t.y, kind: t.mergedFrom ? 'merged' : 'normal', isNew: t.isNew })
    }
  }
  return list
})

function tileStyle(t: RenderTile) {
  return {
    transform: `translate(calc(${t.x} * (100% + var(--gap))), calc(${t.y} * (100% + var(--gap))))`,
    zIndex: t.kind === 'source' ? 1 : 2
  }
}

function tileClass(t: RenderTile) {
  return [
    'tile-inner',
    `tile-${Math.min(t.value, 131072)}`,
    { 'tile-new': t.isNew && t.kind !== 'merged' },
    { 'tile-merged': t.kind === 'merged' }
  ]
}

// 存档：以数值矩阵为单一数据源，读档时重建方块身份
function gridToValues(g: Grid): number[][] {
  return g.map(row => row.map(t => (t ? t.value : 0)))
}
function valuesToGrid(vals: number[][]): Grid {
  return vals.map((row, y) => row.map((v, x) => (v ? createTile(x, y, v, false) : null)))
}

const save = useGameSave('2048')
const { scheduleSave, clearSave } = useAutoSave('2048', () => ({
  grid: gridToValues(grid.value),
  score: score.value,
  moves: moves.value,
  won: won.value,
  history: history.value
}), { beforeSave: () => !gameOverDialog.value })

watch([grid, score, moves, won, history], scheduleSave, { deep: true })
onMounted(() => {
  const data = save.loadGame()
  if (data && Array.isArray(data.grid)) {
    paused.value = true
    grid.value = valuesToGrid(data.grid as number[][])
    score.value = typeof data.score === 'number' ? data.score : 0
    moves.value = typeof data.moves === 'number' ? data.moves : 0
    won.value = !!data.won
    history.value = Array.isArray(data.history) ? (data.history as History[]) : []
  } else {
    restart({ restoring: true })
  }
})

const gameActive = () => !gameOverDialog.value && !winDialog.value && !paused.value

const { paused } = useGamePause({
  canPause: () => gameActive(),
  autoPause: true
})

useGameKeyboard({
  bindings: [
    { key: ['ArrowUp', 'w', 'W'], handler: (e) => { if (e && e.repeat) return; handleMove('up') } },
    { key: ['ArrowDown', 's', 'S'], handler: (e) => { if (e && e.repeat) return; handleMove('down') } },
    { key: ['ArrowLeft', 'a', 'A'], handler: (e) => { if (e && e.repeat) return; handleMove('left') } },
    { key: ['ArrowRight', 'd', 'D'], handler: (e) => { if (e && e.repeat) return; handleMove('right') } },
    { key: ['z', 'Z'], handler: (e) => { if (e && e.repeat) return; undo() } },
    { key: ['r', 'R'], handler: (e) => { if (e && e.repeat) return; restart() } }
  ]
})

const boardEl = ref<HTMLElement | null>(null)
useSwipe({
  el: () => boardEl.value,
  active: () => gameActive(),
  onSwipe: (dir) => move(dir),
  lockDirection: true
})

function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
}

function getEmptyCells(g: Grid): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x] === null) cells.push({ x, y })
    }
  }
  return cells
}

function spawnTile(): boolean {
  const empty = getEmptyCells(grid.value)
  if (empty.length === 0) return false
  const cell = empty[Math.floor(Math.random() * empty.length)]
  const maxTile = largestTile.value
  const fourChance = maxTile > 2048 ? 0.5 : 0.1
  grid.value[cell.y][cell.x] = createTile(cell.x, cell.y, Math.random() < (1 - fourChance) ? 2 : 4, true)
  return true
}

// ---- 移动算法（带方块身份，支持滑动 + 合并动画） ----
function getVector(dir: Direction) {
  switch (dir) {
    case 'up': return { x: 0, y: -1 }
    case 'down': return { x: 0, y: 1 }
    case 'left': return { x: -1, y: 0 }
    case 'right': return { x: 1, y: 0 }
  }
}

function buildTraversals(vector: { x: number; y: number }) {
  const x = [0, 1, 2, 3]
  const y = [0, 1, 2, 3]
  if (vector.x === 1) x.reverse()
  if (vector.y === 1) y.reverse()
  return { x, y }
}

function withinBounds(p: { x: number; y: number }) {
  return p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE
}

function findFarthest(cell: { x: number; y: number }, vector: { x: number; y: number }) {
  let prev = cell
  let cur = { x: cell.x + vector.x, y: cell.y + vector.y }
  while (withinBounds(cur) && grid.value[cur.y][cur.x] === null) {
    prev = cur
    cur = { x: cur.x + vector.x, y: cur.y + vector.y }
  }
  return { farthest: prev, next: cur }
}

function prepareTiles() {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = grid.value[y][x]
      if (t) t.mergedFrom = null
    }
  }
}

function handleMove(dir: Direction, silent = false) {
  if (winDialog.value || gameOverDialog.value || paused.value) return

  const prevValues = gridToValues(grid.value)
  const prevScore = score.value

  const vector = getVector(dir)
  const trav = buildTraversals(vector)
  let moved = false
  let totalMerged = 0
  let maxMerged = 0

  prepareTiles()

  trav.x.forEach(x => {
    trav.y.forEach(y => {
      const tile = grid.value[y][x]
      if (!tile) return
      const { farthest, next } = findFarthest({ x, y }, vector)
      const nextTile = withinBounds(next) ? grid.value[next.y][next.x] : null
      if (nextTile && nextTile.value === tile.value && !nextTile.mergedFrom) {
        // 合并：新结果方块弹出，两个来源方块滑入该格
        const merged = createTile(next.x, next.y, tile.value * 2)
        merged.mergedFrom = [tile, nextTile]
        grid.value[next.y][next.x] = merged
        grid.value[y][x] = null
        tile.x = next.x
        tile.y = next.y
        totalMerged += merged.value
        maxMerged = Math.max(maxMerged, merged.value)
        moved = true
      } else if (farthest.x !== x || farthest.y !== y) {
        grid.value[y][x] = null
        grid.value[farthest.y][farthest.x] = tile
        tile.x = farthest.x
        tile.y = farthest.y
        moved = true
      }
    })
  })

  if (!moved) {
    // 连发（按住）时无效移动不反馈，避免狂震
    if (!silent) haptics.light()
    return
  }

  history.value.push({ grid: prevValues, score: prevScore })
  if (history.value.length > 20) history.value.shift()
  moves.value++
  score.value += totalMerged
  if (totalMerged > 0) {
    // 音高跟随本次合成出的最大方块值
    sound.merge(maxMerged)
    haptics.pulse()
    popScoreAt(totalMerged)
  }
  spawnTile()

  if (!won.value && largestTile.value >= 2048) {
    won.value = true
    winDialog.value = true
    lastScore.value = score.value
    const { isNewRecord: isNewRecordResult, achievementHint: hint, stats } = checkGameOver('2048', score.value, [
      { label: '最大方块', value: String(largestTile.value) },
      { label: '步数', value: String(moves.value) }
    ])
    newRecord.value = isNewRecordResult
    achievementHint.value = hint
    gameStats.value = stats
    return
  }

  if (largestTile.value >= 4096 && achievements.unlock('number_master')) {
    toast.show('成就解锁：数字大师', '🔢')
  }

  if (!canMove(grid.value)) {
    lastScore.value = score.value
    const { isNewRecord: isNewRecordResult, achievementHint: hint, stats } = checkGameOver('2048', score.value, [
      { label: '最大方块', value: String(largestTile.value) },
      { label: '步数', value: String(moves.value) }
    ])
    newRecord.value = isNewRecordResult
    achievementHint.value = hint
    gameStats.value = stats
    gameOverDialog.value = true
  }
}

function move(dir: Direction, silent = false) {
  handleMove(dir, silent)
}

function canMove(g: Grid): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x] === null) return true
      const v = g[y][x]!.value
      if (x + 1 < SIZE && g[y][x + 1] && g[y][x + 1]!.value === v) return true
      if (y + 1 < SIZE && g[y + 1][x] && g[y + 1][x]!.value === v) return true
    }
  }
  return false
}

function undo() {
  if (history.value.length === 0 || winDialog.value || gameOverDialog.value) return
  const prev = history.value.pop()!
  grid.value = valuesToGrid(prev.grid)
  score.value = prev.score
  moves.value = Math.max(0, moves.value - 1)
}

function restart(opts: { restoring?: boolean } = {}) {
  showLeaderboard.value = false
  grid.value = createEmptyGrid()
  score.value = 0
  moves.value = 0
  won.value = false
  winDialog.value = false
  gameOverDialog.value = false
  history.value = []
  spawnTile()
  spawnTile()
  if (!opts.restoring) clearSave()
}

function openLeaderboard() {
  gameOverDialog.value = false
  showLeaderboard.value = true
  clearSave()
}

function submitScore() {
  lastScore.value = score.value
  gameOverDialog.value = false
  winDialog.value = false
  showLeaderboard.value = true
  clearSave()
}

function continueGame() {
  paused.value = false
}

function newGame() {
  paused.value = false
  restart({ restoring: false })
}

function popScoreAt(amount: number) {
  const el = boardEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  pop('+' + amount, rect.width / 2, rect.height / 2)
}

</script>

<style scoped>
.game-board {
  --gap: 8px;
  --pad: 10px;
  position: relative;
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
  padding: var(--pad);
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.08);
  touch-action: none;
}

.grid-bg {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: var(--gap);
}

.grid-cell {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.tile-layer {
  position: absolute;
  top: var(--pad);
  left: var(--pad);
  right: var(--pad);
  bottom: var(--pad);
}

/* 外层只负责位移滑动（transform 过渡） */
.tile {
  position: absolute;
  width: calc(25% - 3 * var(--gap) / 4);
  height: calc(25% - 3 * var(--gap) / 4);
  transition: transform 0.12s ease-in-out;
  z-index: 2;
}

.tile-source {
  z-index: 1;
}

/* 内层负责配色 + 弹跳（与位移解耦，互不干扰） */
.tile-inner {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.5em;
  transition: background 0.15s, box-shadow 0.15s;
}

.tile-inner.tile-new {
  animation: appear 0.18s ease-out;
}

.tile-inner.tile-merged {
  animation: tile-merge 0.18s ease-out;
}

/* 方块颜色 — 赛博朋克霓虹渐变 */
.tile-inner.tile-2 {
  background: rgba(0, 255, 255, 0.12);
  color: #00FFFF;
  box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.1);
}

.tile-inner.tile-4 {
  background: rgba(0, 255, 255, 0.2);
  color: #00FFFF;
  box-shadow: inset 0 0 15px rgba(0, 255, 255, 0.15);
}

.tile-inner.tile-8 {
  background: rgba(5, 255, 161, 0.15);
  color: #05FFA1;
  box-shadow: inset 0 0 15px rgba(5, 255, 161, 0.15);
}

.tile-inner.tile-16 {
  background: rgba(5, 255, 161, 0.25);
  color: #05FFA1;
  box-shadow: 0 0 10px rgba(5, 255, 161, 0.2);
}

.tile-inner.tile-32 {
  background: rgba(255, 215, 0, 0.15);
  color: #FFD700;
  box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.1);
}

.tile-inner.tile-64 {
  background: rgba(255, 215, 0, 0.25);
  color: #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.25);
}

.tile-inner.tile-128 {
  background: rgba(255, 0, 110, 0.15);
  color: #FF006E;
  box-shadow: inset 0 0 15px rgba(255, 0, 110, 0.15);
  font-size: 1.3em;
}

.tile-inner.tile-256 {
  background: rgba(255, 0, 110, 0.25);
  color: #FF006E;
  box-shadow: 0 0 15px rgba(255, 0, 110, 0.25);
  font-size: 1.3em;
}

.tile-inner.tile-512 {
  background: rgba(185, 103, 255, 0.2);
  color: #B967FF;
  box-shadow: 0 0 20px rgba(185, 103, 255, 0.2);
  font-size: 1.3em;
}

.tile-inner.tile-1024 {
  background: rgba(185, 103, 255, 0.3);
  color: #B967FF;
  box-shadow: 0 0 25px rgba(185, 103, 255, 0.3);
  font-size: 1.1em;
}

.tile-inner.tile-2048 {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 0, 110, 0.3));
  color: #FFD700;
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.4), 0 0 20px rgba(255, 0, 110, 0.2);
  font-size: 1.1em;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.tile-inner.tile-4096,
.tile-inner.tile-8192,
.tile-inner.tile-16384,
.tile-inner.tile-32768,
.tile-inner.tile-65536,
.tile-inner.tile-131072 {
  background: linear-gradient(135deg, rgba(255, 0, 110, 0.35), rgba(185, 103, 255, 0.35));
  color: #fff;
  box-shadow: 0 0 30px rgba(255, 0, 110, 0.3);
  font-size: 1em;
}

/* 进度条 */
.progress {
  width: 100%;
  max-width: 380px;
  margin: 14px auto 0;
  padding: 0 2px;
  box-sizing: border-box;
}

.progress-bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #00FFFF, #FFD700, #FF006E);
  transition: width 0.25s ease-out;
}

.progress-label {
  margin-top: 6px;
  font-size: 0.82em;
  color: var(--game-text, #fff);
  opacity: 0.8;
}

.progress-next {
  color: #FFD700;
}

.extra-btn {
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 10px 24px;
  font-size: 0.95em;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.extra-btn:hover:not(:disabled) {
  background: rgba(255, 215, 0, 0.1);
  border-color: #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
}

.extra-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 400px) {
  .game-board {
    --gap: 5px;
    --pad: 6px;
  }

  .tile-inner {
    border-radius: 6px;
  }

  .tile-inner.tile-128,
  .tile-inner.tile-256,
  .tile-inner.tile-512 {
    font-size: 1em;
  }

  .tile-inner.tile-1024,
  .tile-inner.tile-2048,
  .tile-inner.tile-4096,
  .tile-inner.tile-8192,
  .tile-inner.tile-16384,
  .tile-inner.tile-32768,
  .tile-inner.tile-65536,
  .tile-inner.tile-131072 {
    font-size: 0.85em;
  }
}
</style>
