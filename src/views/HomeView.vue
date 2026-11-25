<script setup>
/**
 * 主界面：页签分类 / 收藏 / 全部工具两列 / 搜索过滤
 * 过滤文本来自 uTools 子输入框（浏览器调试模式显示页面内搜索框）
 */
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import ThemeMenu from '../components/ThemeMenu.vue'
import { tools, CATEGORIES } from '../tools/index.js'
import { favorites, toggleFavorite } from '../utils/db.js'
import { navigate, subInputText } from '../router.js'
import { inUtoolsEnv } from '../utils/utools.js'
import { toast } from '../utils/toast.js'

const activeTab = ref('all')

const norm = (s) => String(s).toLowerCase()
const matches = (t, kw) =>
  !kw || norm(`${t.name} ${t.description} ${t.cmds.join(' ')} ${t.keywords}`).includes(norm(kw))

const countOf = (catId) => tools.filter((t) => catId === 'all' || t.category === catId).length

const visibleTools = computed(() =>
  tools.filter((t) => (activeTab.value === 'all' || t.category === activeTab.value) && matches(t, subInputText.value)),
)

const favTools = computed(() =>
  favorites.value
    .map((id) => tools.find((t) => t.id === id))
    .filter((t) => t && (activeTab.value === 'all' || t.category === activeTab.value) && matches(t, subInputText.value)),
)

const nothing = computed(() => visibleTools.value.length === 0)

function openTool(t) {
  if (!t.component) {
    toast(`${t.name} 将在${t.priority === 'P1' ? ' P1' : ' M3'} 提供`)
    return
  }
  navigate(t.id)
}

function onFav(t) {
  const next = toggleFavorite(t.id)
  toast(next.includes(t.id) ? `已收藏 ${t.name}` : `已取消收藏 ${t.name}`)
}

/* 列表键盘导航：↑/↓ 在可见行间移动焦点 */
function onListKeydown(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const rows = Array.from(e.currentTarget.querySelectorAll('.row-main')).filter((el) => el.offsetParent !== null)
  if (!rows.length) return
  e.preventDefault()
  const idx = rows.indexOf(document.activeElement)
  const next = e.key === 'ArrowDown' ? Math.min(idx + 1, rows.length - 1) : Math.max(idx - 1, 0)
  rows[next === -1 ? 0 : next].focus()
}

/* 浏览器调试：搜索框回车打开首个匹配（对应子输入框 Enter 的期望行为） */
function onSearchEnter() {
  const t = visibleTools.value[0]
  if (t) openTool(t)
}
</script>

<template>
  <header class="topbar" aria-label="DevTools Kit">
    <div class="tool-id" style="border-left: 0; padding-left: 0; margin-left: 0">
      <Icon name="grid" />
      <h1>devtools-kit</h1>
    </div>
    <span class="grow"></span>
    <!-- 浏览器调试模式：uTools 环境下搜索由子输入框承担，页面内不再放第二个搜索框 -->
    <div v-if="!inUtoolsEnv" class="debug-search" title="浏览器调试模式（uTools 环境下搜索由主输入框承担）">
      <Icon name="search" size="sm" />
      <input
        v-model="subInputText"
        placeholder="搜索工具…（调试模式）"
        type="search"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter="onSearchEnter"
      />
    </div>
    <ThemeMenu />
  </header>

  <nav class="tabs" role="tablist" aria-label="工具分类">
    <button
      v-for="c in [{ id: 'all', name: '全部' }, ...CATEGORIES]"
      :key="c.id"
      type="button"
      class="tab"
      role="tab"
      :aria-selected="activeTab === c.id"
      @click="activeTab = c.id"
    >
      {{ c.name }}
      <span class="n">{{ countOf(c.id) }}</span>
    </button>
  </nav>

  <div class="home-body">
    <section v-if="favTools.length" class="section" aria-labelledby="h-fav">
      <h2 id="h-fav">我的收藏</h2>
      <div class="section-body">
        <ul class="quick">
          <li v-for="t in favTools" :key="t.id" class="row">
            <button type="button" class="row-main" @click="openTool(t)">
              <Icon :name="t.icon" />
              <span class="name">{{ t.name }}</span>
            </button>
            <button
              type="button"
              class="icon-btn star"
              :aria-pressed="true"
              :aria-label="`取消收藏 ${t.name}`"
              title="取消收藏"
              @click.stop="onFav(t)"
            >
              <Icon name="star" size="sm" />
            </button>
          </li>
        </ul>
      </div>
    </section>

    <section class="section" :class="{ 'section--all': !favTools.length }" aria-labelledby="h-all" @keydown="onListKeydown">
      <h2 id="h-all">全部工具</h2>
      <div class="section-body">
        <ul class="tools">
          <li v-for="t in visibleTools" :key="t.id" class="row" :title="t.description">
            <button type="button" class="row-main" @click="openTool(t)">
              <Icon :name="t.icon" />
              <span class="name">{{ t.name }}</span>
              <span v-if="!t.component" class="tag">{{ t.priority }}</span>
              <span v-else class="meta" :title="t.description">{{ t.cmds[0] }}</span>
            </button>
            <button
              type="button"
              class="icon-btn star"
              :aria-pressed="favorites.includes(t.id)"
              :aria-label="(favorites.includes(t.id) ? '取消收藏 ' : '收藏 ') + t.name"
              :title="favorites.includes(t.id) ? '取消收藏' : '收藏'"
              @click.stop="onFav(t)"
            >
              <Icon name="star" size="sm" />
            </button>
          </li>
        </ul>

        <div v-if="nothing" class="empty">
          <h3>没有匹配的工具</h3>
          <p>换个关键词试试，支持工具名、指令与功能描述的模糊匹配。</p>
          <div class="actions">
            <button type="button" class="btn" @click="subInputText = ''; activeTab = 'all'">清除筛选</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
