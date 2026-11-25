<script setup>
/**
 * 进制转换（PRD 4.3.5）
 * 2/8/10/16 进制互转；0b/0o/0x 前缀自动识别；BigInt 大数安全；36 进制只读输出
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { convertRadix } from '../../utils/convert/radix.js'
import { copyText } from '../../utils/clipboard.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'

const input = ref('')
const inputEl = ref(null)
const base = ref('auto') // 'auto' | 2 | 8 | 10 | 16

useReplay('radix', (v) => setInput(String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const r = convertRadix(v, base.value === 'auto' ? 10 : base.value)
    if (r.ok) recordHistory('radix', v, r.outputs.dec)
  }, 1000)
})

const bases = [
  { id: 'auto', label: '自动' },
  { id: 2, label: '2 进制' },
  { id: 8, label: '8 进制' },
  { id: 10, label: '10 进制' },
  { id: 16, label: '16 进制' },
]

const res = computed(() => convertRadix(input.value, base.value === 'auto' ? 10 : base.value))
const err = computed(() => (res.value.ok === false && !res.value.empty ? res.value.error : ''))

const rows = computed(() => {
  if (!res.value.ok) return []
  const o = res.value.outputs
  return [
    { key: 'bin', k: '二进制', v: o.bin },
    { key: 'oct', k: '八进制', v: o.oct },
    { key: 'dec', k: '十进制', v: o.dec },
    { key: 'hex', k: '十六进制', v: o.hex },
    { key: 'b36', k: '三十六进制', v: o.b36 },
  ]
})

const affix = computed(() => {
  if (!res.value.ok) return ''
  const name = { 2: '二', 8: '八', 10: '十', 16: '十六' }[res.value.base]
  return (res.value.detected ? '前缀识别 · ' : '') + `${name}进制`
})

const baseName = computed(() => {
  if (base.value === 'auto') return { 2: '二', 8: '八', 10: '十', 16: '十六' }[res.value.base] || '十'
  return { 2: '二', 8: '八', 10: '十', 16: '十六' }[base.value]
})

function setInput(v) {
  input.value = v
  inputEl.value?.focus()
}

onMounted(() => inputEl.value?.focus())
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="seg" role="group" aria-label="输入进制">
        <button
          v-for="b in bases"
          :key="String(b.id)"
          type="button"
          :aria-pressed="base === b.id"
          @click="base = b.id"
        >
          {{ b.label }}
        </button>
      </div>

      <div class="block-head">
        <label for="radixInput">输入整数（支持负号与 0b / 0o / 0x 前缀）</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="setInput('')">清空</button>
      </div>
      <div class="input-wrap">
        <input
          id="radixInput"
          ref="inputEl"
          v-model="input"
          class="input"
          placeholder="如 255、0xff、-42"
          autocomplete="off"
          spellcheck="false"
          :aria-invalid="err ? 'true' : undefined"
          aria-describedby="radixErr"
        />
        <span v-if="input && res.ok" class="input-affix" aria-hidden="true">
          <Icon name="check" />
          {{ affix }}
        </span>
        <button v-show="input" type="button" class="input-clear" aria-label="清空" title="清空" @click="setInput('')">
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div id="radixErr" class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="panel" v-if="res.ok">
      <div class="panel-head">
        <span>转换结果（{{ baseName }}进制输入）</span>
        <span v-if="res.warning" class="tag">{{ res.warning }}</span>
        <span class="grow"></span>
      </div>
      <div v-for="r in rows" :key="r.key" class="kv">
        <span class="k">{{ r.k }}</span>
        <span class="v">{{ r.v }}</span>
        <button type="button" class="icon-btn" :aria-label="`复制${r.k}`" :title="`复制${r.k}`" @click="copyText(r.v, r.k)">
          <Icon name="copy" size="sm" />
        </button>
      </div>
    </div>
    <div class="panel" v-else>
      <div class="panel-empty">
        输入一个整数，同时得到二 / 八 / 十 / 十六 / 三十六进制的全部结果。
        <div class="examples">
          <button v-for="x in ['255', '0xff', '-42']" :key="x" type="button" class="example" @click="setInput(x)">
            {{ x }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
