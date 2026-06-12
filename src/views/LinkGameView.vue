<template>
  <GameLayout
    title="连连看"
    accentColor="#FF006E"
    gradientEnd="#B967FF"
    :hints="['方向键/WASD 移动', 'Enter/空格 确认', 'R 重置']"
    :infoItems="[{ label: '分数', value: score }, { label: '剩余', value: remaining }]"
    @back="router.push('/')"
  >
    <div class="game-board">
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
    </div>
    <template #controls>
      <button @click="shuffle" class="reset-btn">重置</button>
    </template>
    <GameDialog
      v-model:visible="winDialog"
      accentColor="#FF006E"
      icon="success"
      title="全部消除！"
      :message="'得分: ' + score"
      actionText="再来一局"
      @action="initGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'

const router = useRouter()
const gameStore = useGameStore()

interface Cell { type: number; matched: boolean }

const ROWS = 6, COLS = 8, TYPES = 12
const board = ref<Cell[][]>([])
const selected = ref<{ x: number; y: number } | null>(null)
const cursor = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const score = ref(0)
const winDialog = ref(false)

const remaining = computed(() => board.value.flat().filter(c => !c.matched).length)

const icons = ['🍎','🍊','🍋','🍇','🍓','🍑','🥝','🍒','🥭','🍍','🥥','🫐']

useGameKeyboard({
  bindings: [
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => {
        if (winDialog.value) return
        cursor.value = { x: cursor.value.x, y: Math.max(0, cursor.value.y - 1) }
      }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => {
        if (winDialog.value) return
        cursor.value = { x: cursor.value.x, y: Math.min(ROWS - 1, cursor.value.y + 1) }
      }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => {
        if (winDialog.value) return
        cursor.value = { x: Math.max(0, cursor.value.x - 1), y: cursor.value.y }
      }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => {
        if (winDialog.value) return
        cursor.value = { x: Math.min(COLS - 1, cursor.value.x + 1), y: cursor.value.y }
      }
    },
    {
      key: ['Enter', ' '],
      handler: () => {
        if (winDialog.value) { initGame(); return }
        selectCell(cursor.value.x, cursor.value.y)
      }
    },
    {
      key: ['r', 'R'],
      handler: () => { if (!winDialog.value) shuffle() }
    }
  ]
})

function getIcon(type: number): string { return icons[type] || '❓' }

function initGame() {
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

/** 检查 (x1,y1) 到 (x2,y2) 是否能通过 ≤2 转弯路径连通 */
function canConnect(x1: number, y1: number, x2: number, y2: number): boolean {
  // 同一位置
  if (x1 === x2 && y1 === y2) return false

  // 0 转弯：直线连接
  if ((x1 === x2 || y1 === y2) && isLineEmpty(x1, y1, x2, y2)) return true

  // 1 转弯：通过一个拐点
  if (isEmpty(x1, y2) && isLineEmpty(x1, y1, x1, y2) && isLineEmpty(x1, y2, x2, y2)) return true
  if (isEmpty(x2, y1) && isLineEmpty(x1, y1, x2, y1) && isLineEmpty(x2, y1, x2, y2)) return true

  // 2 转弯：通过两个拐点 — 水平扫描线
  for (let x = -1; x <= COLS; x++) {
    if (isEmpty(x, y1) && isEmpty(x, y2) &&
        isLineEmpty(x1, y1, x, y1) && isLineEmpty(x, y1, x, y2) && isLineEmpty(x, y2, x2, y2)) {
      return true
    }
  }
  // 2 转弯：垂直扫描线
  for (let y = -1; y <= ROWS; y++) {
    if (isEmpty(x1, y) && isEmpty(x2, y) &&
        isLineEmpty(x1, y1, x1, y) && isLineEmpty(x1, y, x2, y) && isLineEmpty(x2, y, x2, y2)) {
      return true
    }
  }

  return false
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
  const cell = board.value[y][x]
  if (cell.matched) return

  if (!selected.value) { selected.value = { x, y }; return }

  const sel = selected.value
  if (sel.x === x && sel.y === y) { selected.value = null; return }

  const selCell = board.value[sel.y][sel.x]
  if (selCell.type === cell.type && canConnect(sel.x, sel.y, x, y)) {
    cell.matched = true; selCell.matched = true
    score.value += 10; selected.value = null
    if (remaining.value === 0) {
      winDialog.value = true
      gameStore.addScore('link', score.value)
    } else if (!hasValidPair()) {
      // 死局自动洗牌
      shuffle()
    }
  } else {
    selected.value = { x, y }
  }
}

function shuffle() {
  const cells = board.value.flat().filter(c => !c.matched)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i].type, cells[j].type] = [cells[j].type, cells[i].type]
  }
  selected.value = null
}

initGame()
</script>

<style scoped>
.game-board {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,0,110,0.2);
  border-radius: 12px;
  padding: 12px;
  display: inline-block;
  box-shadow: 0 0 30px rgba(255,0,110,0.1);
}

.game-row { display: flex; }

.game-cell {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26,26,46,0.9);
  border: 1px solid var(--game-cell-border);
  border-radius: 8px;
  margin: 4px;
  cursor: pointer;
  transition: all 0.2s;
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
