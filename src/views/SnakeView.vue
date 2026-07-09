<template>
  <GameLayout
    title="贪吃蛇"
    accentColor="#B967FF"
    gradientEnd="#FF006E"
    :hints="['空格/Enter 开始', '方向键/WASD 移动']"
    :infoItems="[{ label: '分数', value: score }]"
    @back="handleBack"
  >
    <div class="game-board">
      <div v-for="(row, y) in grid" :key="y" class="game-row">
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="game-cell"
          :class="{ snake: cell === 1, food: cell === 2 }"
        ></div>
      </div>
    </div>
    <LeaderboardStrip game="snake" />
    <template #controls>
      <DirectionPad
        @up="changeDir('up')"
        @down="changeDir('down')"
        @left="changeDir('left')"
        @right="changeDir('right')"
      >
        <template #extra>
          <button v-if="!isPlaying" @click="startGame" class="start-btn">开始</button>
          <button v-else @click="startGame" class="extra-btn">重新开始</button>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="gameOver"
      accentColor="#B967FF"
      icon="fail"
      title="游戏结束"
      :message="'得分: ' + score"
      actionText="提交分数"
      @action="openLeaderboard"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="snake"
      gameName="贪吃蛇"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="startGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import DirectionPad from '@/components/DirectionPad.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()

const showLeaderboard = ref(false)

const GRID_WIDTH = 20, GRID_HEIGHT = 15
const grid = ref<number[][]>([])
const snake = ref<{ x: number; y: number }[]>([])
const food = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const direction = ref<'up'|'down'|'left'|'right'>('right')
const nextDir = ref<'up'|'down'|'left'|'right'>('right')
const score = ref(0)
const isPlaying = ref(false)
const gameOver = ref(false)
const lastScore = ref(0)

const gameLoop = useGameLoop({
  mode: 'interval',
  intervalMs: 150,
  onUpdate: () => step()
})

useGameKeyboard({
  active: true,
  bindings: [
    {
      key: ['Enter', ' '],
      handler: () => {
        if (!isPlaying.value || gameOver.value) startGame()
      }
    },
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => { if (isPlaying.value && !gameOver.value) changeDir('up') }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => { if (isPlaying.value && !gameOver.value) changeDir('down') }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (isPlaying.value && !gameOver.value) changeDir('left') }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (isPlaying.value && !gameOver.value) changeDir('right') }
    }
  ]
})

function initGrid() {
  const g: number[][] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: number[] = []
    for (let x = 0; x < GRID_WIDTH; x++) row.push(0)
    g.push(row)
  }
  grid.value = g
}

function initSnake() {
  snake.value = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }]
}

function spawnFood() {
  let valid = false
  while (!valid) {
    food.value = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT)
    }
    valid = !snake.value.some(s => s.x === food.value.x && s.y === food.value.y)
  }
}

function render() {
  initGrid()
  snake.value.forEach(s => {
    if (s.y >= 0 && s.y < GRID_HEIGHT && s.x >= 0 && s.x < GRID_WIDTH) {
      grid.value[s.y][s.x] = 1
    }
  })
  grid.value[food.value.y][food.value.x] = 2
}

function step() {
  direction.value = nextDir.value
  const head = { ...snake.value[0] }

  switch (direction.value) {
    case 'up': head.y--; break
    case 'down': head.y++; break
    case 'left': head.x--; break
    case 'right': head.x++; break
  }

  if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT ||
      snake.value.some(s => s.x === head.x && s.y === head.y)) {
    sound.crash()
    endGame(); return
  }

  snake.value.unshift(head)
  if (head.x === food.value.x && head.y === food.value.y) {
    score.value += 10; spawnFood(); sound.eat()
  } else {
    snake.value.pop()
  }
  render()
}

function changeDir(dir: 'up'|'down'|'left'|'right') {
  const opposites: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' }
  if (opposites[dir] !== direction.value) nextDir.value = dir
}

function startGame() {
  gameLoop.stop()
  showLeaderboard.value = false
  initGrid(); initSnake(); spawnFood(); render()
  score.value = 0; gameOver.value = false; isPlaying.value = true
  direction.value = 'right'; nextDir.value = 'right'
  gameLoop.start()
}

function endGame() {
  isPlaying.value = false; gameOver.value = true
  gameLoop.stop()
  sound.gameOver()
  lastScore.value = score.value
  gameStore.addScore('snake', score.value)
}

function openLeaderboard() {
  gameOver.value = false
  showLeaderboard.value = true
}

function handleBack() {
  gameLoop.stop()
  router.push('/')
}

initGrid(); render()
</script>

<style scoped>
.game-board {
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(185,103,255,0.2);
  border-radius: 8px;
  padding: 5px;
  display: inline-block;
  box-shadow: 0 0 30px rgba(185,103,255,0.1);
}

.game-row { display: flex; }

.game-cell {
  width: 25px;
  height: 25px;
  border: 1px solid rgba(255,255,255,0.03);
}

.game-cell.snake {
  background: linear-gradient(135deg, #B967FF, #818CF8);
  border-radius: 4px;
  box-shadow: 0 0 8px rgba(185,103,255,0.6);
}

.game-cell.food {
  background: radial-gradient(circle, #FF006E 0%, #c0392b 100%);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(255,0,110,0.6);
}

.start-btn {
  padding: 10px 35px;
  font-size: 1.2em;
  font-weight: 600;
  background: linear-gradient(135deg, #B967FF, #818CF8);
  color: #fff;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(185,103,255,0.4);
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
  background: rgba(185,103,255,0.15);
  border-color: #B967FF;
}
</style>
