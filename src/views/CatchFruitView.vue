<template>
  <GameLayout
    title="接水果"
    accentColor="#05FFA1"
    gradientEnd="#00FFFF"
    :hints="['空格/Enter 开始', '方向键/AD 左右移动']"
    :infoItems="[{ label: '分数', value: score }, { label: '生命', value: lives }]"
    :confirmRestart="score > 0"
    tutorial="移动篮子接住掉落的水果，漏接会失去生命。生命耗尽游戏结束！"
    @back="handleBack"
    @restart="startGame"
  >
    <div class="game-board" ref="boardEl">
      <div
        v-for="fruit in fruits"
        :key="fruit.id"
        class="fruit"
        :style="{ left: ((fruit.x + 20) / boardWidth * 100) + '%', top: ((fruit.y + 20) / boardHeight * 100) + '%' }"
      >{{ fruit.emoji }}</div>
      <div class="basket" :style="{ left: ((basketX + 40) / boardWidth * 100) + '%' }">
        <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
          <path d="M5 5 L10 35 L70 35 L75 5 Z" fill="url(#basketGrad)" stroke="#5D3A1A" stroke-width="2"/>
          <defs>
            <linearGradient id="basketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#8B4513"/>
              <stop offset="100%" stop-color="#654321"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <ScoreFloat :popups="popups" />
    </div>
    <LeaderboardStrip game="catch-fruit" />
    <template #controls>
      <DirectionPad layout="horizontal" :showUp="false" :showDown="false" @left="moveLeft" @right="moveRight">
        <template #extra>
          <button v-if="!isPlaying" @click="startGame" class="start-btn">开始</button>
          <template v-else>
            <button v-if="!paused" @click="togglePause" class="extra-btn">暂停</button>
            <button v-else @click="togglePause" class="extra-btn">继续</button>
            <button @click="startGame" class="extra-btn">重新开始</button>
          </template>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="gameOver"
      accentColor="#05FFA1"
      icon="fail"
      title="游戏结束"
      :message="'得分: ' + score"
      actionText="提交分数"
      @action="openLeaderboard"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="catch-fruit"
      gameName="接水果"
      :score="lastScore"
      @update:visible="showLeaderboard = $event"
      @replay="startGame"
    />
    <PauseOverlay :visible="paused" @resume="togglePause" />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
import { useAutoPause } from '@/composables/useAutoPause'
import { useHaptics } from '@/composables/useHaptics'
import { useGameStore } from '@/stores/game'
import { useScoreFloats } from '@/composables/useScoreFloats'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import DirectionPad from '@/components/DirectionPad.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'
import ScoreFloat from '@/components/ScoreFloat.vue'

const router = useRouter()
const sound = useSound()
const haptics = useHaptics()
const { popups, pop } = useScoreFloats()
const gameStore = useGameStore()

const boardWidth = 400, boardHeight = 500, basketWidth = 80, basketSpeed = 30
const basketX = ref(boardWidth / 2 - basketWidth / 2)
const fruits = ref<{ id: number; x: number; y: number; emoji: string }[]>([])
const score = ref(0), lives = ref(3), isPlaying = ref(false), gameOver = ref(false), fruitId = ref(0)
const showLeaderboard = ref(false)
const lastScore = ref(0)

const fruitEmojis = ['🍎','🍊','🍋','🍇','🍓','🍉','🍑','🍒']

const gameLoop = useGameLoop({
  mode: 'interval',
  intervalMs: 30,
  onUpdate: () => {
    if (paused.value) return
    update()
    if (Math.random() < 0.03) spawnFruit()
  }
})
const paused = gameLoop.paused

function togglePause() {
  if (gameOver.value || !isPlaying.value) return
  if (paused.value) { gameLoop.resume(); sound.resume() }
  else { gameLoop.pause(); sound.pause() }
}

useAutoPause(() => {
  if (isPlaying.value && !gameOver.value) gameLoop.pause()
})

const boardEl = ref<HTMLElement | null>(null)
function popScoreAt() {
  const el = boardEl.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  const x = (basketX.value + 40) / boardWidth * w
  const y = h * 0.85
  pop('+5', x, y)
}

useGameKeyboard({
  active: true,
  bindings: [
    {
      key: ['Enter', ' '],
      handler: () => {
        if (!isPlaying.value || gameOver.value || paused.value) startGame()
      }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (isPlaying.value && !paused.value) moveLeft() }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (isPlaying.value && !paused.value) moveRight() }
    },
    {
      key: ['p', 'P', 'Escape'],
      handler: () => togglePause()
    }
  ]
})

function spawnFruit() {
  fruits.value.push({
    id: fruitId.value++,
    x: Math.random() * (boardWidth - 40) + 20,
    y: 0,
    emoji: fruitEmojis[Math.floor(Math.random() * fruitEmojis.length)]
  })
}

function update() {
  const toRemove: number[] = []
  for (const fruit of fruits.value) {
    if (gameOver.value) break
    fruit.y += 4
    if (fruit.y > boardHeight - 60) {
      if (Math.abs(fruit.x + 20 - (basketX.value + basketWidth / 2)) < basketWidth / 2) {
        score.value += 5
        toRemove.push(fruit.id)
        sound.collect()
        haptics.pulse()
        popScoreAt()
      } else if (fruit.y > boardHeight) {
        lives.value--
        toRemove.push(fruit.id)
        sound.loseLife()
        haptics.error()
        if (lives.value <= 0) endGame()
      }
    }
  }
  fruits.value = fruits.value.filter(f => !toRemove.includes(f.id))
}

function startGame() {
  showLeaderboard.value = false
  isPlaying.value = true; gameOver.value = false
  score.value = 0; lives.value = 3; fruits.value = []
  gameLoop.start()
}

function endGame() {
  isPlaying.value = false; gameOver.value = true
  gameLoop.stop()
  sound.gameOver()
  lastScore.value = score.value
}

function openLeaderboard() {
  gameOver.value = false
  lastScore.value = score.value
  gameStore.addScore('catch-fruit', score.value)
  showLeaderboard.value = true
}

function moveLeft() { if (basketX.value > 0) basketX.value -= basketSpeed }
function moveRight() { if (basketX.value < boardWidth - basketWidth) basketX.value += basketSpeed }

function handleBack() {
  gameLoop.stop()
  router.push('/')
}
</script>

<style scoped>
.game-board {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 4 / 5;
  margin: 0 auto;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(5,255,161,0.2);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(5,255,161,0.1);
  touch-action: none;
}

.fruit {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: min(30px, 8vw);
  filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));
}

.basket {
  position: absolute;
  bottom: 15px;
  width: 20%;
  transform: translateX(-50%);
  filter: drop-shadow(0 0 10px rgba(139,69,19,0.5));
}

.basket svg {
  width: 100%;
  height: auto;
  display: block;
}

.start-btn {
  padding: 15px 45px;
  font-size: 1.2em;
  font-weight: 600;
  border: none;
  border-radius: 30px;
  background: linear-gradient(135deg, #05FFA1, #00FFFF);
  color: #0D0D1A;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 25px rgba(5,255,161,0.4);
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

.extra-btn:hover {
  background: rgba(5,255,161,0.1);
  border-color: var(--game-accent);
  box-shadow: 0 0 15px rgba(5,255,161,0.2);
}
</style>
