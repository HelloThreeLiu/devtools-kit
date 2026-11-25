import { createApp } from 'vue'
import './main.css'
import { ensureSprite } from './icons.js'
import App from './App.vue'

ensureSprite() // SVG 图标 symbol 表，须在挂载前注入
createApp(App).mount('#app')
