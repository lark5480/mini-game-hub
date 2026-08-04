<template>
  <GameLayout
    :title="layoutTitle"
    :accentColor="layoutAccent"
    :gradientEnd="layoutGradient"
    :entrance="layoutEntrance"
    :hints="layoutHints"
    :infoItems="layoutInfoItems"
    :confirmRestart="confirmRestart"
    :tutorial="layoutTutorial"
    @back="goHome"
    @restart="onRestart"
  >
    <!-- 模式选择屏 -->
    <div v-if="mode === null" class="mode-panel">
      <h2 class="mode-title">打地鼠</h2>
      <p class="mode-sub">选择游戏模式</p>
      <div class="mode-buttons">
        <button class="mode-card" @click="startSingle">
          <span class="mode-name">单人挑战</span>
          <span class="mode-desc">30 秒计分 · 冲击排行榜</span>
        </button>
        <button class="mode-card" @click="startRace">
          <span class="mode-name">联机竞速</span>
          <span class="mode-desc">分享房间号 · 实时对战</span>
        </button>
      </div>
      <p class="mode-tip">联机需配置 Supabase（见 .env.example）；未配置会提示。</p>
      <LeaderboardStrip game="whackamole" />
    </div>

    <!-- 单人模式 -->
    <template v-else-if="mode === 'single'">
      <WhackAMoleBoard
        ref="boardRef"
        :difficulty="difficulty"
        @gameover="onGameOver"
      />
      <LeaderboardStrip game="whackamole" />

      <PauseOverlay :visible="paused" @resume="resumeGame" />
      <GameDialog
        v-model:visible="gameOverDialog"
        accentColor="#FF7A3D"
        :icon="newRecord ? 'success' : 'fail'"
        :title="newRecord ? '新纪录！' : '游戏结束'"
        :message="'最终得分: ' + lastScore"
        :actionText="newRecord ? '提交新纪录' : '提交分数'"
        :newRecord="newRecord"
        :achievementHint="achievementHint"
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
    </template>

    <!-- 联机竞速模式 -->
    <WhackAMoleRaceView v-else ref="raceRef" />

    <!-- controls 槽：必须作为 GameLayout 的直接子级（与 v-else-if 同级），否则 vue-tsc 无法解析 slot 绑定 -->
    <template v-if="mode === 'single'" #controls>
      <div class="game-controls">
        <div class="difficulty-buttons">
          <button
            v-for="d in difficulties"
            :key="d.name"
            class="diff-btn"
            :class="{ active: difficulty === d.name }"
            @click="setDifficulty(d.name)"
          >
            {{ d.label }}
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
  </GameLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAchievements } from '@/stores/achievements'
import { useToast } from '@/composables/useToast'
import { useGamePause } from '@/composables/useGamePause'
import { useGameOver } from '@/composables/useGameOver'
import GameLayout from '@/components/GameLayout.vue'
import GameDialog from '@/components/GameDialog.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
import WhackAMoleBoard from '@/components/WhackAMoleBoard.vue'
import WhackAMoleRaceView from '@/views/WhackAMoleRaceView.vue'

type Mode = 'single' | 'race'

const difficulties = [
  { name: 'easy', label: '简单' },
  { name: 'normal', label: '普通' },
  { name: 'hard', label: '困难' },
]

const router = useRouter()
const route = useRoute()
const achievements = useAchievements()
const toast = useToast()
const { checkGameOver } = useGameOver()

// 模式：null=选择屏；single=单人；race=联机竞速。
// 若 URL 带 ?room=XXXX（好友分享进来的），直接进联机模式。
const ROOM_RE = /^[A-Z0-9]{4}$/
const mode = ref<Mode | null>(
  (typeof route.query.room === 'string' && ROOM_RE.test(route.query.room)) ? 'race' : null
)

const boardRef = ref<InstanceType<typeof WhackAMoleBoard> | null>(null)
const raceRef = ref<InstanceType<typeof WhackAMoleRaceView> | null>(null)

const difficulty = ref('normal')
const gameStarted = ref(false)
const gameOverDialog = ref(false)
const newRecord = ref(false)
const achievementHint = ref<string | null>(null)
const showLeaderboard = ref(false)
const lastScore = ref(0)

const confirmRestart = computed(() => gameStarted.value && !gameOverDialog.value)

// ---- 布局 props（随 mode 变化） ----
const layoutTitle = computed(() => mode.value === 'race' ? '打地鼠·竞速' : '打地鼠')
const layoutAccent = computed(() => mode.value === 'race' ? '#FF9E00' : '#FF7A3D')
const layoutGradient = computed(() => mode.value === 'race' ? '#B967FF' : '#FFD700')
const layoutEntrance = computed(() => mode.value === 'race' ? 'ttt2p' : 'whackmole')
const layoutHints = computed(() => {
  if (mode.value === 'single') return ['点击地鼠得分', '别打空！']
  if (mode.value === 'race') return ['分享房间号给好友', '实时对战']
  return ['选择模式开始']
})
const layoutInfoItems = computed(() => {
  if (mode.value === 'single') return [{ label: '难度', value: difficulties.find(d => d.name === difficulty.value)?.label ?? '普通' }]
  if (mode.value === 'race') return [{ label: '模式', value: '联机竞速' }]
  return [{ label: '模式', value: '选择中' }]
})
const layoutTutorial = computed(() =>
  mode.value === 'race'
    ? '和好友实时对战：30 秒内得分高者获胜。分享房间号即可同玩。'
    : '快速点击冒出来的地鼠得分，连续命中有连击加成！打空会重置连击。'
)

// ---- 单人模式逻辑 ----
function setDifficulty(name: string) {
  if (gameStarted.value) return
  difficulty.value = name
}

function startGame() {
  showLeaderboard.value = false
  gameOverDialog.value = false
  gameStarted.value = true
  boardRef.value?.startGame()
}

function restartGame() {
  gameStarted.value = false
  gameOverDialog.value = false
  showLeaderboard.value = false
  boardRef.value?.stopGame()
  boardRef.value?.startGame()
  gameStarted.value = true
}

function onGameOver(score: number) {
  gameStarted.value = false
  lastScore.value = score
  const { isNewRecord: isNewRecordResult, achievementHint: hint } = checkGameOver('whackamole', score)
  newRecord.value = isNewRecordResult
  achievementHint.value = hint
  if (score >= 300) {
    if (achievements.unlock('whack_master')) {
      toast.show('成就解锁：神速', '🔨')
    }
  }
  gameOverDialog.value = true
}

function openLeaderboard() {
  gameOverDialog.value = false
  showLeaderboard.value = true
}

// 暂停/恢复：仅在单人模式且游戏进行中可用（联机模式禁用）
const { paused, resume: resumeGame } = useGamePause({
  canPause: () => mode.value === 'single' && gameStarted.value && !gameOverDialog.value,
  onPause: () => boardRef.value?.pause(),
  onResume: () => boardRef.value?.resume(),
})

// ---- 模式切换 ----
function startSingle() {
  mode.value = 'single'
}
function startRace() {
  mode.value = 'race'
}
function onRestart() {
  if (mode.value === 'single') restartGame()
  else if (mode.value === 'race') raceRef.value?.resetForNextRound()
}

function goHome() {
  boardRef.value?.stopGame()
  router.push('/')
}

onMounted(() => {
  // 联机模式由子组件自行处理（含 ?room 加入），这里不干预
})
</script>

<style scoped>
/* 模式选择屏 */
.mode-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 40px 20px;
}
.mode-title {
  font-size: 2em;
  color: #fff;
  margin: 0;
}
.mode-sub {
  color: var(--game-text-muted);
  margin: 0;
}
.mode-buttons {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}
.mode-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  min-width: 180px;
  padding: 22px 28px;
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  border-radius: 18px;
  cursor: pointer;
  color: var(--game-text);
  transition: all 0.2s ease;
}
.mode-card:hover {
  border-color: var(--game-accent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent) 30%, transparent);
  transform: translateY(-2px);
}
.mode-name {
  font-size: 1.1em;
  font-weight: 600;
}
.mode-desc {
  font-size: 0.82em;
  color: var(--game-text-muted);
}
.mode-tip {
  font-size: 0.8em;
  color: var(--game-text-muted);
  text-align: center;
  margin-top: 8px;
}

/* 单人对战控制区 */
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
  border-color: #FF7A3D;
  color: #FF7A3D;
}

.start-btn, .restart-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #FF7A3D, #FF8E8E);
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
</style>
