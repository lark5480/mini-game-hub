import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/game-theme.css'

const app = createApp(App)

// 全局运行时错误兜底：防止 Vue 渲染异常导致白屏。
// 生产环境打印到 console（可对接日志服务），开发环境额外 warn。
app.config.errorHandler = (err, instance, info) => {
  console.error('[GameHub] Vue error:', info, err)
  if (import.meta.env.DEV) {
    console.warn('组件:', instance?.$options?.__name || instance?.$options?.name || 'unknown')
  }
}

// 未捕获的 JS 异常兜底
window.addEventListener('error', (e) => {
  console.error('[GameHub] Unhandled error:', e.error || e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[GameHub] Unhandled rejection:', e.reason)
})

app.use(createPinia())
app.use(router)
app.mount('#app')
