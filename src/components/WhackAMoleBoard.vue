<template>
  <div class="game-container">
    <div class="score-panel">
      <div class="score-display">{{ score }}</div>
      <div class="combo-display" v-if="combo > 1">
        <span class="combo-text">x{{ combo }}</span>
        <span class="combo-bonus">+{{ combo * 5 }}</span>
      </div>
    </div>

    <div ref="boardEl" class="mole-board" :style="{ '--grid-cols': gridCols, '--grid-rows': gridRows }">
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
      <ScoreFloat :popups="popups" />
    </div>

    <div class="time-bar">
      <div class="time-fill" :style="{ width: (timeLeft / 30 * 100) + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useScoreFloats } from '@/composables/useScoreFloats'
import ScoreFloat from '@/components/ScoreFloat.vue'

interface Hole {
  active: boolean
  hit: boolean
}

interface DifficultySpec {
  name: string
  gridCols: number
  gridRows: number
  interval: number
  duration: number
}

const DIFFICULTIES: DifficultySpec[] = [
  { name: 'easy', gridCols: 3, gridRows: 3, interval: 1200, duration: 1000 },
  { name: 'normal', gridCols: 3, gridRows: 3, interval: 900, duration: 800 },
  { name: 'hard', gridCols: 4, gridRows: 3, interval: 700, duration: 600 },
]

const props = defineProps<{
  difficulty: string
}>()

const emit = defineEmits<{
  (e: 'score', score: number): void
  (e: 'gameover', score: number): void
  (e: 'start'): void
}>()

const sound = useSound()
const haptics = useHaptics()
const { popups, pop } = useScoreFloats()
const boardEl = ref<HTMLElement | null>(null)

const score = ref(0)
const timeLeft = ref(30)
const combo = ref(0)
const gameStarted = ref(false)
const gridCols = ref(3)
const gridRows = ref(3)
const moleInterval = ref(900)
const moleDuration = ref(800)

const holes = ref<Hole[]>([])

let moleTimer: number | null = null
let countdownTimer: number | null = null
const pendingTimeouts: Set<number> = new Set()
const paused = ref(false)

function currentSpec(): DifficultySpec {
  return DIFFICULTIES.find(d => d.name === props.difficulty) ?? DIFFICULTIES[1]
}

function applyDifficulty() {
  const diff = currentSpec()
  gridCols.value = diff.gridCols
  gridRows.value = diff.gridRows
  moleInterval.value = diff.interval
  moleDuration.value = diff.duration
}

function initHoles() {
  const total = gridCols.value * gridRows.value
  holes.value = Array.from({ length: total }, () => ({ active: false, hit: false }))
}

function startGame() {
  stopAllTimers()
  paused.value = false
  gameStarted.value = true
  score.value = 0
  timeLeft.value = 30
  combo.value = 0

  applyDifficulty()
  initHoles()
  countdown()
  spawnMoles()

  emit('start')
}

function stopGame() {
  stopAllTimers()
  gameStarted.value = false
}

function pause() {
  if (!gameStarted.value || paused.value) return
  paused.value = true
  if (moleTimer) { clearInterval(moleTimer); moleTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  pendingTimeouts.forEach(id => clearTimeout(id))
  pendingTimeouts.clear()
}

function resume() {
  if (!paused.value) return
  paused.value = false
  countdown()
  spawnMoles()
}

function countdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) gameOver()
  }, 1000)
}

function spawnMoles() {
  if (moleTimer) clearInterval(moleTimer)
  moleTimer = window.setInterval(() => spawnMole(), moleInterval.value)
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
    haptics.pulse()
    combo.value++

    const baseScore = 10
    const comboBonus = (combo.value - 1) * 5
    score.value += baseScore + comboBonus

    const points = baseScore + comboBonus
    const el = boardEl.value
    const holeEl = el?.querySelectorAll('.hole')[index] as HTMLElement | undefined
    if (el && holeEl) {
      const boardRect = el.getBoundingClientRect()
      const r = holeEl.getBoundingClientRect()
      pop(`+${points}`, r.left + r.width / 2 - boardRect.left, r.top + r.height / 2 - boardRect.top)
    }

    sound.hit()

    const timeoutId = window.setTimeout(() => {
      pendingTimeouts.delete(timeoutId)
      hole.active = false
      hole.hit = false
    }, 200)
    pendingTimeouts.add(timeoutId)
    if (combo.value >= 5) haptics.success()

    emit('score', score.value)
  } else if (!hole.active) {
    combo.value = 0
    sound.miss()
    haptics.light()
  }
}

function gameOver() {
  stopAllTimers()
  gameStarted.value = false
  paused.value = false
  emit('gameover', score.value)
}

function stopAllTimers() {
  if (moleTimer) clearInterval(moleTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  moleTimer = null
  countdownTimer = null
  pendingTimeouts.forEach(id => clearTimeout(id))
  pendingTimeouts.clear()
}

watch(() => props.difficulty, () => {
  if (gameStarted.value) return
  applyDifficulty()
  initHoles()
})

onMounted(() => {
  applyDifficulty()
  initHoles()
})

onUnmounted(() => {
  stopAllTimers()
})

defineExpose({ startGame, stopGame, pause, resume })
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
  position: relative;
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
  background: linear-gradient(90deg, #05FFA1, #FFD700, #FF7A3D);
  transition: width 1s linear;
  border-radius: 4px;
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
