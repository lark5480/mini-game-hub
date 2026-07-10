<template>
  <GameLayout
    title="打地鼠"
    accentColor="#FF6B6B"
    gradientEnd="#FFD700"
    :hints="['点击地鼠得分', '别打空！']"
    :infoItems="[{ label: '分数', value: score }, { label: '时间', value: timeLeft + 's' }, { label: '连击', value: combo }]"
    @back="router.push('/')"
  >
    <div class="game-container">
      <div class="score-panel">
        <div class="score-display">{{ score }}</div>
        <div class="combo-display" v-if="combo > 1">
          <span class="combo-text">x{{ combo }}</span>
          <span class="combo-bonus">+{{ combo * 5 }}</span>
        </div>
      </div>
      
      <div class="mole-board" :style="{ '--grid-cols': gridCols, '--grid-rows': gridRows }">
        <div
          v-for="(hole, index) in holes"
          :key="index"
          class="mole-hole"
          @click="whack(index)"
        >
          <div class="hole">
            <div class="mole" :class="{ visible: hole.active, hit: hole.hit }">
              <div class="mole-body">
                <div class="mole-face">
                  <div class="mole-eyes">
                    <span class="eye left"></span>
                    <span class="eye right"></span>
                  </div>
                  <span class="mole-nose"></span>
                  <span class="mole-mouth"></span>
                </div>
              </div>
            </div>
            <div class="dirt"></div>
          </div>
        </div>
      </div>

      <div class="time-bar">
        <div class="time-fill" :style="{ width: (timeLeft / 30 * 100) + '%' }"></div>
      </div>
    </div>
    <LeaderboardStrip game="whackamole" />
    <template #controls>
      <div class="game-controls">
        <div class="difficulty-buttons">
          <button
            v-for="diff in difficulties"
            :key="diff.name"
            class="diff-btn"
            :class="{ active: difficulty === diff.name }"
            @click="setDifficulty(diff.name)"
          >
            {{ diff.label }}
          </button>
        </div>
        <button class="start-btn" @click="startGame" v-if="!gameStarted">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8v7a4 4 0 0 0 8 0V8"/>
          </svg>
          开始游戏
        </button>
        <button class="restart-btn" @click="restartGame" v-else>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          重新开始
        </button>
      </div>
    </template>

    <GameDialog
      v-model:visible="gameOverDialog"
      accentColor="#FF6B6B"
      icon="success"
      title="游戏结束！"
      :message="'最终得分: ' + score"
      actionText="提交分数"
      @action="openLeaderboard"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="whackamole"
      gameName="打地鼠"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="restartGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useSound } from '@/composables/useSound'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'

interface Hole {
  active: boolean
  hit: boolean
}

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()
const achievements = useAchievements()
const toast = useToast()

const difficulties = [
  { name: 'easy', label: '简单', gridCols: 3, gridRows: 3, interval: 1200, duration: 1000 },
  { name: 'normal', label: '普通', gridCols: 3, gridRows: 3, interval: 900, duration: 800 },
  { name: 'hard', label: '困难', gridCols: 4, gridRows: 3, interval: 700, duration: 600 }
]

const difficulty = ref('normal')
const score = ref(0)
const timeLeft = ref(30)
const combo = ref(0)
const gameStarted = ref(false)
const gameOverDialog = ref(false)
const showLeaderboard = ref(false)
const lastScore = ref(0)

const gridCols = ref(3)
const gridRows = ref(3)
const moleInterval = ref(900)
const moleDuration = ref(800)

const holes = ref<Hole[]>([])

let moleTimer: number | null = null
let countdownTimer: number | null = null
const pendingTimeouts: Set<number> = new Set()

function initHoles() {
  const total = gridCols.value * gridRows.value
  holes.value = Array.from({ length: total }, () => ({
    active: false,
    hit: false
  }))
}

function startGame() {
  showLeaderboard.value = false
  gameStarted.value = true
  score.value = 0
  timeLeft.value = 30
  combo.value = 0
  gameOverDialog.value = false

  updateDifficultySettings()
  initHoles()
  countdown()
  spawnMoles()
}

function restartGame() {
  stopAllTimers()
  startGame()
}

function setDifficulty(name: string) {
  if (gameStarted.value) return
  difficulty.value = name
  updateDifficultySettings()
  initHoles()
}

function updateDifficultySettings() {
  const diff = difficulties.find(d => d.name === difficulty.value)!
  gridCols.value = diff.gridCols
  gridRows.value = diff.gridRows
  moleInterval.value = diff.interval
  moleDuration.value = diff.duration
}

function countdown() {
  countdownTimer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      gameOver()
    }
  }, 1000)
}

function spawnMoles() {
  moleTimer = window.setInterval(() => {
    spawnMole()
  }, moleInterval.value)
}

function spawnMole() {
  const inactiveHoles = holes.value
    .map((hole, index) => ({ hole, index }))
    .filter(({ hole }) => !hole.active)
  
  if (inactiveHoles.length === 0) return
  
  const randomIndex = inactiveHoles[Math.floor(Math.random() * inactiveHoles.length)].index
  holes.value[randomIndex].active = true
  
  const timeoutId = window.setTimeout(() => {
    pendingTimeouts.delete(timeoutId)
    if (holes.value[randomIndex].active && !holes.value[randomIndex].hit) {
      holes.value[randomIndex].active = false
      combo.value = 0
    }
  }, moleDuration.value)
  pendingTimeouts.add(timeoutId)
}

function whack(index: number) {
  if (!gameStarted.value) return

  const hole = holes.value[index]

  if (hole.active && !hole.hit) {
    hole.hit = true
    combo.value++

    const baseScore = 10
    const comboBonus = (combo.value - 1) * 5
    score.value += baseScore + comboBonus
    sound.hit()

    const timeoutId = window.setTimeout(() => {
      pendingTimeouts.delete(timeoutId)
      hole.active = false
      hole.hit = false
    }, 200)
    pendingTimeouts.add(timeoutId)
  } else if (!hole.active) {
    combo.value = 0
    sound.miss()
  }
}

function gameOver() {
  stopAllTimers()
  gameStarted.value = false
  gameOverDialog.value = true
  sound.gameOver()
  lastScore.value = score.value
  gameStore.addScore('whackamole', score.value)
  if (score.value >= 300) {
    if (achievements.unlock('whack_master')) {
      toast.show('成就解锁：神速', '🔨')
    }
  }
}

function openLeaderboard() {
  gameOverDialog.value = false
  showLeaderboard.value = true
}

function stopAllTimers() {
  if (moleTimer) clearInterval(moleTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  moleTimer = null
  countdownTimer = null
  pendingTimeouts.forEach(id => clearTimeout(id))
  pendingTimeouts.clear()
}

onMounted(() => {
  updateDifficultySettings()
  initHoles()
})

onUnmounted(() => {
  stopAllTimers()
})
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.score-panel {
  text-align: center;
}

.score-display {
  font-size: 3.5em;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 20px rgba(255, 107, 107, 0.8);
}

.combo-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 5px;
  animation: comboPulse 0.3s ease;
}

@keyframes comboPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.combo-text {
  font-size: 1.5em;
  font-weight: bold;
  color: #FFD700;
}

.combo-bonus {
  font-size: 1em;
  color: #05FFA1;
}

.mole-board {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols), 1fr);
  grid-template-rows: repeat(var(--grid-rows), auto);
  gap: 15px;
  background: rgba(0,0,0,0.4);
  border: 2px solid rgba(255,107,107,0.3);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  box-sizing: border-box;
  box-shadow: 0 0 40px rgba(255,107,107,0.2);
}

.mole-hole {
  width: 100%;
  aspect-ratio: 1;
  max-width: 110px;
  cursor: pointer;
  position: relative;
  container-type: size;
}

.hole {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(180deg, #8B4513 0%, #5D3A1A 100%);
  box-shadow: inset 0 5px 15px rgba(0,0,0,0.5);
}

.mole {
  position: absolute;
  bottom: -86cqh;
  left: 50%;
  transform: translateX(-50%);
  width: 86cqw;
  height: 86cqh;
  transition: bottom 0.2s ease;
}

.mole.visible {
  bottom: -6cqh;
}

.mole.hit {
  animation: hitMole 0.2s ease;
}

@keyframes hitMole {
  0% { bottom: -6cqh; }
  50% { bottom: -28cqh; }
  100% { bottom: -86cqh; }
}

.mole-body {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #A0522D 0%, #6B4423 100%);
  border-radius: 50% 50% 45% 45%;
  position: relative;
  box-shadow: 0 3px 10px rgba(0,0,0,0.3);
}

.mole-face {
  position: absolute;
  top: 16cqh;
  left: 50%;
  transform: translateX(-50%);
}

.mole-eyes {
  display: flex;
  gap: 16cqw;
}

.eye {
  width: 16cqw;
  height: 16cqh;
  background: #000;
  border-radius: 50%;
  position: relative;
}

.eye::after {
  content: '';
  position: absolute;
  top: 18%;
  left: 22%;
  width: 35%;
  height: 35%;
  background: #fff;
  border-radius: 50%;
}

.mole-nose {
  display: block;
  width: 14cqw;
  height: 10cqh;
  background: #FF69B4;
  border-radius: 50%;
  margin: 8cqh auto 0;
}

.mole-mouth {
  display: block;
  width: 26cqw;
  height: 12cqh;
  border-bottom: 3px solid #000;
  border-radius: 0 0 10px 10px;
  margin: 4cqh auto 0;
}

.dirt {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 15%;
  background: linear-gradient(180deg, #5D3A1A 0%, #3D2817 100%);
  border-radius: 0 0 50% 50%;
}

.time-bar {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.time-fill {
  height: 100%;
  background: linear-gradient(90deg, #05FFA1, #FFD700, #FF6B6B);
  transition: width 1s linear;
  border-radius: 4px;
}

.game-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
}

.difficulty-buttons {
  display: flex;
  gap: 10px;
}

.diff-btn {
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.diff-btn:hover {
  border-color: var(--game-accent);
}

.diff-btn.active {
  background: rgba(255,107,107,0.3);
  border-color: #FF6B6B;
  color: #FF6B6B;
}

.start-btn, .restart-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #FF6B6B, #FF8E8E);
  border: none;
  color: #fff;
  padding: 14px 35px;
  border-radius: 15px;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover, .restart-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(255,107,107,0.4);
}

@media (max-width: 640px) {
  .mole-board {
    gap: 10px;
    padding: 14px;
  }

  .mole-hole {
    max-width: 96px;
  }
}
</style>