import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/sokoban',
      name: 'sokoban',
      component: () => import('@/views/SokobanView.vue')
    },
    {
      path: '/link',
      name: 'link',
      component: () => import('@/views/LinkGameView.vue')
    },
    {
      path: '/catch-fruit',
      name: 'catch-fruit',
      component: () => import('@/views/CatchFruitView.vue')
    },
    {
      path: '/snake',
      name: 'snake',
      component: () => import('@/views/SnakeView.vue')
    },
    {
      path: '/tetris',
      name: 'tetris',
      component: () => import('@/views/TetrisView.vue')
    },
    {
      path: '/breakout',
      name: 'breakout',
      component: () => import('@/views/BreakoutView.vue')
    },
    {
      path: '/2048',
      name: '2048',
      component: () => import('@/views/Game2048View.vue')
    },
    {
      path: '/whackamole',
      name: 'whackamole',
      component: () => import('@/views/WhackAMoleView.vue')
    }
  ]
})

export default router
