<template>
  <div class="home">
    <div class="header">
      <h1>GameHub</h1>
      <p class="subtitle">指尖娱乐时光</p>
    </div>
    <button class="achievements-btn" @click="router.push('/achievements')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/>
      </svg>
      成就
      <span v-if="unlockedCount > 0" class="ach-badge">{{ unlockedCount }}</span>
    </button>
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
import { h, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useAchievements } from '@/stores/achievements'
import { GAMES } from '@/lib/games'
import LeaderboardOverlay from '@/components/LeaderboardOverlay.vue'

const router = useRouter()
const gameStore = useGameStore()
const achievements = useAchievements()
const unlockedCount = achievements.progress.unlocked

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
const TicTacToeIcon = () => [
  h('line', { x1: '8', y1: '3', x2: '8', y2: '21', stroke: 'currentColor', 'stroke-width': '1.5' }),
  h('line', { x1: '16', y1: '3', x2: '16', y2: '21', stroke: 'currentColor', 'stroke-width': '1.5' }),
  h('line', { x1: '3', y1: '8', x2: '21', y2: '8', stroke: 'currentColor', 'stroke-width': '1.5' }),
  h('line', { x1: '3', y1: '16', x2: '21', y2: '16', stroke: 'currentColor', 'stroke-width': '1.5' }),
  h('path', { d: 'M4.5 4.5l3 3M7.5 4.5l-3 3', stroke: '#FF006E', 'stroke-width': '1.8', fill: 'none', 'stroke-linecap': 'round' }),
  h('circle', { cx: '12', cy: '12', r: '2.2', stroke: '#00CFFF', 'stroke-width': '1.6', fill: 'none' }),
  h('path', { d: 'M12.5 19.5l3 3M15.5 19.5l-3 3', stroke: '#FF006E', 'stroke-width': '1.8', fill: 'none', 'stroke-linecap': 'round' })
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

const iconMap: Record<string, () => unknown> = {
  sokoban: BoxIcon,
  link: LinkIcon,
  'catch-fruit': AppleIcon,
  snake: SnakeIcon,
  tetris: TetrisIcon,
  breakout: BreakoutIcon,
  '2048': Game2048Icon,
  whackamole: MoleIcon,
  'tic-tac-toe': TicTacToeIcon,
}

const games = computed(() =>
  GAMES.map(g => ({
    name: g.name,
    path: g.path,
    icon: iconMap[g.name],
    title: g.title,
    desc: g.desc,
    color: g.color,
  }))
)

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
  min-height: 100dvh;
  background: linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 50%, #0D0D1A 100%);
  padding: 60px 20px;
  padding: max(40px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
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

.achievements-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px auto 0;
  padding: 8px 20px;
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 20px;
  color: #FFD700;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.achievements-btn:hover {
  background: rgba(255, 215, 0, 0.15);
  border-color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
}

.ach-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #FFD700;
  color: #0D0D1A;
  border-radius: 10px;
  font-size: 0.75em;
  font-weight: 700;
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
