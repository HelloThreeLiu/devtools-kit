<script setup>
/**
 * Unicode 转中文（PRD 4.3.7）
 * \uXXXX / \u{...} / &#xHHHH; 解码；非 ASCII → \uXXXX 编码；自动识别方向
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { convertUnicode } from '../../utils/convert/unicode.js'
import { copyText } from '../../utils/clipboard.js'

const input = ref('')
const inputEl = ref(null)
const mode = ref('auto')

const modes = [
  { id: 'auto', label: '自动识别' },
  { id: 'decode', label: '解码' },
  { id: 'encode', label: '编码' },
]

useReplay('unicode', (v) => (input.value = String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const r = convertUnicode(v, mode.value)
    if (r.ok) recordHistory('unicode', v, r.data)
  }, 1000)
})

const res = computed(() => convertUnicode(input.value, mode.value))
const out = computed(() => (res.value.ok ? res.value.data : ''))

const directionLabel = computed(() => {
  if (!input.value) return '—'
  if (mode.value !== 'auto') return mode.value === 'decode' ? '解码' : '编码'
  return res.value.direction === 'decode' ? '自动识别 → 解码' : '自动识别 → 编码'
})

onMounted(() => inputEl.value?.focus())
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="seg" role="group" aria-label="模式">
        <button
          v-for="m in modes"
          :key="m.id"
          type="button"
          :aria-pressed="mode === m.id"
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
      </div>

      <div class="block-head">
        <label for="uniInput">输入</label>
        <span class="tag">{{ directionLabel }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="uniInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 72px"
        placeholder="解码：\u4f60\u597d / &#x4f60;&#x597d;&#1025; → 中文字符&#10;编码：中文与 Emoji → \uXXXX（BMP 外自动拆代理对）"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>输出</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!out" @click="copyText(out, '结果')">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <span v-if="!input" class="placeholder">输入内容后自动转换。</span>
          <template v-else>{{ out }}</template>
        </div>
      </div>
    </div>
  </div>
</template>
