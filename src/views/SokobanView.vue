<template>
  <GameLayout
    title="推箱子"
    accentColor="#00FFFF"
    gradientEnd="#FF006E"
    :hints="['方向键/WASD 移动', 'R 重置当前关', '重玩从第1关开始']"
    :infoItems="[{ label: '关卡', value: levelIndex + 1 }, { label: '步数', value: steps }, { label: '总分', value: totalScore }]"
    @back="router.push('/')"
  >
    <div class="game-board">
      <div v-for="(row, y) in board" :key="y" class="game-row">
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="game-cell"
          :class="getCellClass(cell)"
        >
          <span v-if="cell === 1" class="player">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2"/></svg>
          </span>
          <span v-else-if="cell === 2" class="box">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </span>
          <span v-else-if="cell === 3" class="target">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </span>
          <span v-else-if="cell === 4" class="box-done">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
          </span>
          <span v-else-if="cell === 5" class="wall-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </span>
        </div>
      </div>
    </div>
    <LeaderboardStrip game="sokoban" />
    <template #controls>
      <DirectionPad
        @up="move(0, -1)"
        @down="move(0, 1)"
        @left="move(-1, 0)"
        @right="move(1, 0)"
      >
        <template #extra>
          <button @click="submitScore" class="extra-btn">提交分数</button>
          <button @click="resetLevel" class="extra-btn">重置</button>
          <button @click="nextLevel" class="extra-btn">下一关</button>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="winDialog"
      accentColor="#00FFFF"
      icon="success"
      :title="gameComplete ? '全部通关！' : '恭喜过关！'"
      :message="gameComplete ? '总分: ' + totalScore : '用了 ' + steps + ' 步'"
      :actionText="gameComplete ? '提交分数' : '下一关'"
      @action="handleDialogAction"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="sokoban"
      gameName="推箱子"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="restartGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useSound } from '@/composables/useSound'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import DirectionPad from '@/components/DirectionPad.vue'

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()

const showLeaderboard = ref(false)
const lastScore = ref(0)

// 编码：0=空地, 1=玩家, 2=箱子, 3=目标点, 4=箱子在目标上, 5=墙壁
const levels = [
  // 关卡 1 — 入门：1 箱 1 目标
  [
    [5,5,5,5,5,5],
    [5,0,0,0,0,5],
    [5,0,0,2,0,5],
    [5,0,1,0,0,5],
    [5,0,0,3,0,5],
    [5,5,5,5,5,5]
  ],
  // 关卡 2 — 基础：2 箱 2 目标
  [
    [5,5,5,5,5,5,5],
    [5,0,0,0,0,0,5],
    [5,0,2,0,1,0,5],
    [5,0,0,0,0,0,5],
    [5,0,0,2,0,0,5],
    [5,0,0,3,3,0,5],
    [5,5,5,5,5,5,5]
  ],
  // 关卡 3 — 初级：3 箱 3 目标
  [
    [5,5,5,5,5,5,5],
    [5,0,1,0,0,0,5],
    [5,0,2,0,2,0,5],
    [5,0,0,0,0,0,5],
    [5,0,2,0,0,0,5],
    [5,3,3,3,0,0,5],
    [5,5,5,5,5,5,5]
  ],
  // 关卡 4 — 中级：3 箱 目标分散
  [
    [5,5,5,5,5,5,5,5],
    [5,0,0,0,0,0,0,5],
    [5,0,2,0,2,0,3,5],
    [5,0,0,1,0,0,0,5],
    [5,0,2,0,0,0,3,5],
    [5,0,0,0,0,0,3,5],
    [5,5,5,5,5,5,5,5]
  ],
  // 关卡 5 — 进阶：4 箱 4 目标
  [
    [5,5,5,5,5,5,5,5],
    [5,3,0,0,0,0,3,5],
    [5,0,0,0,0,0,0,5],
    [5,0,0,2,2,0,0,5],
    [5,0,0,1,0,0,0,5],
    [5,0,0,2,2,0,0,5],
    [5,3,0,0,0,0,3,5],
    [5,5,5,5,5,5,5,5]
  ],
  // 关卡 6 — 挑战：3 箱 3 目标 有隔墙
  [
    [5,5,5,5,5,5,5,5],
    [5,3,0,0,5,0,3,5],
    [5,0,2,0,5,0,0,5],
    [5,0,0,0,0,0,0,5],
    [5,0,0,0,5,0,0,5],
    [5,0,2,0,5,0,2,5],
    [5,3,0,1,0,0,0,5],
    [5,5,5,5,5,5,5,5]
  ],
  // 关卡 7 — 4 箱 4 目标
  [
    [5,5,5,5,5,5,5,5],
    [5,0,0,0,0,0,0,5],
    [5,0,3,0,0,3,0,5],
    [5,0,0,0,0,0,0,5],
    [5,0,0,0,1,0,0,5],
    [5,0,0,0,0,0,0,5],
    [5,0,2,0,0,2,0,5],
    [5,0,0,2,2,0,0,5],
    [5,0,3,0,0,3,0,5],
    [5,5,5,5,5,5,5,5]
  ],
  // 关卡 8 — 6 箱 6 目标 隔间
  [
    [5,5,5,5,5,5,5,5],
    [5,1,0,0,5,0,3,5],
    [5,0,2,0,5,0,0,5],
    [5,0,0,2,0,0,3,5],
    [5,3,0,0,5,0,0,5],
    [5,0,2,0,3,0,2,5],
    [5,0,0,5,0,2,0,5],
    [5,0,0,5,3,0,0,5],
    [5,3,0,0,5,0,2,5],
    [5,5,5,5,5,5,5,5]
  ],
  // 关卡 9 — 5 箱 5 目标
  [
    [5,5,5,5,5,5,5,5,5],
    [5,3,0,0,0,0,0,3,5],
    [5,0,0,2,0,2,0,0,5],
    [5,0,0,0,0,0,0,0,5],
    [5,0,2,0,1,0,2,0,5],
    [5,0,0,0,0,0,0,0,5],
    [5,0,0,2,0,0,0,0,5],
    [5,3,0,0,3,0,0,3,5],
    [5,5,5,5,5,5,5,5,5]
  ],
  // 关卡 10 — 5 箱 5 目标
  [
    [5,5,5,5,5,5,5,5,5],
    [5,1,0,0,5,0,0,3,5],
    [5,0,2,0,0,0,2,0,5],
    [5,0,2,0,5,0,0,0,5],
    [5,3,0,0,0,0,0,3,5],
    [5,0,0,5,0,0,2,0,5],
    [5,0,2,0,0,5,0,0,5],
    [5,3,0,0,0,0,0,3,5],
    [5,5,5,5,5,5,5,5,5]
  ]
]

const levelIndex = ref(0)
const steps = ref(0)
const board = ref<number[][]>([])
const winDialog = ref(false)
const totalScore = ref(0)
const gameComplete = ref(false)

useGameKeyboard({
  bindings: [
    {
      key: ['ArrowUp', 'w', 'W'],
      handler: () => { if (!winDialog.value) move(0, -1) }
    },
    {
      key: ['ArrowDown', 's', 'S'],
      handler: () => { if (!winDialog.value) move(0, 1) }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (!winDialog.value) move(-1, 0) }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (!winDialog.value) move(1, 0) }
    },
    {
      key: ['r', 'R'],
      handler: () => { if (!winDialog.value) resetLevel() }
    }
  ]
})

function initLevel() {
  board.value = JSON.parse(JSON.stringify(levels[levelIndex.value]))
  steps.value = 0
  winDialog.value = false
}

function getCellClass(cell: number): string {
  const classes: Record<number, string> = {
    0: 'empty', 1: 'player', 2: 'box', 3: 'target', 4: 'box-done', 5: 'wall'
  }
  return classes[cell] || 'empty'
}

function move(dx: number, dy: number) {
  const playerPos = findPlayer()
  if (!playerPos) return

  const nx = playerPos.x + dx
  const ny = playerPos.y + dy

  if (!isValid(nx, ny)) return

  const target = board.value[ny][nx]

  // 墙壁不可进入
  if (target === 5) return

  if (target === 0 || target === 3) {
    board.value[ny][nx] = 1
    board.value[playerPos.y][playerPos.x] = isTarget(playerPos.x, playerPos.y) ? 3 : 0
    steps.value++
    sound.move()
  } else if (target === 2 || target === 4) {
    const nnx = nx + dx
    const nny = ny + dy
    if (!isValid(nnx, nny)) return

    const behind = board.value[nny][nnx]
    // 不能推箱进墙或进另一个箱子
    if (behind === 5 || behind === 2 || behind === 4) return

    if (behind === 0 || behind === 3) {
      board.value[nny][nnx] = behind === 3 ? 4 : 2
      board.value[ny][nx] = 1
      board.value[playerPos.y][playerPos.x] = isTarget(playerPos.x, playerPos.y) ? 3 : 0
      steps.value++
      sound.push()
      if (behind === 3) sound.place()
    }
  }

  checkWin()
}

function findPlayer(): { x: number; y: number } | null {
  for (let y = 0; y < board.value.length; y++) {
    for (let x = 0; x < board.value[y].length; x++) {
      if (board.value[y][x] === 1) return { x, y }
    }
  }
  return null
}

function isValid(x: number, y: number): boolean {
  return y >= 0 && y < board.value.length && x >= 0 && x < board.value[y].length
}

function isTarget(x: number, y: number): boolean {
  const original = levels[levelIndex.value][y]?.[x]
  return original === 3
}

function checkWin() {
  for (let y = 0; y < board.value.length; y++) {
    for (let x = 0; x < board.value[y].length; x++) {
      if (levels[levelIndex.value][y][x] === 3 && board.value[y][x] !== 2 && board.value[y][x] !== 4) {
        return
      }
    }
  }
  winDialog.value = true
  sound.win()
  const levelScore = Math.max(0, 100 - steps.value)
  lastScore.value = levelScore
  totalScore.value += levelScore
  gameStore.addScore('sokoban', totalScore.value)
}

function resetLevel() { initLevel() }

function nextLevel() {
  showLeaderboard.value = false
  winDialog.value = false
  if (levelIndex.value < levels.length - 1) {
    levelIndex.value++
    initLevel()
  } else {
    gameComplete.value = true
  }
}

function submitScore() {
  lastScore.value = totalScore.value
  winDialog.value = false
  gameComplete.value = false
  showLeaderboard.value = true
}

function handleDialogAction() {
  if (gameComplete.value) {
    submitScore()
  } else {
    nextLevel()
  }
}

function restartGame() {
  levelIndex.value = 0
  totalScore.value = 0
  gameComplete.value = false
  showLeaderboard.value = false
  initLevel()
}

initLevel()
</script>

<style scoped>
.game-board {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(0,255,255,0.2);
  border-radius: 12px;
  padding: 15px;
  display: inline-block;
  box-shadow: 0 0 30px rgba(0,255,255,0.1);
}

.game-row { display: flex; }

.game-cell {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--game-cell-border);
}

.game-cell.wall { background: rgba(93,52,208,0.4); }

.player, .box, .target, .box-done, .wall-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.player svg { color: #00FFFF; filter: drop-shadow(0 0 8px #00FFFF); }
.box svg { color: #FF006E; }
.target svg { color: #B967FF; }
.box-done svg { color: #05FFA1; filter: drop-shadow(0 0 8px #05FFA1); }
.wall-icon svg { color: #5D34D0; }

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

.extra-btn:hover {
  background: rgba(0,255,255,0.1);
  border-color: var(--game-accent);
  box-shadow: 0 0 15px rgba(0,255,255,0.2);
}
</style>
