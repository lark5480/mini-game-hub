import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  // 允许局域网/同事访问：dev 服务器绑定 0.0.0.0（默认仅 localhost）。
  // 启动后终端会打印 `Network: http://<你的局域网IP>:5173`，把该地址发给同事即可。
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})