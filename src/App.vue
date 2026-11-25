<script setup>
/**
 * 根组件：生命周期挂载 + 路由分发（技术设计 §5.2）
 * 事件监听在挂载时一次性注册（官方要求每类仅注册一次）
 */
import { onMounted } from 'vue'
import { utools } from './utils/utools.js'
import { route, currentTool, handlePluginEnter, handlePluginOut } from './router.js'
import { useTheme } from './utils/theme.js'
import HomeView from './views/HomeView.vue'
import ToolShell from './components/ToolShell.vue'
import ToastHost from './components/ToastHost.vue'

useTheme() // 主题初始化：读取设置 + prefers-color-scheme 监听

onMounted(() => {
  if (typeof utools.onPluginReady === 'function') {
    utools.onPluginReady(() => {
      /* 一次性初始化任务（当前无；历史记录加载在 P1 加入） */
    })
  }
  utools.onPluginEnter(handlePluginEnter)
  utools.onPluginOut(handlePluginOut)
})
</script>

<template>
  <div class="app">
    <HomeView v-if="route === 'home'" />
    <template v-else-if="currentTool && currentTool.component">
      <ToolShell :key="currentTool.id" :tool-id="currentTool.id" />
      <component :is="currentTool.component" />
    </template>
    <ToastHost />
  </div>
</template>
