<script setup>
/**
 * 字符编码转换（R1.4）
 * GBK / UTF-8 / UTF-16 LE / UTF-16 BE × 编码/解码；
 * 文本 → 字节（Hex / Base64 展示）或字节 → 文本；
 * GBK 编码用运行时逆向映射表（SPIKE-1 方案 d，零依赖），UTF-16 可选 BOM
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { ENCODINGS, decodeText, encodeText, toB64, toHex } from '../../utils/convert/encoding.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const direction = ref('encode') // encode | decode
const encoding = ref('gbk')
const format = ref('hex') // hex | b64：编码 = 字节输出展示；解码 = 字节输入解析
const bom = ref(false) // UTF-16 编码方向：附加 BOM

useReplay('encoding', (v) => (input.value = String(v ?? '')))

/* 历史记录：有效结果停顿 1s 后写入（卸载自动清理） */
useHistRecorder('encoding', () => [input.value, direction.value, encoding.value, format.value, bom.value], (src) => {
  const [v, dir, enc, fmt, withBom] = src
  if (dir === 'decode') {
    const r = decodeText(v, enc, { format: fmt })
    return r.ok ? r.data : null
  }
  const r = encodeText(v, enc, { bom: withBom })
  if (!r.ok) return null
  return fmt === 'b64' ? toB64(r.bytes) : toHex(r.bytes)
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2） */
useMainResult(() => (out.value ? { value: out.value, label: '转换结果' } : null))

const directions = [
  { id: 'encode', label: '编码' },
  { id: 'decode', label: '解码' },
]

const formats = [
  { id: 'hex', label: 'Hex' },
  { id: 'b64', label: 'Base64' },
]

const res = computed(() => {
  if (!input.value) return { ok: false, empty: true }
  if (direction.value === 'decode') {
    return decodeText(input.value, encoding.value, { format: format.value })
  }
  const r = encodeText(input.value, encoding.value, { bom: bom.value })
  if (!r.ok) return r
  return {
    ok: true,
    data: format.value === 'b64' ? toB64(r.bytes) : toHex(r.bytes),
    byteLen: r.bytes.length,
  }
})
const err = computed(() => (res.value.error ? res.value.error : ''))
const out = computed(() => (res.value.ok ? res.value.data : ''))

const encodingLabel = computed(() => ENCODINGS.find((e) => e.id === encoding.value)?.label || '')
const directionLabel = computed(() => {
  if (!input.value) return '—'
  return direction.value === 'decode' ? `${format.value === 'b64' ? 'Base64' : 'Hex'} → 文本` : `文本 → ${encodingLabel.value} 字节`
})

const stat = computed(() => {
  if (!input.value || !res.value.ok) return ''
  if (direction.value === 'decode') return `输入 ${res.value.byteLen ?? ''} 字节`
  return `输出 ${res.value.byteLen ?? ''} 字节（${encodingLabel.value}）`
})

const byteExamples = computed(() =>
  direction.value === 'decode'
    ? ['C4 E3 BA C3', 'E4BDA0E5A5BD', '5L2g5aW9']
    : ['你好', 'hello', 'Hello, world'],
)

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
      <div class="seg" role="group" aria-label="方向">
        <button
          v-for="d in directions"
          :key="d.id"
          type="button"
          :aria-pressed="direction === d.id"
          @click="direction = d.id"
        >
          {{ d.label }}
        </button>
        <button
          v-if="direction === 'encode' && (encoding === 'utf16le' || encoding === 'utf16be')"
          type="button"
          :aria-pressed="bom"
          title="在字节开头附加 UTF-16 BOM（FF FE / FE FF）"
          @click="bom = !bom"
        >
          带 BOM
        </button>
      </div>

      <div class="seg" role="group" aria-label="编码" style="margin-top: 6px">
        <button
          v-for="e in ENCODINGS"
          :key="e.id"
          type="button"
          :aria-pressed="encoding === e.id"
          @click="encoding = e.id"
        >
          {{ e.label }}
        </button>
        <span style="width: 12px" aria-hidden="true"></span>
        <button
          v-for="f in formats"
          :key="f.id"
          type="button"
          :aria-pressed="format === f.id"
          :title="direction === 'decode' ? '输入字节的格式' : '字节输出的展示格式'"
          @click="format = f.id"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="block-head" style="margin-top: 8px">
        <label for="encInput">输入</label>
        <span class="tag">{{ directionLabel }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="encInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 88px"
        :placeholder="
          direction === 'decode'
            ? format === 'b64'
              ? '粘贴 Base64 字节串（如 5L2g5aW9），选择上方编码后解码为文本'
              : '粘贴 Hex 字节串（如 C4E3BAC3 或 C4 E3 BA C3），选择上方编码后解码为文本'
            : '输入文本，转换为所选编码的字节（Hex / Base64 展示）'
        "
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>结果</span>
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
              <button v-for="x in byteExamples" :key="x" type="button" class="example" @click="input = x">
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
