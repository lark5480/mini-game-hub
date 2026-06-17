<template>
  <GameLayout
    title="2048"
    accentColor="#FFD700"
    gradientEnd="#FF6B6B"
    :hints="['方向键/WASD 移动', 'Z 撤销', 'R 重新开始']"
    :infoItems="infoItems"
    @back="router.push('/')"
  >
    <div class="game-board">
      <div v-for="(row, y) in grid" :key="y" class="board-row">
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="board-cell"
          :class="{ [`tile-${Math.min(cell, 131072)}`]: true }"
        >
          <span v-if="cell > 0" class="tile-value" :class="{ 'tile-pop': isAnimating(x, y) }">
            {{ cell }}
          </span>
        </div>
      </div>
    </div>
    <template #controls>
      <DirectionPad
        @up="move('up')"
        @down="move('down')"
        @left="move('left')"
        @right="move('right')"
      >
        <template #extra>
          <button @click="undo" class="extra-btn" :disabled="history.length === 0">撤销</button>
          <button @click="restart" class="extra-btn">重来</button>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="winDialog"
      accentColor="#FFD700"
      icon="success"
      title="恭喜通关！"
      :message="'达到 2048！得分: ' + score"
      actionText="继续挑战"
      @action="winDialog = false"
    />
    <GameDialog
      v-model:visible="gameOverDialog"
      accentColor="#FF006E"
      icon="fail"
      title="游戏结束"
      :message="'最终得分: ' + score"
      actionText="再来一局"
      @action="restart"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useSound } from '@/composables/useSound'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import DirectionPad from '@/components/DirectionPad.vue'

type Direction = 'up' | 'down' | 'left' | 'right'
type Grid = number[][]
type History = { grid: Grid; score: number }

const SIZE = 4
const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()

const grid = ref<Grid>(createEmptyGrid())
const score = ref(0)
const bestScore = computed(() => gameStore.getTopScore('2048'))
const winDialog = ref(false)
const gameOverDialog = ref(false)
const won = ref(false)
const history = ref<History[]>([])
const newTiles = ref<{ x: number; y: number }[]>([])

const infoItems = computed(() => [
  { label: '分数', value: score.value },
  { label: '最高', value: bestScore.value }
])

useGameKeyboard({
  bindings: [
    { key: ['ArrowUp', 'w', 'W'], handler: () => handleMove('up') },
    { key: ['ArrowDown', 's', 'S'], handler: () => handleMove('down') },
    { key: ['ArrowLeft', 'a', 'A'], handler: () => handleMove('left') },
    { key: ['ArrowRight', 'd', 'D'], handler: () => handleMove('right') },
    { key: ['z', 'Z'], handler: () => undo() },
    { key: ['r', 'R'], handler: () => restart() }
  ]
})

function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function cloneGrid(g: Grid): Grid {
  return g.map(row => [...row])
}

function getEmptyCells(g: Grid): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x] === 0) cells.push({ x, y })
    }
  }
  return cells
}

function spawnTile(): boolean {
  const empty = getEmptyCells(grid.value)
  if (empty.length === 0) return false
  const cell = empty[Math.floor(Math.random() * empty.length)]
  grid.value[cell.y][cell.x] = Math.random() < 0.9 ? 2 : 4
  newTiles.value = [{ x: cell.x, y: cell.y }]
  return true
}

function extractLine(g: Grid, dir: Direction, index: number): number[] {
  const line: number[] = []
  for (let i = 0; i < SIZE; i++) {
    switch (dir) {
      case 'left': line.push(g[index][i]); break
      case 'right': line.push(g[index][SIZE - 1 - i]); break
      case 'up': line.push(g[i][index]); break
      case 'down': line.push(g[SIZE - 1 - i][index]); break
    }
  }
  return line
}

function placeLine(g: Grid, dir: Direction, index: number, line: number[]) {
  for (let i = 0; i < SIZE; i++) {
    switch (dir) {
      case 'left': g[index][i] = line[i]; break
      case 'right': g[index][SIZE - 1 - i] = line[i]; break
      case 'up': g[i][index] = line[i]; break
      case 'down': g[SIZE - 1 - i][index] = line[i]; break
    }
  }
}

function slideAndMerge(line: number[]): { line: number[]; merged: number } {
  // 移除空格
  const filtered = line.filter(v => v !== 0)
  const result: number[] = []
  let merged = 0
  let i = 0

  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2
      result.push(val)
      merged += val
      i += 2
    } else {
      result.push(filtered[i])
      i++
    }
  }

  // 填充空格
  while (result.length < SIZE) {
    result.push(0)
  }

  return { line: result, merged }
}

function gridsEqual(a: Grid, b: Grid): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (a[y][x] !== b[y][x]) return false
    }
  }
  return true
}

function canMove(g: Grid): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x] === 0) return true
      if (x + 1 < SIZE && g[y][x] === g[y][x + 1]) return true
      if (y + 1 < SIZE && g[y][x] === g[y + 1][x]) return true
    }
  }
  return false
}

function handleMove(dir: Direction) {
  if (winDialog.value || gameOverDialog.value) return

  const prevGrid = cloneGrid(grid.value)
  const prevScore = score.value
  let totalMerged = 0

  for (let i = 0; i < SIZE; i++) {
    const line = extractLine(grid.value, dir, i)
    const { line: newLine, merged } = slideAndMerge(line)
    placeLine(grid.value, dir, i, newLine)
    totalMerged += merged
  }

  if (gridsEqual(prevGrid, grid.value)) return

  // 保存撤销历史
  history.value.push({ grid: prevGrid, score: prevScore })
  if (history.value.length > 20) history.value.shift()

  score.value += totalMerged
  if (totalMerged > 0) sound.merge(totalMerged)
  spawnTile()

  // 检查是否达到 2048
  if (!won.value) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid.value[y][x] === 2048) {
          won.value = true
          winDialog.value = true
          sound.win()
          gameStore.addScore('2048', score.value)
          return
        }
      }
    }
  }

  // 检查游戏结束
  if (!canMove(grid.value)) {
    gameStore.addScore('2048', score.value)
    sound.gameOver()
    gameOverDialog.value = true
  }
}

function move(dir: Direction) {
  handleMove(dir)
}

function undo() {
  if (history.value.length === 0 || winDialog.value || gameOverDialog.value) return
  const prev = history.value.pop()!
  grid.value = prev.grid
  score.value = prev.score
  newTiles.value = []
}

function restart() {
  grid.value = createEmptyGrid()
  score.value = 0
  won.value = false
  winDialog.value = false
  gameOverDialog.value = false
  history.value = []
  newTiles.value = []
  spawnTile()
  spawnTile()
}

function isAnimating(x: number, y: number): boolean {
  return newTiles.value.some(t => t.x === x && t.y === y)
}

restart()
</script>

<style scoped>
.game-board {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 12px;
  padding: 10px;
  display: inline-block;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.08);
  width: 100%;
  max-width: 380px;
  box-sizing: border-box;
}

.board-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.board-row:last-child {
  margin-bottom: 0;
}

.board-cell {
  flex: 1;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.5em;
  transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
}

/* 方块颜色 — 赛博朋克霓虹渐变 */
.board-cell.tile-2 {
  background: rgba(0, 255, 255, 0.12);
  color: #00FFFF;
  box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.1);
}

.board-cell.tile-4 {
  background: rgba(0, 255, 255, 0.2);
  color: #00FFFF;
  box-shadow: inset 0 0 15px rgba(0, 255, 255, 0.15);
}

.board-cell.tile-8 {
  background: rgba(5, 255, 161, 0.15);
  color: #05FFA1;
  box-shadow: inset 0 0 15px rgba(5, 255, 161, 0.15);
}

.board-cell.tile-16 {
  background: rgba(5, 255, 161, 0.25);
  color: #05FFA1;
  box-shadow: 0 0 10px rgba(5, 255, 161, 0.2);
}

.board-cell.tile-32 {
  background: rgba(255, 215, 0, 0.15);
  color: #FFD700;
  box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.1);
}

.board-cell.tile-64 {
  background: rgba(255, 215, 0, 0.25);
  color: #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.25);
}

.board-cell.tile-128 {
  background: rgba(255, 0, 110, 0.15);
  color: #FF006E;
  box-shadow: inset 0 0 15px rgba(255, 0, 110, 0.15);
  font-size: 1.3em;
}

.board-cell.tile-256 {
  background: rgba(255, 0, 110, 0.25);
  color: #FF006E;
  box-shadow: 0 0 15px rgba(255, 0, 110, 0.25);
  font-size: 1.3em;
}

.board-cell.tile-512 {
  background: rgba(185, 103, 255, 0.2);
  color: #B967FF;
  box-shadow: 0 0 20px rgba(185, 103, 255, 0.2);
  font-size: 1.3em;
}

.board-cell.tile-1024 {
  background: rgba(185, 103, 255, 0.3);
  color: #B967FF;
  box-shadow: 0 0 25px rgba(185, 103, 255, 0.3);
  font-size: 1.1em;
}

.board-cell.tile-2048 {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 0, 110, 0.3));
  color: #FFD700;
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.4), 0 0 20px rgba(255, 0, 110, 0.2);
  font-size: 1.1em;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.board-cell.tile-4096,
.board-cell.tile-8192,
.board-cell.tile-16384,
.board-cell.tile-32768,
.board-cell.tile-65536,
.board-cell.tile-131072 {
  background: linear-gradient(135deg, rgba(255, 0, 110, 0.35), rgba(185, 103, 255, 0.35));
  color: #fff;
  box-shadow: 0 0 30px rgba(255, 0, 110, 0.3);
  font-size: 1em;
}

/* 新生成方块动画 */
.tile-pop {
  animation: pop 0.15s ease-out;
}

@keyframes pop {
  0% { transform: scale(0); }
  100% { transform: scale(1); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.3), 0 0 15px rgba(255, 0, 110, 0.15); }
  50% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.5), 0 0 25px rgba(255, 0, 110, 0.3); }
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
    padding: 6px;
  }

  .board-row {
    gap: 5px;
    margin-bottom: 5px;
  }

  .board-cell {
    font-size: 1.1em;
    border-radius: 6px;
  }

  .board-cell.tile-128,
  .board-cell.tile-256,
  .board-cell.tile-512 {
    font-size: 1em;
  }

  .board-cell.tile-1024,
  .board-cell.tile-2048,
  .board-cell.tile-4096,
  .board-cell.tile-8192,
  .board-cell.tile-16384,
  .board-cell.tile-32768,
  .board-cell.tile-65536,
  .board-cell.tile-131072 {
    font-size: 0.85em;
  }
}
</style>
