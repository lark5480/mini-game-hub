import { createRouter, createWebHashHistory } from 'vue-router'
import { GAMES } from '@/lib/games'

const GAME_COMPONENTS: Record<string, string> = {
  sokoban:     'SokobanView',
  link:        'LinkGameView',
  'catch-fruit': 'CatchFruitView',
  snake:       'SnakeView',
  tetris:      'TetrisView',
  breakout:    'BreakoutView',
  '2048':      'Game2048View',
  whackamole:  'WhackAMoleView',
  'tic-tac-toe': 'TicTacToeView',
  'simon':       'SimonView',
  'xiangqi':     'XiangqiView',
}

const gameRoutes = GAMES.map(g => ({
  path: g.path,
  name: g.name,
  component: () => import(`@/views/${GAME_COMPONENTS[g.name]}.vue`),
}))

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    ...gameRoutes,
    // 旧"井字棋·双人"分享链接兼容：重定向到合并后的单入口并保留房间号 query
    {
      path: '/tic-tac-toe-2p',
      redirect: to => ({ path: '/tic-tac-toe', query: to.query })
    },
    {
      path: '/achievements',
      name: 'achievements',
      component: () => import('@/views/AchievementsView.vue')
    },
    // 任意未匹配路径兜底到首页（避免白屏）
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/'
    }
  ]
})

export default router

