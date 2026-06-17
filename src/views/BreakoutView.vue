<template>
  <GameLayout
    title="弹球打砖块"
    accentColor="#FF6B6B"
    gradientEnd="#00FFFF"
    :hints="['← → 或 A D 移动挡板', 'Enter 开始/发球', 'P 暂停']"
    :infoItems="[{ label: '分数', value: score }, { label: '生命', value: lives }]"
    @back="handleBack"
  >
    <canvas ref="canvasRef" width="600" height="450"></canvas>
    <template #controls>
      <DirectionPad layout="horizontal" :showUp="false" :showDown="false" @left="moveLeft" @right="moveRight">
        <template #extra>
          <button @click="launchBall" class="launch-btn">发球</button>
        </template>
      </DirectionPad>
    </template>
    <GameDialog
      v-model:visible="gameOver"
      accentColor="#FF6B6B"
      icon="fail"
      title="游戏结束"
      :message="'得分 ' + score"
      actionText="再来一局"
      @action="restart"
    />
    <GameDialog
      v-model:visible="victory"
      accentColor="#00FFFF"
      icon="success"
      title="恭喜通关！"
      :message="'得分 ' + score"
      actionText="再玩一局"
      @action="restart"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
const canvasRef = ref<HTMLCanvasElement | null>(null)
const sound = useSound()

const score = ref(0)
const lives = ref(3)
const gameOver = ref(false)
const victory = ref(false)
const paused = ref(false)

const CANVAS_W = 600
const CANVAS_H = 450
const PADDLE_Y = 440
const PADDLE_WIDTH = 100
const PADDLE_HEIGHT = 14
const BALL_RADIUS = 8
const BRICK_ROWS = 5
const BRICK_COLS = 10
const BRICK_WIDTH = 55
const BRICK_HEIGHT = 20
const BRICK_PADDING = 5
const BRICK_OFFSET_TOP = 50
const BRICK_OFFSET_LEFT = 15
const PADDLE_SPEED = 12

let paddleX = 0
let ballX = 0
let ballY = 0
let ballDX = 0
let ballDY = 0
let bricks: boolean[][] = []
let ctx: CanvasRenderingContext2D | null = null
let launched = false
let leftPressed = false
let rightPressed = false

const brickColors = ['#FF006E', '#FF6B6B', '#FFE66D', '#4ECDC4', '#00FFFF']

const gameLoop = useGameLoop({
  mode: 'raf',
  fixedStep: 16.67,
  onUpdate: (dt) => gameUpdate(dt)
})

useGameKeyboard({
  active: true,
  bindings: [
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { leftPressed = true }
    },
    {
      key: ['ArrowLeft', 'a', 'A'],
      handler: () => { leftPressed = false },
      onKeyUp: true
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { rightPressed = true }
    },
    {
      key: ['ArrowRight', 'd', 'D'],
      handler: () => { rightPressed = false },
      onKeyUp: true
    },
    {
      key: 'Enter',
      handler: () => { launchBall() }
    },
    {
      key: ['p', 'P'],
      handler: () => { paused.value = !paused.value }
    }
  ]
})

function initGame() {
  paddleX = (CANVAS_W - PADDLE_WIDTH) / 2
  ballX = CANVAS_W / 2
  ballY = CANVAS_H - 50
  ballDX = 4
  ballDY = -4
  launched = false
  score.value = 0
  lives.value = 3
  gameOver.value = false
  victory.value = false
  paused.value = false
  bricks = []
  for (let r = 0; r < BRICK_ROWS; r++) {
    bricks[r] = []
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks[r][c] = true
    }
  }
}

function launchBall() {
  if (!launched && !gameOver.value && !victory.value) {
    launched = true
    ballDX = 4 * (Math.random() > 0.5 ? 1 : -1)
    ballDY = -4
  }
}

function moveLeft() {
  if (paddleX > 0) paddleX -= PADDLE_SPEED
}

function moveRight() {
  if (paddleX < CANVAS_W - PADDLE_WIDTH) paddleX += PADDLE_SPEED
}

function drawPaddle() {
  if (!ctx) return
  ctx.fillStyle = '#818CF8'
  ctx.shadowColor = '#00FFFF'
  ctx.shadowBlur = 15
  ctx.fillRect(paddleX, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT)
  ctx.shadowBlur = 0
}

function drawBall() {
  if (!ctx) return
  ctx.beginPath()
  ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2)
  const gradient = ctx.createRadialGradient(ballX - 2, ballY - 2, 0, ballX, ballY, BALL_RADIUS)
  gradient.addColorStop(0, '#FFFFFF')
  gradient.addColorStop(1, '#00FFFF')
  ctx.fillStyle = gradient
  ctx.shadowColor = '#00FFFF'
  ctx.shadowBlur = 20
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawBricks() {
  if (!ctx) return
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (!bricks[r][c]) continue
      const x = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT
      const y = r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP
      ctx.fillStyle = brickColors[r % brickColors.length]
      ctx.shadowColor = brickColors[r % brickColors.length]
      ctx.shadowBlur = 8
      ctx.fillRect(x, y, BRICK_WIDTH, BRICK_HEIGHT)
      ctx.shadowBlur = 0
    }
  }
}

function gameUpdate(dt: number) {
  if (!ctx) return

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  drawBricks()
  drawPaddle()
  drawBall()

  if (!launched || paused.value || gameOver.value || victory.value) {
    return
  }

  const scale = dt / 16.67

  ballX += ballDX * scale
  ballY += ballDY * scale

  if (ballX + BALL_RADIUS > CANVAS_W || ballX - BALL_RADIUS < 0) {
    ballDX = -ballDX
    ballX = Math.max(BALL_RADIUS, Math.min(CANVAS_W - BALL_RADIUS, ballX))
    sound.bounce()
  }
  if (ballY - BALL_RADIUS < 0) {
    ballDY = -ballDY
    ballY = BALL_RADIUS
    sound.bounce()
  }

  if (ballY + BALL_RADIUS >= PADDLE_Y && ballY - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT) {
    if (ballX > paddleX && ballX < paddleX + PADDLE_WIDTH) {
      const hitPos = (ballX - paddleX) / PADDLE_WIDTH
      const angle = (hitPos - 0.5) * Math.PI * 0.7
      const speed = Math.sqrt(ballDX * ballDX + ballDY * ballDY)
      ballDX = speed * Math.sin(angle)
      ballDY = -Math.abs(speed * Math.cos(angle))
      ballY = PADDLE_Y - BALL_RADIUS
      sound.bounce()
    }
  }

  if (ballY > CANVAS_H + 10) {
    lives.value--
    if (lives.value <= 0) {
      gameOver.value = true
      launched = false
      sound.gameOver()
      gameStore.addScore('breakout', score.value)
    } else {
      ballX = paddleX + PADDLE_WIDTH / 2
      ballY = CANVAS_H - 50
      ballDX = 4 * (Math.random() > 0.5 ? 1 : -1)
      ballDY = -4
      launched = false
      sound.loseLife()
    }
  }

  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (!bricks[r][c]) continue
      const bx = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT
      const by = r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP
      if (
        ballX + BALL_RADIUS > bx &&
        ballX - BALL_RADIUS < bx + BRICK_WIDTH &&
        ballY + BALL_RADIUS > by &&
        ballY - BALL_RADIUS < by + BRICK_HEIGHT
      ) {
        // Determine collision direction using minimum overlap method
        const overlapLeft = (ballX + BALL_RADIUS) - bx
        const overlapRight = (bx + BRICK_WIDTH) - (ballX - BALL_RADIUS)
        const overlapTop = (ballY + BALL_RADIUS) - by
        const overlapBottom = (by + BRICK_HEIGHT) - (ballY - BALL_RADIUS)

        const minOverlapX = Math.min(overlapLeft, overlapRight)
        const minOverlapY = Math.min(overlapTop, overlapBottom)

        if (minOverlapX < minOverlapY) {
          ballDX = -ballDX
          if (overlapLeft < overlapRight) {
            ballX = bx - BALL_RADIUS
          } else {
            ballX = bx + BRICK_WIDTH + BALL_RADIUS
          }
        } else {
          if (overlapTop < overlapBottom) {
            ballDY = -Math.abs(ballDY)
            ballY = by - BALL_RADIUS
          } else {
            ballDY = Math.abs(ballDY)
            ballY = by + BRICK_HEIGHT + BALL_RADIUS
          }
        }

        bricks[r][c] = false
        score.value += 10
        sound.brick()
      }
    }
  }

  let allBroken = true
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (bricks[r][c]) { allBroken = false; break }
    }
    if (!allBroken) break
  }
  if (allBroken) {
    victory.value = true
    launched = false
    sound.win()
    gameStore.addScore('breakout', score.value)
  }

  if (leftPressed) paddleX = Math.max(0, paddleX - PADDLE_SPEED * scale)
  if (rightPressed) paddleX = Math.min(CANVAS_W - PADDLE_WIDTH, paddleX + PADDLE_SPEED * scale)
}

function restart() {
  initGame()
}

function handleBack() {
  gameLoop.stop()
  router.push('/')
}

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    initGame()
    gameLoop.start()
  }
})
</script>

<style scoped>
canvas {
  display: block;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(0,255,255,0.2);
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(0,255,255,0.1);
}

.launch-btn {
  padding: 12px 35px;
  font-size: 1.1em;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(0,255,255,0.2), rgba(129,140,248,0.2));
  border: 1px solid #00FFFF;
  color: var(--game-text);
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.launch-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(0,255,255,0.3);
}
</style>
