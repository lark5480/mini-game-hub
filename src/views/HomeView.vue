<template>
  <div class="home">
    <div class="header">
      <h1>GameHub</h1>
      <p class="subtitle">指尖娱乐时光</p>
    </div>
    <div class="game-grid">
      <div
        v-for="game in games"
        :key="game.name"
        class="game-card"
        :style="{ '--glow-color': game.color }"
        @click="goToGame(game.path)"
      >
        <div class="game-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <component :is="game.icon" />
          </svg>
        </div>
        <h3>{{ game.title }}</h3>
        <p>{{ game.desc }}</p>
        <div v-if="getTopScore(game.name) > 0" class="best-score">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          {{ getTopScore(game.name) }}
        </div>
        <button class="card-leaderboard-btn" @click.stop="leaderboardGame = { name: game.name, title: game.title }" title="查看排行榜">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
        </button>
        <div class="card-glow"></div>
      </div>
    </div>
    <LeaderboardOverlay
      :visible="leaderboardGame !== null"
      :game="leaderboardGame?.name ?? ''"
      :gameName="leaderboardGame?.title ?? ''"
      :score="0"
      @update:visible="leaderboardGame = null"
    />
    <footer class="footer">
      <p>Press any game to start</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'

const router = useRouter()
const gameStore = useGameStore()

const leaderboardGame = ref<{ name: string; title: string } | null>(null)

const BoxIcon = () => h('rect', { x: '3', y: '3', width: '7', height: '7', rx: '1' })
const LinkIcon = () => h('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' })
const AppleIcon = () => h('path', { d: 'M12 2c-2.5 0-4.5 2-5.5 4-1 2 .5 4 2.5 5 1 .5 2 .5 3-.5s1-2.5.5-3.5c2-.5 4-1.5 4.5-3.5-1 1-2.5 1.5-4 1.5z' })
const SnakeIcon = () => h('path', { d: 'M4 12h4c2 0 2-2 4-2s2 2 4 2h4M8 8c0-2 2-2 2-4s-2-2-2-4' })
const TetrisIcon = () => h('path', { d: 'M3 3h4v4H3zM7 3h4v4H7zM11 3h4v4h-4zM7 7h4v4H7z' })
const BreakoutIcon = () => [
  h('rect', { x: '2', y: '14', width: '20', height: '4', rx: '1' }),
  h('circle', { cx: '12', cy: '8', r: '3' }),
  h('path', { d: 'M6 4l12 0M6 4v2' })
]
const Game2048Icon = () => [
  h('rect', { x: '3', y: '3', width: '8', height: '8', rx: '2' }),
  h('rect', { x: '13', y: '3', width: '8', height: '8', rx: '2' }),
  h('rect', { x: '3', y: '13', width: '8', height: '8', rx: '2' }),
  h('rect', { x: '13', y: '13', width: '8', height: '8', rx: '2' }),
  h('text', { x: '7', y: '10', 'font-size': '5', fill: 'currentColor', 'font-weight': 'bold' }, '2'),
  h('text', { x: '14.5', y: '10', 'font-size': '4', fill: 'currentColor', 'font-weight': 'bold' }, '8')
]
const MoleIcon = () => [
  h('ellipse', { cx: '12', cy: '16', rx: '8', ry: '6', fill: 'currentColor' }),
  h('circle', { cx: '8', cy: '14', r: '4', fill: 'currentColor' }),
  h('circle', { cx: '16', cy: '14', r: '4', fill: 'currentColor' }),
  h('circle', { cx: '12', cy: '10', r: '5', fill: 'currentColor' }),
  h('circle', { cx: '10', cy: '9', r: '1.5', fill: '#000' }),
  h('circle', { cx: '14', cy: '9', r: '1.5', fill: '#000' }),
  h('ellipse', { cx: '12', cy: '11.5', rx: '2', ry: '1.5', fill: '#FF69B4' })
]

const games = [
  { name: 'sokoban', path: '/sokoban', icon: BoxIcon, title: '推箱子', desc: '经典仓库搬运工', color: '#00FFFF' },
  { name: 'link', path: '/link', icon: LinkIcon, title: '连连看', desc: '消除配对乐趣', color: '#FF006E' },
  { name: 'catch-fruit', path: '/catch-fruit', icon: AppleIcon, title: '接水果', desc: '眼疾手快', color: '#05FFA1' },
  { name: 'snake', path: '/snake', icon: SnakeIcon, title: '贪吃蛇', desc: '童年经典回忆', color: '#B967FF' },
  { name: 'tetris', path: '/tetris', icon: TetrisIcon, title: '俄罗斯方块', desc: '经典益智游戏', color: '#00FFFF' },
  { name: 'breakout', path: '/breakout', icon: BreakoutIcon, title: '弹球打砖块', desc: '经典街机游戏', color: '#FF6B6B' },
  { name: '2048', path: '/2048', icon: Game2048Icon, title: '2048', desc: '数字合成挑战', color: '#FFD700' },
  { name: 'whackamole', path: '/whackamole', icon: MoleIcon, title: '打地鼠', desc: '反应力大考验', color: '#FF6B6B' }
]

function goToGame(path: string) {
  router.push(path)
}

function getTopScore(name: string): number {
  return gameStore.getTopScore(name)
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 50%, #0D0D1A 100%);
  padding: 60px 20px;
  position: relative;
  overflow: hidden;
}

.header {
  text-align: center;
  margin-bottom: 60px;
  position: relative;
}

.header h1 {
  font-size: 4em;
  font-weight: 700;
  background: linear-gradient(135deg, #00FFFF, #FF006E, #B967FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  filter: drop-shadow(0 0 30px rgba(0, 255, 255, 0.5));
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.5));
  }
  to {
    filter: drop-shadow(0 0 40px rgba(255, 0, 110, 0.5));
  }
}

.subtitle {
  font-size: 1.3em;
  color: #818CF8;
  margin-top: 10px;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 30px;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
}

.game-card {
  background: rgba(26, 26, 46, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 35px 25px;
  text-align: center;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  overflow: hidden;
}

.game-card:hover {
  transform: translateY(-8px);
  border-color: var(--glow-color);
  box-shadow: 0 0 30px color-mix(in srgb, var(--glow-color) 40%, transparent);
}

.game-card:hover .card-glow {
  opacity: 1;
}

.game-card:hover .game-icon {
  color: var(--glow-color);
  transform: scale(1.1);
}

.card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, color-mix(in srgb, var(--glow-color) 15%, transparent) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.game-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  color: #818CF8;
  transition: all 0.3s ease;
}

.game-card h3 {
  font-size: 1.4em;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
}

.game-card p {
  color: #6B7280;
  font-size: 0.95em;
}

.best-score {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 15px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 0.85em;
  color: #FFD700;
}

.best-score svg {
  color: #FFD700;
}

.card-leaderboard-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #818CF8;
  cursor: pointer;
  transition: all 0.2s;
}

.card-leaderboard-btn:hover {
  background: rgba(129, 140, 248, 0.15);
  border-color: #818CF8;
  color: #fff;
}

.footer {
  text-align: center;
  margin-top: 60px;
  color: #4B5563;
  font-size: 0.9em;
}

@media (max-width: 640px) {
  .header h1 {
    font-size: 2.5em;
  }

  .game-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  .game-card {
    padding: 25px 15px;
  }
}
</style>
