<template>
  <GameLayout
    title="俄罗斯方块"
    accentColor="#00FFFF"
    gradientEnd="#FF006E"
    :hints="['Enter 开始', '方向键移动 上旋转 下软降 空格硬降']"
    :infoItems="[{ label: '分数', value: score }, { label: '行数', value: lines }]"
    @back="handleBack"
  >
    <div class="game-main">
      <div class="game-board">
        <div v-for="(row, y) in displayGrid" :key="y" class="game-row">
          <div
            v-for="(cell, x) in row"
            :key="x"
            class="game-cell"
            :class="{ filled: cell.color }"
            :style="cell.color ? { background: cell.color, boxShadow: `0 0 6px ${cell.color}80` } : {}"
          ></div>
        </div>
      </div>
      <div class="side-panel">
        <div class="next-piece">
          <div class="next-label">下一个</div>
          <div class="next-grid">
            <div v-for="(row, y) in nextGrid" :key="y" class="next-row">
              <div
                v-for="(cell, x) in row"
                :key="x"
                class="next-cell"
                :class="{ filled: cell }"
                :style="cell ? { background: cell } : {}"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #controls>
      <DirectionPad
        @up="switchShape"
        @down="softDrop"
        @left="move(-1)"
        @right="move(1)"
      >
        <template #extra>
          <button @click="drop" class="hard-drop-btn">硬降</button>
          <button v-if="!isPlaying" @click="startGame" class="start-btn">开始</button>
          <button v-else @click="startGame" class="extra-btn">重新开始</button>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="gameOver"
      accentColor="#00FFFF"
      icon="fail"
      title="游戏结束"
      :message="'得分: ' + score"
      actionText="再来一局"
      @action="startGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import DirectionPad from '@/components/DirectionPad.vue'

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()

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
        if (isPlaying.value && !gameOver.value) drop()
      }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (isPlaying.value && !gameOver.value) move(-1) }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (isPlaying.value && !gameOver.value) move(1) }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => { if (isPlaying.value && !gameOver.value) softDrop() }
    },
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => { if (isPlaying.value && !gameOver.value) switchShape() }
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
    lines.value += cleared
    const pts = [0, 100, 300, 500, 800]
    score.value += pts[cleared] || 800
  }
}

function step() {
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
  if (current.value && isPlaying.value && !collides(current.value.shape, current.value.x + dir, current.value.y)) {
    current.value.x += dir
    sound.move()
  }
}

function switchShape() {
  if (!current.value || !isPlaying.value) return
  const s = current.value.shape
  const rotated = s[0].map((_, i) => s.map(r => r[i]).reverse())
  if (!collides(rotated, current.value.x, current.value.y)) {
    current.value.shape = rotated
    sound.rotate()
  }
}

function softDrop() {
  if (current.value && isPlaying.value && !collides(current.value.shape, current.value.x, current.value.y + 1)) {
    current.value.y++
    score.value += 1
  }
}

function drop() {
  if (!current.value || !isPlaying.value) return
  while (!collides(current.value.shape, current.value.x, current.value.y + 1)) {
    current.value.y++
  }
  sound.drop()
}

function startGame() {
  gameLoop.stop()
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
  gameStore.addScore('tetris', score.value)
}

function handleBack() {
  gameLoop.stop()
  router.push('/')
}

initGrid()
</script>

<style scoped>
.game-main {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.game-board {
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(0,255,255,0.2);
  border-radius: 8px;
  padding: 5px;
  display: inline-block;
  box-shadow: 0 0 30px rgba(0,255,255,0.1);
}

.game-row { display: flex; }

.game-cell {
  width: 22px;
  height: 22px;
  border: 1px solid rgba(255,255,255,0.03);
}

.game-cell.filled {
  border-radius: 3px;
}

.side-panel { display: flex; flex-direction: column; justify-content: center; }

.next-piece {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(0,255,255,0.15);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.next-label { color: #818CF8; font-size: 0.85em; margin-bottom: 8px; }

.next-grid { display: inline-block; }

.next-row { display: flex; }

.next-cell {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(255,255,255,0.05);
}

.next-cell.filled { border-radius: 2px; }

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
