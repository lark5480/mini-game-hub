<template>
  <GameLayout
    title="接水果"
    accentColor="#05FFA1"
    gradientEnd="#00FFFF"
    :hints="['空格/Enter 开始', '方向键/AD 左右移动']"
    :infoItems="[{ label: '分数', value: score }, { label: '生命', value: lives }]"
    @back="handleBack"
  >
    <div class="game-board" :style="{ width: boardWidth + 'px', height: boardHeight + 'px' }">
      <div
        v-for="fruit in fruits"
        :key="fruit.id"
        class="fruit"
        :style="{ left: fruit.x + 'px', top: fruit.y + 'px' }"
      >{{ fruit.emoji }}</div>
      <div class="basket" :style="{ left: basketX + 'px' }">
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
    </div>
    <template #controls>
      <DirectionPad layout="horizontal" :showUp="false" :showDown="false" @left="moveLeft" @right="moveRight">
        <template #extra>
          <button v-if="!isPlaying" @click="startGame" class="start-btn">开始</button>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="gameOver"
      accentColor="#05FFA1"
      icon="fail"
      title="游戏结束"
      :message="'得分: ' + score"
      actionText="再来一局"
      @action="startGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import DirectionPad from '@/components/DirectionPad.vue'

const router = useRouter()
const gameStore = useGameStore()

const boardWidth = 400, boardHeight = 500, basketWidth = 80, basketSpeed = 30
const basketX = ref(boardWidth / 2 - basketWidth / 2)
const fruits = ref<{ id: number; x: number; y: number; emoji: string }[]>([])
const score = ref(0), lives = ref(3), isPlaying = ref(false), gameOver = ref(false), fruitId = ref(0)

const fruitEmojis = ['🍎','🍊','🍋','🍇','🍓','🍉','🍑','🍒']

const gameLoop = useGameLoop({
  mode: 'interval',
  intervalMs: 30,
  onUpdate: () => {
    update()
    if (Math.random() < 0.03) spawnFruit()
  }
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
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { if (isPlaying.value) moveLeft() }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { if (isPlaying.value) moveRight() }
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
  fruits.value.forEach((fruit) => {
    fruit.y += 4
    if (fruit.y > boardHeight - 60) {
      if (Math.abs(fruit.x + 20 - (basketX.value + basketWidth / 2)) < basketWidth / 2) {
        score.value += 5
        toRemove.push(fruit.id)
      } else if (fruit.y > boardHeight) {
        lives.value--
        toRemove.push(fruit.id)
        if (lives.value <= 0) endGame()
      }
    }
  })
  fruits.value = fruits.value.filter(f => !toRemove.includes(f.id))
}

function startGame() {
  isPlaying.value = true; gameOver.value = false
  score.value = 0; lives.value = 3; fruits.value = []
  gameLoop.start()
}

function endGame() {
  isPlaying.value = false; gameOver.value = true
  gameLoop.stop()
  gameStore.addScore('catch-fruit', score.value)
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
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(5,255,161,0.2);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(5,255,161,0.1);
}

.fruit {
  position: absolute;
  font-size: 30px;
  filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));
}

.basket {
  position: absolute;
  bottom: 15px;
  filter: drop-shadow(0 0 10px rgba(139,69,19,0.5));
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
</style>
