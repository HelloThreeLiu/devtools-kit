import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  test: {
    environment: 'node', // 纯函数单测，无 DOM 依赖
  },
})
