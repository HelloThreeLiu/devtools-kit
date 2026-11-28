<script setup>
/**
 * Base32 编解码（RFC 4648；R1.7）
 * 编码（可选无填充输出）/ 解码（小写归一、padding 容错、空白剥离）；
 * UTF-8 安全；非法输入行内报错
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { decodeB32, encodeB32 } from '../../utils/convert/base32.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const mode = ref('encode') // encode | decode
const noPadding = ref(false) // 编码方向：无填充输出（解码方向始终容错）

useReplay('base32', (v) => (input.value = String(v ?? '')))

/* 历史记录：有效结果停顿 1s 后写入（卸载自动清理） */
useHistRecorder('base32', () => [input.value, mode.value, noPadding.value], (src) => {
  const r = src[1] === 'decode' ? decodeB32(src[0]) : encodeB32(src[0], { padding: !src[2] })
  return r.ok ? r.data : null
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2） */
useMainResult(() => (out.value ? { value: out.value, label: 'Base32 结果' } : null))

const modes = [
  { id: 'encode', label: '编码' },
  { id: 'decode', label: '解码' },
]

const res = computed(() => {
  if (!input.value) return { ok: false, empty: true }
  return mode.value === 'decode' ? decodeB32(input.value) : encodeB32(input.value, { padding: !noPadding.value })
})
const err = computed(() => (res.value.error ? res.value.error : ''))
const out = computed(() => (res.value.ok ? res.value.data : ''))

const directionLabel = computed(() =>
  !input.value ? '—' : mode.value === 'decode' ? 'Base32 → 文本' : '文本 → Base32',
)

const stat = computed(() => {
  if (!input.value || !res.value.ok) return ''
  if (mode.value === 'decode') return `解码 ${res.value.byteLen ?? ''} 字节`
  const inBytes = new TextEncoder().encode(input.value).length
  return `输入 ${inBytes} B · 输出 ${out.value.length} 字符`
})

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
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
        <button
          v-if="mode === 'encode'"
          type="button"
          :aria-pressed="noPadding"
          title="输出不带补位符 =（解码方向始终兼容带/不带填充）"
          @click="noPadding = !noPadding"
        >
          无填充输出
        </button>
      </div>

      <div class="block-head">
        <label for="b32Input">输入</label>
        <span class="tag">{{ directionLabel }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="b32Input"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 88px"
        placeholder="输入任意文本进行 Base32 编码；或输入 Base32 进行解码&#10;字母表 A–Z 与 2–7（RFC 4648），小写自动归一，换行/空格自动忽略"
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
          <div v-if="!input" class="placeholder">
            输入内容后自动转换。
            <div class="examples">
              <button v-for="x in ['hello', '你好', 'NBSWY3DP']" :key="x" type="button" class="example" @click="input = x">
                {{ x }}
              </button>
            </div>
          </div>
          <span v-else-if="err">—</span>
          <template v-else>{{ out }}</template>
        </div>
        <div class="pane-foot">{{ stat }}</div>
      </div>
    </div>
  </div>
</template>
