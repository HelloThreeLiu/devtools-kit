<script setup>
/**
 * 颜色格式转换（PRD 4.6.1）
 * HEX / RGB / HSL 互转 + alpha + 预览色块 + CSS 变量代码片段
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { formatColor, parseColor } from '../../utils/convert/color.js'
import { copyText } from '../../utils/clipboard.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)

useReplay('color', (v) => (input.value = String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const r = parseColor(v)
    if (r.ok) recordHistory('color', v, formatColor(r.color).hex)
  }, 1000)
})

const res = computed(() => parseColor(input.value))
const fmt = computed(() => (res.value.ok ? formatColor(res.value.color) : null))
const err = computed(() => res.value.error || '')

const swatchStyle = computed(() => {
  if (!fmt.value) return { background: 'var(--surface-2)' }
  const { r, g, b, a } = res.value.color
  return a < 1
    ? { background: `linear-gradient(45deg, rgba(${r},${g},${b},${a}) 50%, rgba(${r},${g},${b},0.25) 50%)` }
    : { background: `rgb(${r}, ${g}, ${b})` }
})

const rows = computed(() => {
  if (!fmt.value) return []
  return [
    { k: 'HEX', v: fmt.value.hex },
    { k: 'RGB', v: fmt.value.rgb },
    { k: 'HSL', v: fmt.value.hsl },
    { k: 'CSS 变量', v: fmt.value.cssVar },
  ]
})

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) input.value = String(p)
  inputEl.value?.focus()
})
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="block-head">
        <label for="colorInput">输入颜色（#HEX / rgb() / hsl()，支持 alpha）</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <div class="field-row">
        <div class="input-wrap">
          <input
            id="colorInput"
            ref="inputEl"
            v-model="input"
            class="input"
            placeholder="如 #1E80FF、rgb(30,128,255)、hsl(214,100%,56%)"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="err ? 'true' : undefined"
            aria-describedby="colorErr"
          />
        </div>
        <div class="swatch" :style="swatchStyle" :title="fmt ? fmt.hex : '预览'"></div>
      </div>
      <div id="colorErr" class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="panel" v-if="fmt">
      <div class="panel-head">
        <span>转换结果</span>
        <span v-if="res.color.a < 1" class="tag">透明度 {{ res.color.a }}</span>
        <span class="grow"></span>
      </div>
      <div v-for="r in rows" :key="r.k" class="kv">
        <span class="k">{{ r.k }}</span>
        <span class="v">{{ r.v }}</span>
        <button type="button" class="icon-btn" :aria-label="`复制 ${r.k}`" :title="`复制 ${r.k}`" @click="copyText(r.v, r.k)">
          <Icon name="copy" size="sm" />
        </button>
      </div>
    </div>
    <div class="panel" v-else-if="!err">
      <div class="panel-empty">
        输入一种颜色格式，同时得到 HEX / RGB / HSL 与 CSS 变量代码。
        <div class="examples">
          <button v-for="x in ['#1E80FF', '#1e80ff80', 'rgb(30,128,255)']" :key="x" type="button" class="example" @click="input = x">
            {{ x }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swatch {
  flex: none;
  width: var(--h-input);
  height: var(--h-input);
  border: 1px solid var(--border-control);
  border-radius: var(--radius);
}
</style>
