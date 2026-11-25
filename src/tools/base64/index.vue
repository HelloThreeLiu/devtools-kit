<script setup>
/**
 * Base64 编解码（PRD 4.3.2）
 * 自动识别方向；UTF-8 安全；URL-Safe 容错；非法输入行内报错
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { convertBase64 } from '../../utils/convert/base64.js'
import { copyText } from '../../utils/clipboard.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const mode = ref('auto') // auto | encode | decode

useReplay('base64', (v) => (input.value = String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const r = convertBase64(v, mode.value)
    if (r.ok) recordHistory('base64', v, r.data)
  }, 1000)
})

const modes = [
  { id: 'auto', label: '自动识别' },
  { id: 'encode', label: '编码' },
  { id: 'decode', label: '解码' },
]

const res = computed(() => convertBase64(input.value, mode.value))
const err = computed(() => (res.value.error ? res.value.error : ''))
const out = computed(() => (res.value.ok ? res.value.data : ''))

const directionLabel = computed(() => {
  if (!input.value) return '—'
  if (mode.value !== 'auto') return mode.value === 'decode' ? 'Base64 → 文本' : '文本 → Base64'
  return res.value.direction === 'decode' ? '自动识别 → 解码' : '自动识别 → 编码'
})

const stat = computed(() => {
  if (!input.value || !res.value.ok) return ''
  const inBytes = new TextEncoder().encode(input.value).length
  return `输入 ${inBytes} B · 输出 ${out.value.length} 字符`
})

const setMode = (id) => (mode.value = id)

function onCopy() {
  copyText(out.value, '结果')
}

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) input.value = String(p)
  inputEl.value?.focus()
})
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
          @click="setMode(m.id)"
        >
          {{ m.label }}
        </button>
      </div>

      <div class="block-head">
        <label for="b64Input">输入</label>
        <span class="tag">{{ directionLabel }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="b64Input"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 88px"
        placeholder="输入任意文本进行编码；或输入 Base64 进行解码&#10;自动识别：内容符合 Base64 特征时默认解码，否则编码"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>输出</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!out" @click="onCopy">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <span v-if="!input" class="placeholder">输入内容后自动转换。</span>
          <span v-else-if="err">—</span>
          <template v-else>{{ out }}</template>
        </div>
        <div class="pane-foot">{{ stat }}</div>
      </div>
    </div>
  </div>
</template>
