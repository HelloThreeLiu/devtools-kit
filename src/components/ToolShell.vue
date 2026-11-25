<script setup>
/**
 * 统一工具页骨架（技术设计 §6.1）
 * 头部：返回 / 图标+名称 / 直达指令 / 历史面板 / 收藏星标；主体由工具组件填充
 * 历史面板（PRD 4.7.1）：点击记录回填输入、单条 ✕ 删除、清空本工具
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { toolById } from '../tools/index.js'
import { favorites, toggleFavorite, listHistory, removeHistory, clearHistory } from '../utils/db.js'
import { navigate } from '../router.js'
import { replay } from '../utils/replay.js'
import { relTime } from '../utils/convert/timestamp.js'
import { toast } from '../utils/toast.js'

const props = defineProps({
  toolId: { type: String, required: true },
})

const tool = computed(() => toolById[props.toolId])
const fav = computed(() => favorites.value.includes(props.toolId))
const records = computed(() => listHistory(props.toolId))

const histOpen = ref(false)
const anchor = ref(null)

function onDocClick(e) {
  if (histOpen.value && anchor.value && !anchor.value.contains(e.target)) histOpen.value = false
}
function onKey(e) {
  if (e.key === 'Escape') histOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

function onFav() {
  const next = toggleFavorite(props.toolId)
  toast(next.includes(props.toolId) ? `已收藏 ${tool.value.name}` : `已取消收藏 ${tool.value.name}`)
}

/** 回填历史输入到工具 */
function onReplay(r) {
  replay(props.toolId, r.input)
  histOpen.value = false
}

function onRemove(i) {
  removeHistory(props.toolId, i)
  toast('已删除该条记录')
}

function onClear() {
  clearHistory(props.toolId)
  toast('已清空本工具历史')
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

    <!-- 历史记录面板（PRD 4.7.1） -->
    <div ref="anchor" class="menu-anchor">
      <button
        type="button"
        class="icon-btn"
        :aria-haspopup="true"
        :aria-expanded="histOpen"
        :aria-label="`${tool.name} 历史记录`"
        title="历史记录"
        @click="histOpen = !histOpen"
      >
        <Icon name="clock" />
      </button>
      <div v-show="histOpen" class="menu menu--hist" role="menu" aria-label="历史记录">
        <div class="hist-head">
          <span>历史记录</span>
          <span class="tag">{{ records.length }}</span>
        </div>
        <div class="hist-list">
          <div v-for="(r, i) in records" :key="r.ts + i" class="hist-row">
            <button type="button" class="hist-main" :title="r.input" @click="onReplay(r)">
              <span class="hist-out">{{ r.output || '—' }}</span>
              <span class="hist-in">{{ r.input }}</span>
              <span class="hist-ago">{{ relTime(r.ts) }}</span>
            </button>
            <button type="button" class="icon-btn hist-del" aria-label="删除该条" title="删除该条" @click="onRemove(i)">
              <Icon name="x" size="sm" />
            </button>
          </div>
          <div v-if="!records.length" class="hist-empty">暂无历史记录<br /><span>有效转换结果会自动记录在这里（点击可回填）</span></div>
        </div>
        <button v-if="records.length" type="button" class="hist-clear" @click="onClear">清空本工具历史</button>
      </div>

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
    </div>
  </header>
  <slot />
</template>
