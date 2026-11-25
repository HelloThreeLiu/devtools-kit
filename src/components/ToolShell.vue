<script setup>
/**
 * 统一工具页骨架（技术设计 §6.1）
 * 职责：头部（返回 / 图标+名称 / 直达指令 / 收藏星标）；主体由工具组件填充
 */
import { computed } from 'vue'
import Icon from './Icon.vue'
import { toolById } from '../tools/index.js'
import { favorites, toggleFavorite } from '../utils/db.js'
import { navigate } from '../router.js'
import { toast } from '../utils/toast.js'

const props = defineProps({
  toolId: { type: String, required: true },
})

const tool = computed(() => toolById[props.toolId])
const fav = computed(() => favorites.value.includes(props.toolId))

function onFav() {
  const next = toggleFavorite(props.toolId)
  toast(next.includes(props.toolId) ? `已收藏 ${tool.value.name}` : `已取消收藏 ${tool.value.name}`)
}
</script>

<template>
  <header class="topbar" :aria-label="tool.name">
    <button type="button" class="back" @click="navigate('home')">
      <Icon name="arrow-left" /><span>返回</span>
    </button>
    <div class="tool-id">
      <Icon :name="tool.icon" />
      <h1>{{ tool.name }}</h1>
    </div>
    <span class="cmds" title="在 uTools 主输入框输入指令可直接打开">{{ tool.cmds.join(' / ') }}</span>
    <span class="grow"></span>
    <button
      type="button"
      class="icon-btn star"
      :aria-pressed="fav"
      :aria-label="(fav ? '取消收藏 ' : '收藏 ') + tool.name"
      :title="fav ? '取消收藏' : '收藏'"
      @click="onFav"
    >
      <Icon name="star" size="sm" />
    </button>
  </header>
  <slot />
</template>
