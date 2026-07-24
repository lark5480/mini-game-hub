<template>
  <GameLayout
    title="贪吃蛇"
    accentColor="#B967FF"
    entrance="snake"
    gradientEnd="#FF006E"
    :hints="['空格/Enter 开始', '方向键/WASD 移动', 'P/Esc 暂停']"
    :infoItems="[{ label: '分数', value: score }]"
    :confirmRestart="score > 0"
    tutorial="控制蛇吃食物变长，别撞墙或咬到自己！"
    @back="handleBack"
    @restart="startGame"
  >
    <div class="game-board" ref="boardEl">
      <div v-for="(row, y) in grid" :key="y" class="game-row">
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="game-cell"
          :class="{ snake: cell === 1, head: cell === 3, shake: cell === 3 && blocked, food: cell === 2 }"
        ><span v-if="cell === 3" class="head-eyes" :class="'dir-' + direction"></span></div>
      </div>
      <ScoreFloat :popups="popups" />
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
          <template v-else>
            <button v-if="!paused && !showResume" @click="togglePause" class="extra-btn">暂停</button>
            <button v-else-if="paused && !showResume" @click="togglePause" class="extra-btn">继续</button>
            <button @click="startGame" class="extra-btn">重新开始</button>
          </template>
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
    <PauseOverlay :visible="paused" @resume="togglePause" />
    <ResumePrompt :visible="showResume" @continue="continueGame" @new-game="newGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import { useGameSave } from '@/composables/useGameSave'
import { useAutoSave } from '@/composables/useAutoSave'
import { useSwipe } from '@/composables/useSwipe'
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
const blocked = ref(false)
const showResume = ref(false)

// 存档
const save = useGameSave('snake')
const { scheduleSave, clearSave } = useAutoSave('snake', () => ({
  snake: snake.value,
  food: food.value,
  direction: direction.value,
  nextDir: nextDir.value,
  score: score.value,
  grid: grid.value,
  isPlaying: isPlaying.value
}), { beforeSave: () => isPlaying.value && !gameOver.value })

watch([snake, food, direction, nextDir, score, isPlaying, grid], scheduleSave, { deep: true })
onMounted(() => {
  const data = save.loadGame()
  if (data && Array.isArray(data.snake) && data.food && typeof data.score === 'number' && !!data.isPlaying) {
    snake.value = data.snake as { x: number; y: number }[]
    food.value = data.food as { x: number; y: number }
    direction.value = data.direction as 'up' | 'down' | 'left' | 'right'
    nextDir.value = data.nextDir as 'up' | 'down' | 'left' | 'right'
    score.value = data.score
    if (Array.isArray(data.grid)) grid.value = data.grid as number[][]
    gameOver.value = false
    isPlaying.value = true
    showResume.value = true
  }
})
const gameLoop = useGameLoop({
  mode: 'interval',
  intervalMs: 150,
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

// 棋盘 DOM ref（用于绑定滑动手势 + 浮动分数定位）
const boardEl = ref<HTMLElement | null>(null)
const isPlayingActive = computed(() => isPlaying.value && !gameOver.value && !paused.value)

useSwipe({
  el: () => boardEl.value,
  active: () => isPlayingActive.value,
  onSwipe: (dir) => changeDir(dir)
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
      handler: () => { if (isPlaying.value && !gameOver.value && !showResume.value) changeDir('up') }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => { if (isPlaying.value && !gameOver.value && !showResume.value) changeDir('down') }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (isPlaying.value && !gameOver.value && !showResume.value) changeDir('left') }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (isPlaying.value && !gameOver.value && !showResume.value) changeDir('right') }
    },
    {
      key: ['p', 'P', 'Escape'],
      handler: () => togglePause()
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
  // 原地清零，避免每 tick 重新分配整个网格
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      grid.value[y][x] = 0
    }
  }
  snake.value.forEach((s, i) => {
    if (s.y >= 0 && s.y < GRID_HEIGHT && s.x >= 0 && s.x < GRID_WIDTH) {
      grid.value[s.y][s.x] = i === 0 ? 3 : 1
    }
  })
  grid.value[food.value.y][food.value.x] = 2
}

function step() {
  if (paused.value) return
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
    score.value += 10
    haptics.pulse()
    popScoreAt(head)
    spawnFood()
    sound.eat()
  } else {
    snake.value.pop()
  }
  render()
}

function popScoreAt(head: { x: number; y: number }) {
  const el = boardEl.value
  if (!el) return
  const cells = el.querySelectorAll('.game-cell')
  const cellEl = cells[head.y * GRID_WIDTH + head.x] as HTMLElement | undefined
  if (!cellEl) return
  const boardRect = el.getBoundingClientRect()
  const r = cellEl.getBoundingClientRect()
  pop('+10', r.left + r.width / 2 - boardRect.left, r.top + r.height / 2 - boardRect.top)
}

function changeDir(dir: 'up'|'down'|'left'|'right') {
  const opposites: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' }
  if (opposites[dir] !== direction.value) {
    nextDir.value = dir
  } else if (isPlaying.value && !gameOver.value) {
    // 反向（掉头）无效：给蛇头一个轻微抖动反馈，避免“点了没反应”
    blocked.value = true
    setTimeout(() => { blocked.value = false }, 220)
  }
}

function startGame() {
  gameLoop.stop()
  showLeaderboard.value = false
  initGrid(); initSnake(); spawnFood(); render()
  score.value = 0; gameOver.value = false; isPlaying.value = true
  direction.value = 'right'; nextDir.value = 'right'
  clearSave()
  gameLoop.start()
}

function endGame() {
  isPlaying.value = false; gameOver.value = true
  gameLoop.stop()
  sound.gameOver()
  lastScore.value = score.value
  gameStore.addScore('snake', score.value)
  if (score.value >= 200) {
    if (achievements.unlock('snake_king')) {
      toast.show('成就解锁：蛇王', '🐍')
    }
  }
}

function openLeaderboard() {
  gameOver.value = false
  showLeaderboard.value = true
  clearSave()
}

function handleBack() {
  gameLoop.stop()
  router.push('/')
}

initGrid(); render()
</script>

<style scoped>
.game-board {
  position: relative;
  background: rgba(0,0,0,0.5);
  border: 2px solid rgba(185,103,255,0.5);
  border-radius: 8px;
  padding: 4px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;
  box-shadow: 0 0 40px rgba(185,103,255,0.25);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.game-row { display: flex; }

.game-cell {
  width: calc((100% - 1px) / 20);
  aspect-ratio: 1;
  border: 1px solid rgba(255,255,255,0.03);
  box-sizing: border-box;
  position: relative;
}

.game-cell.snake {
  background: linear-gradient(135deg, #B967FF, #818CF8);
  border-radius: 4px;
  box-shadow: 0 0 8px rgba(185,103,255,0.6);
}

.game-cell.head {
  background: linear-gradient(135deg, #3DF5FF, #00BFFF);
  border-radius: 6px;
  box-shadow: 0 0 12px rgba(61,245,255,0.9);
  z-index: 2;
}

/* 蛇头眼睛：随行进方向旋转，明确指示朝向 */
.head-eyes {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10%;
  padding-right: 16%;
  transform-origin: center;
}

.head-eyes.dir-up { transform: rotate(-90deg); }
.head-eyes.dir-down { transform: rotate(90deg); }
.head-eyes.dir-left { transform: rotate(180deg); }
.head-eyes.dir-right { transform: rotate(0deg); }

.head-eyes::before,
.head-eyes::after {
  content: '';
  width: 26%;
  height: 26%;
  background: #0D0D1A;
  border-radius: 50%;
}

/* 反向（掉头）无效时的蛇头抖动反馈 */
.game-cell.shake {
  animation: headShake 0.22s ease;
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
