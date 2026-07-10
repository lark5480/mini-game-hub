<template>
  <GameLayout
    title="俄罗斯方块"
    accentColor="#00FFFF"
    gradientEnd="#FF006E"
    :hints="['Enter 开始', '方向键移动 上旋转 下软降 空格硬降']"
    :infoItems="[{ label: '分数', value: score }, { label: '行数', value: lines }]"
    :confirmRestart="score > 0"
    tutorial="旋转并放置下落的方块，填满整行即可消除。同时消除多行得分更高！"
    @back="handleBack"
    @restart="startGame"
  >
    <template #header-extra>
      <div class="desktop-only">
        <div class="mini-next">
          <span class="mini-next-label">下一个</span>
          <div class="mini-next-grid">
            <div v-for="(row, y) in nextGrid" :key="y" class="mini-next-row">
              <div
                v-for="(cell, x) in row"
                :key="x"
                class="mini-next-cell"
                :class="{ filled: cell }"
                :style="cell ? { background: cell } : {}"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div class="game-board" ref="boardEl">
      <div v-for="(row, y) in displayGrid" :key="y" class="game-row">
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="game-cell"
          :class="{ filled: cell.color }"
          :style="cell.color ? { background: cell.color, boxShadow: `0 0 6px ${cell.color}80` } : {}"
        ></div>
      </div>
      <ScoreFloat :popups="popups" />
    </div>
    <LeaderboardStrip game="tetris" />
    <template #controls>
      <div class="controls-flex">
        <div class="controls-next">
          <div class="controls-next-grid">
            <div v-for="(row, y) in nextGrid" :key="y" class="controls-next-row">
              <div
                v-for="(cell, x) in row"
                :key="x"
                class="controls-next-cell"
                :class="{ filled: cell }"
                :style="cell ? { background: cell } : {}"
              ></div>
            </div>
          </div>
        </div>
        <DirectionPad
          @up="switchShape"
          @down="softDrop"
          @left="move(-1)"
          @right="move(1)"
        >
          <template #extra>
            <button @click="drop" class="hard-drop-btn">硬降</button>
            <button v-if="!isPlaying" @click="startGame" class="start-btn">开始</button>
            <template v-else>
              <button v-if="!paused && !showResume" @click="togglePause" class="extra-btn">暂停</button>
              <button v-else-if="paused && !showResume" @click="togglePause" class="extra-btn">继续</button>
              <button @click="startGame" class="extra-btn">重新开始</button>
            </template>
          </template>
        </DirectionPad>
      </div>
    </template>
    <GameDialog
      :visible="gameOver"
      accentColor="#00FFFF"
      icon="fail"
      title="游戏结束"
      :message="'得分: ' + score"
      actionText="提交分数"
      @action="openLeaderboard"
      @update:visible="onDialogClose"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="tetris"
      gameName="俄罗斯方块"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="startGame"
    />
    <PauseOverlay :visible="paused" @resume="togglePause" />
    <ResumePrompt :visible="showResume" @continue="continueGame" @new-game="newGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import { useGameSave } from '@/composables/useGameSave'
import { useAutoPause } from '@/composables/useAutoPause'
import { useHaptics } from '@/composables/useHaptics'
import { useScoreFloats } from '@/composables/useScoreFloats'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import DirectionPad from '@/components/DirectionPad.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'
import ResumePrompt from '@/components/ResumePrompt.vue'
import ScoreFloat from '@/components/ScoreFloat.vue'

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()
const achievements = useAchievements()
const toast = useToast()
const haptics = useHaptics()
const { popups, pop } = useScoreFloats()
const showResume = ref(false)

const GRID_W = 10, GRID_H = 20
type Cell = { color: string | null }
type Tetromino = { shape: number[][], color: string }

const TETROS: Tetromino[] = [
  { shape: [[1,1,1,1]], color: '#00FFFF' },
  { shape: [[1,1],[1,1]], color: '#FFFF00' },
  { shape: [[0,1,0],[1,1,1]], color: '#A000FF' },
  { shape: [[0,1,1],[1,1,0]], color: '#00FF00' },
  { shape: [[1,1,0],[0,1,1]], color: '#FF0000' },
  { shape: [[1,0,0],[1,1,1]], color: '#0000FF' },
  { shape: [[0,0,1],[1,1,1]], color: '#FF8000' }
]

const grid = ref<Cell[][]>([])
const current = ref<{ x: number, y: number, shape: number[][], color: string } | null>(null)
const nextPiece = ref<Tetromino | null>(null)
const score = ref(0), lines = ref(0), isPlaying = ref(false), gameOver = ref(false)
const nextGrid = ref<string[][]>([])
const showLeaderboard = ref(false)
const lastScore = ref(0)

// 存档
const save = useGameSave('tetris')
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!isPlaying.value || gameOver.value) return
    save.saveGame({
      grid: grid.value,
      current: current.value,
      nextPiece: nextPiece.value,
      score: score.value,
      lines: lines.value,
      isPlaying: isPlaying.value
    })
  }, 300)
}

function clearSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  save.clearGame()
}

watch([grid, current, nextPiece, score, lines, isPlaying], scheduleSave, { deep: true })
onMounted(() => {
  const data = save.loadGame()
  if (data && Array.isArray(data.grid) && typeof data.score === 'number' && !!data.isPlaying) {
    grid.value = data.grid as Cell[][]
    current.value = (data.current as typeof current.value) ?? null
    nextPiece.value = (data.nextPiece as Tetromino | null) ?? null
    score.value = data.score
    lines.value = typeof data.lines === 'number' ? data.lines : 0
    isPlaying.value = true
    gameOver.value = false
    if (nextPiece.value) renderNext()
    showResume.value = true
  }
})
onUnmounted(() => { if (saveTimer) clearTimeout(saveTimer) })

const displayGrid = computed(() => {
  const d = grid.value.map(row => row.map(c => ({ color: c.color })))
  if (current.value) {
    current.value.shape.forEach((row, dy) => {
      row.forEach((c, dx) => {
        if (c) {
          const y = current.value!.y + dy
          const x = current.value!.x + dx
          if (y >= 0 && y < GRID_H && x >= 0 && x < GRID_W) {
            d[y][x].color = current.value!.color
          }
        }
      })
    })
  }
  return d
})

const gameLoop = useGameLoop({
  mode: 'interval',
  intervalMs: 400,
  onUpdate: () => step()
})
const paused = gameLoop.paused

function togglePause() {
  if (showResume.value || gameOver.value || !isPlaying.value) return
  if (paused.value) { gameLoop.resume(); sound.resume() }
  else { gameLoop.pause(); sound.pause() }
}

function continueGame() {
  showResume.value = false
  if (isPlaying.value && !gameOver.value) gameLoop.start()
}

function newGame() {
  showResume.value = false
  startGame()
}

useAutoPause(() => {
  if (isPlaying.value && !gameOver.value && !showResume.value) gameLoop.pause()
})

const boardEl = ref<HTMLElement | null>(null)

useGameKeyboard({
  active: true,
  bindings: [
    {
      key: ['Enter'],
      handler: () => {
        if (!isPlaying.value) startGame()
      }
    },
    {
      key: [' '],
      handler: () => {
        if (isPlaying.value && !gameOver.value && !paused.value) drop()
      }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (isPlaying.value && !gameOver.value && !paused.value) move(-1) }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (isPlaying.value && !gameOver.value && !paused.value) move(1) }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => { if (isPlaying.value && !gameOver.value && !paused.value) softDrop() }
    },
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => { if (isPlaying.value && !gameOver.value && !paused.value) switchShape() }
    },
    {
      key: ['p', 'P', 'Escape'],
      handler: () => togglePause()
    }
  ]
})

function initGrid() {
  const g: Cell[][] = []
  for (let y = 0; y < GRID_H; y++) {
    const row: Cell[] = []
    for (let x = 0; x < GRID_W; x++) row.push({ color: null })
    g.push(row)
  }
  grid.value = g
}

function randomPiece(): Tetromino {
  const t = TETROS[Math.floor(Math.random() * TETROS.length)]
  return { shape: t.shape.map(r => [...r]), color: t.color }
}

function renderNext() {
  const g: string[][] = []
  const p = nextPiece.value!
  for (let y = 0; y < 4; y++) {
    const row: string[] = []
    for (let x = 0; x < 4; x++) row.push('')
    g.push(row)
  }
  p.shape.forEach((r, y) => r.forEach((c, x) => { if (c) g[y][x] = p.color }))
  nextGrid.value = g
}

function collides(shape: number[][], x: number, y: number): boolean {
  for (let dy = 0; dy < shape.length; dy++) {
    for (let dx = 0; dx < shape[dy].length; dx++) {
      if (shape[dy][dx]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= GRID_W || ny >= GRID_H) return true
        if (ny < 0) continue
        if (grid.value[ny][nx].color) return true
      }
    }
  }
  return false
}

function spawnPiece() {
  const p = nextPiece.value || randomPiece()
  current.value = { x: 3, y: 0, shape: p.shape.map(r => [...r]), color: p.color }
  nextPiece.value = randomPiece()
  renderNext()
  if (collides(current.value.shape, current.value.x, current.value.y)) {
    endGame()
  }
}

function placePiece() {
  current.value!.shape.forEach((row, dy) => {
    row.forEach((c, dx) => {
      if (c) {
        const y = current.value!.y + dy, x = current.value!.x + dx
        if (y >= 0) grid.value[y][x].color = current.value!.color
      }
    })
  })
}

function clearLines() {
  let cleared = 0
  for (let y = GRID_H - 1; y >= 0; y--) {
    if (grid.value[y].every(c => c.color)) {
      grid.value.splice(y, 1)
      grid.value.unshift(Array(GRID_W).fill(0).map(() => ({ color: null })))
      cleared++
      y++
    }
  }
  if (cleared > 0) {
    sound.clear(cleared)
    haptics.pulse()
    lines.value += cleared
    const pts = [0, 100, 300, 500, 800]
    const gained = pts[cleared] || 800
    score.value += gained
    popScoreAt(gained)
    if (lines.value >= 50) {
      if (achievements.unlock('tetris_master')) {
        toast.show('成就解锁：建筑大师', '🎯')
      }
    }
  }
}

function popScoreAt(gained: number) {
  const el = boardEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  pop('+' + gained, rect.width / 2, rect.height * 0.6)
}

function step() {
  if (paused.value) return
  if (!current.value || !isPlaying.value) return
  if (collides(current.value.shape, current.value.x, current.value.y + 1)) {
    placePiece()
    sound.drop()
    clearLines()
    spawnPiece()
  } else {
    current.value.y++
  }
}

function move(dir: number) {
  if (current.value && isPlaying.value && !paused.value && !collides(current.value.shape, current.value.x + dir, current.value.y)) {
    current.value.x += dir
    sound.move()
  }
}

function switchShape() {
  if (!current.value || !isPlaying.value || paused.value) return
  const s = current.value.shape
  const rotated = s[0].map((_, i) => s.map(r => r[i]).reverse())
  if (!collides(rotated, current.value.x, current.value.y)) {
    current.value.shape = rotated
    sound.rotate()
  }
}

function softDrop() {
  if (current.value && isPlaying.value && !paused.value && !collides(current.value.shape, current.value.x, current.value.y + 1)) {
    current.value.y++
    score.value += 1
  }
}

function drop() {
  if (!current.value || !isPlaying.value || paused.value) return
  while (!collides(current.value.shape, current.value.x, current.value.y + 1)) {
    current.value.y++
  }
  sound.drop()
}

function startGame() {
  gameLoop.stop()
  showLeaderboard.value = false
  clearSave()
  initGrid()
  score.value = 0; lines.value = 0; gameOver.value = false; isPlaying.value = false
  nextPiece.value = randomPiece()
  spawnPiece()
  if (gameOver.value) return
  isPlaying.value = true
  gameLoop.start()
}

function endGame() {
  isPlaying.value = false; gameOver.value = true
  gameLoop.stop()
  sound.gameOver()
  lastScore.value = score.value
  gameStore.addScore('tetris', score.value)
}

function openLeaderboard() {
  gameOver.value = false
  showLeaderboard.value = true
  clearSave()
}

function onDialogClose(visible: boolean) {
  if (!visible && gameOver.value) {
    gameOver.value = false
    initGrid()
    nextPiece.value = randomPiece()
    renderNext()
  }
}

function handleBack() {
  gameLoop.stop()
  router.push('/')
}

initGrid()
</script>

<style scoped>
/* header-extra 仅桌面端可见 */
.desktop-only {
  display: block;
}
@media (max-width: 640px) {
  .desktop-only { display: none; }
}

/* 标题栏迷你下一个（桌面端） */
.mini-next {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(0,255,255,0.15);
  border-radius: 8px;
  padding: 4px 8px 4px 10px;
  white-space: nowrap;
}

.mini-next-label {
  color: #818CF8;
  font-size: 0.75em;
  flex-shrink: 0;
}

.mini-next-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  width: 40px;
  flex-shrink: 0;
}

.mini-next-row { display: contents; }

.mini-next-cell {
  width: 100%;
  aspect-ratio: 1;
  min-width: 0;
  border-radius: 1px;
  border: 1px solid rgba(255,255,255,0.04);
  box-sizing: border-box;
}

.mini-next-cell.filled {
  box-shadow: 0 0 4px rgba(0,255,255,0.4);
}

/* 控制区 flex 容器 */
.controls-flex {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* 手机端"下一个"预览（按钮栏内） */
.controls-next {
  display: none;
  width: 44px;
  flex-shrink: 0;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(0,255,255,0.15);
  border-radius: 8px;
  padding: 4px;
  box-sizing: content-box;
}

.controls-next-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  width: 44px;
}

.controls-next-row { display: contents; }

.controls-next-cell {
  width: 100%;
  aspect-ratio: 1;
  min-width: 0;
  border-radius: 1px;
  border: 1px solid rgba(255,255,255,0.04);
  box-sizing: border-box;
}

.controls-next-cell.filled {
  box-shadow: 0 0 4px rgba(0,255,255,0.4);
}

/* 棋盘 */
.game-board {
  position: relative;
  background: rgba(0,0,0,0.5);
  border: 2px solid rgba(0,255,255,0.5);
  border-radius: 8px;
  padding: 5px;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  box-shadow: 0 0 40px rgba(0,255,255,0.25);
}

.game-row { display: contents; }

.game-cell {
  width: 100%;
  aspect-ratio: 1;
  min-width: 0;
  border: 1px solid rgba(255,255,255,0.03);
  box-sizing: border-box;
}

.game-cell.filled {
  border-radius: 3px;
}

@media (max-width: 640px) {
  .game-board { max-width: 100%; }

  /* 手机端显示控制区下一个预览 */
  .controls-next { display: block; }
}

.hard-drop-btn {
  background: rgba(255,0,110,0.15);
  border: 1px solid rgba(255,0,110,0.3);
  color: var(--game-text);
  padding: 10px 24px;
  font-size: 0.95em;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.hard-drop-btn:hover {
  background: rgba(255,0,110,0.25);
  border-color: #FF006E;
}

.start-btn {
  padding: 10px 35px;
  font-size: 1.2em;
  font-weight: 600;
  background: linear-gradient(135deg, #00FFFF, #818CF8);
  color: #0D0D1A;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(0,255,255,0.4);
}

.extra-btn {
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 10px 20px;
  font-size: 0.95em;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.extra-btn:hover {
  background: rgba(0,255,255,0.15);
  border-color: var(--game-accent);
}
</style>
