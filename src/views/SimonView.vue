<template>
  <GameLayout
    title="西蒙记忆灯"
    accentColor="#00CFFF"
    entrance="simon"
    gradientEnd="#B967FF"
    :hints="['记住灯序', '按顺序点']"
    :infoItems="[{ label: '分数', value: score }, { label: '关卡', value: level }]"
    :confirmRestart="phase !== 'idle'"
    tutorial="记住灯亮的顺序，然后照原样点出来。每过一关序列变长，看你能记到第几关！"
    @back="router.push('/')"
    @restart="startGame"
  >
    <div class="simon-wrap">
      <div class="status">{{ statusText }}</div>
      <div class="simon-board" :class="{ locked: phase !== 'input' || paused }">
        <button
          v-for="(pad, i) in pads"
          :key="i"
          class="pad"
          :class="['pad-' + i, { active: activePad === i || activePad === -2 }]"
          :style="{ '--pad-color': pad.color }"
          :disabled="phase !== 'input' || paused"
          @click="onPadClick(i)"
        ></button>
        <div class="center" @click="onCenterClick">
          <template v-if="phase === 'idle'">开始</template>
          <template v-else>{{ level }}</template>
        </div>
      </div>
      <button class="start-btn" v-if="phase === 'idle'" @click="startGame">开始游戏</button>
    </div>

    <LeaderboardStrip game="simon" />
    <template #controls>
      <div class="game-controls">
        <button class="restart-btn" v-if="phase !== 'idle'" @click="startGame">重新开始</button>
      </div>
    </template>

    <PauseOverlay :visible="paused" @resume="resumeGame" />
    <GameDialog
      v-model:visible="gameOverDialog"
      accentColor="#00CFFF"
      :icon="newRecord ? 'success' : 'fail'"
      :title="newRecord ? '新纪录！' : '游戏结束'"
      :message="'你记到了第 ' + score + ' 关'"
      :actionText="newRecord ? '提交新纪录' : '提交分数'"
      :newRecord="newRecord"
      :achievementHint="achievementHint"
      @action="openLeaderboard"
    />
    <LeaderboardOverlay
      :visible="showLeaderboard"
      game="simon"
      gameName="西蒙记忆灯"
      :score="score"
      @update:visible="showLeaderboard = $event"
      @replay="startGame"
    />
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useGamePause } from '@/composables/useGamePause'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'

const router = useRouter()
const gameStore = useGameStore()
const sound = useSound()
const haptics = useHaptics()

interface Pad { color: string; freq: number }
const pads: Pad[] = [
  { color: '#05FFA1', freq: 261.63 }, // 绿 · C4 · 左上
  { color: '#FF006E', freq: 329.63 }, // 红 · E4 · 右上
  { color: '#FFD700', freq: 392.00 }, // 黄 · G4 · 左下
  { color: '#00CFFF', freq: 523.25 }, // 蓝 · C5 · 右下
]

type Phase = 'idle' | 'showing' | 'input' | 'over'
const phase = ref<Phase>('idle')
const { paused, resume: resumeGame } = useGamePause({
  canPause: () => phase.value === 'input' && !gameOverDialog.value
})
const activePad = ref(-1)
const sequence = ref<number[]>([])
const playerIndex = ref(0)
const score = ref(0)
const level = ref(0)
const statusText = ref('点击中心开始')
const gameOverDialog = ref(false)
const newRecord = ref(false)
const achievementHint = ref<string | null>(null)
const showLeaderboard = ref(false)

const flashDur = 460
const gapDur = 260

let playToken = 0
const pendingTimeouts: Set<number> = new Set()

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(() => {
      pendingTimeouts.delete(id)
      resolve()
    }, ms)
    pendingTimeouts.add(id)
  })
}

function flashPad(i: number, dur = flashDur) {
  activePad.value = i
  sound.tone(pads[i].freq, 0.4, 'sine', 0.22)
  const id = window.setTimeout(() => {
    pendingTimeouts.delete(id)
    if (activePad.value === i) activePad.value = -1
  }, dur)
  pendingTimeouts.add(id)
}

async function playSequence() {
  const myToken = ++playToken
  phase.value = 'showing'
  statusText.value = '看好顺序…'
  await wait(300)
  if (myToken !== playToken) return
  // 整盘亮一下，提示即将开始（哨兵 -2 = 全亮）
  activePad.value = -2
  await wait(340)
  if (myToken !== playToken) return
  activePad.value = -1
  await wait(200)
  if (myToken !== playToken) return
  for (let i = 0; i < sequence.value.length; i++) {
    if (myToken !== playToken) return
    flashPad(sequence.value[i])
    await wait(flashDur + gapDur)
  }
  if (myToken !== playToken) return
  phase.value = 'input'
  playerIndex.value = 0
  statusText.value = '轮到你了，照顺序点'
}

function nextRound() {
  sequence.value.push(Math.floor(Math.random() * 4))
  level.value = sequence.value.length
  statusText.value = '第 ' + level.value + ' 关'
  void playSequence()
}

function startGame() {
  clearPending()
  playToken++
  gameOverDialog.value = false
  showLeaderboard.value = false
  paused.value = false
  sequence.value = []
  playerIndex.value = 0
  score.value = 0
  level.value = 0
  activePad.value = -1
  statusText.value = '准备…'
  nextRound()
}

function onPadClick(i: number) {
  if (phase.value !== 'input' || paused.value) return
  flashPad(i)
  haptics.pulse()
  if (sequence.value[playerIndex.value] === i) {
    playerIndex.value++
    if (playerIndex.value === sequence.value.length) {
      score.value = level.value
      statusText.value = '漂亮！进入下一关'
      phase.value = 'showing'
      const id = window.setTimeout(() => {
        pendingTimeouts.delete(id)
        nextRound()
      }, 750)
      pendingTimeouts.add(id)
    }
  } else {
    gameOver()
  }
}

function gameOver() {
  phase.value = 'over'
  statusText.value = '记错啦，游戏结束'
  sound.gameOver()
  gameStore.addScore('simon', score.value)
  gameOverDialog.value = true
}

function openLeaderboard() {
  gameOverDialog.value = false
  showLeaderboard.value = true
}

function onCenterClick() {
  if (phase.value === 'idle') startGame()
}

function clearPending() {
  pendingTimeouts.forEach((id) => clearTimeout(id))
  pendingTimeouts.clear()
}

onUnmounted(() => {
  playToken++
  clearPending()
})
</script>

<style scoped>
.simon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 10px;
}

.status {
  font-size: 1.1em;
  color: var(--game-text-info);
  min-height: 1.4em;
  text-align: center;
}

.simon-board {
  position: relative;
  width: min(78vw, 340px);
  height: min(78vw, 340px);
  border-radius: 50%;
  background: #0a0a16;
  box-shadow:
    0 0 40px color-mix(in srgb, #00CFFF 25%, transparent),
    inset 0 0 30px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.08);
}

.pad {
  position: absolute;
  box-sizing: border-box;
  width: 50%;
  height: 50%;
  border: 3px solid #0a0a16;
  padding: 0;
  cursor: pointer;
  background: var(--pad-color);
  opacity: 0.42;
  /* 提升为独立合成层，避免每次亮灭重绘整个圆盘 */
  will-change: opacity, transform, filter;
  /* 只过渡 opacity；filter/transform 瞬间生效，灯“啪”地亮灭更跟手、不卡 */
  transition: opacity 0.09s ease;
}

.pad-0 { top: 0; left: 0; border-radius: 100% 0 0 0; }
.pad-1 { top: 0; right: 0; border-radius: 0 100% 0 0; }
.pad-2 { bottom: 0; left: 0; border-radius: 0 0 0 100%; }
.pad-3 { bottom: 0; right: 0; border-radius: 0 0 100% 0; }

.pad:hover:not(:disabled) { opacity: 0.6; }

.pad.active {
  opacity: 1;
  z-index: 1;
  filter: brightness(1.9) saturate(1.45);
  transform: scale(1.05);
  box-shadow:
    0 0 44px 10px var(--pad-color),
    inset 0 0 36px rgba(255, 255, 255, 0.5);
}

.pad:disabled { cursor: default; }

.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 3px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 2.2em;
  font-weight: 700;
  cursor: pointer;
  z-index: 2;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
  user-select: none;
}

.center:hover { border-color: #00CFFF; }

.game-controls {
  display: flex;
  justify-content: center;
}

.start-btn,
.restart-btn {
  margin-top: 4px;
  background: linear-gradient(135deg, #00CFFF, #B967FF);
  border: none;
  color: #fff;
  padding: 12px 32px;
  border-radius: 14px;
  font-size: 1.05em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover,
.restart-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 207, 255, 0.4);
}

@media (max-width: 640px) {
  .center { font-size: 1.9em; }
}
</style>
