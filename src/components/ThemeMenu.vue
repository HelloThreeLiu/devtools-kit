<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { useTheme } from '../utils/theme.js'

const { themeMode, setMode } = useTheme()
const open = ref(false)
const anchor = ref(null)

const options = [
  { value: 'auto', label: '跟随系统', icon: 'monitor' },
  { value: 'light', label: '亮色', icon: 'sun' },
  { value: 'dark', label: '暗色', icon: 'moon' },
]

const currentIcon = computed(() =>
  themeMode.value === 'auto' ? 'monitor' : themeMode.value === 'dark' ? 'moon' : 'sun',
)

function onDocClick(e) {
  if (open.value && anchor.value && !anchor.value.contains(e.target)) open.value = false
}
function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="anchor" class="menu-anchor">
    <button
      type="button"
      class="icon-btn"
      title="外观"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-label="外观设置"
      @click="open = !open"
    >
      <Icon :name="currentIcon" />
    </button>
    <div v-show="open" class="menu" role="menu" aria-label="外观">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="menuitemradio"
        :aria-checked="themeMode === o.value"
        @click="setMode(o.value); open = false"
      >
        <Icon :name="o.icon" />
        <span>{{ o.label }}</span>
        <Icon name="check" size="sm" />
      </button>
    </div>
  </div>
</template>
