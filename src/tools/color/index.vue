<script setup>
/**
 * 颜色格式转换（PRD 4.6.1）
 * HEX / RGB / HSL 互转 + alpha + 预览色块 + CSS 变量代码片段
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { formatColor, parseColor } from '../../utils/convert/color.js'
import { copyText } from '../../utils/clipboard.js'
import { utools, inUtoolsEnv } from '../../utils/utools.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)

useReplay('color', (v) => (input.value = String(v ?? '')))

/* 历史记录：有效结果停顿 1s 后写入（卸载自动清理） */
useHistRecorder('color', input, (v) => {
  const r = parseColor(v)
  return r.ok ? formatColor(r.color).hex : null
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2）：HEX */
useMainResult(() => (fmt.value ? { value: fmt.value.hex, label: 'HEX' } : null))

const res = computed(() => parseColor(input.value))
const fmt = computed(() => (res.value.ok ? formatColor(res.value.color) : null))
const err = computed(() => res.value.error || '')

/* ---------- 拾色器（PRD 4.6.1：点击弹出系统颜色选择） ---------- */
// type=color 只接受 #rrggbb；带 alpha 时取不透明部分用于回显
const pickerHex = computed(() => (fmt.value ? fmt.value.hex.slice(0, 7) : '#1e80ff'))

function onPick(e) {
  input.value = e.target.value // #rrggbb，parseColor 可直接解析
}

/* ---------- 屏幕取色（uTools 全屏吸管；浏览器调试降级 EyeDropper API） ---------- */
// uTools：宿主提供全屏取色模式；浏览器：仅 Chrome/Edge 支持 EyeDropper
const pickSupported = inUtoolsEnv
  ? typeof utools.screenColorPick === 'function'
  : typeof window !== 'undefined' && typeof window.EyeDropper === 'function'
const picking = ref(false)

// v7.x 宿主取消取色时回调与 Promise 都无信号，超时后恢复按钮可用（审查 I-2）
const PICK_TIMEOUT = 60000

async function pickFromScreen() {
  if (!pickSupported || picking.value) return
  picking.value = true
  try {
    // 双形态桥接：v7.x 仅支持回调式，v8+ 返回 Promise（取消时 reject）；
    // 两种形态可能同时触发，用 settled 去重；超时兜底保证 v7 取消后按钮可恢复。
    const c = await new Promise((resolve) => {
      let settled = false
      let timer = null
      const done = (color) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(color)
      }
      timer = setTimeout(() => done(null), PICK_TIMEOUT)
      try {
        const p = utools.screenColorPick((color) => done(color))
        if (p && typeof p.then === 'function') p.then(done, () => done(null))
      } catch (e) {
        done(null)
      }
    })
    if (c?.hex) {
      input.value = c.hex // #rrggbb，parseColor 可直接解析
      inputEl.value?.focus()
    }
    /* 取消 / 超时 / 无结果 → 静默 */
  } finally {
    picking.value = false
  }
}

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
        <button
          type="button"
          class="btn"
          :disabled="!pickSupported || picking"
          :title="pickSupported ? '屏幕取色：吸取屏幕任意位置的颜色' : '当前环境不支持屏幕取色'"
          aria-label="屏幕取色"
          @click="pickFromScreen"
        >
          <Icon name="pipette" size="sm" />
          {{ picking ? '取色中…' : '屏幕取色' }}
        </button>
        <input
          type="color"
          class="swatch"
          :value="pickerHex"
          title="拾色器：点击弹出颜色选择"
          aria-label="拾色器"
          @input="onPick"
        />
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
/* 拾色器：input[type=color] 即预览色块，点击弹系统颜色选择 */
.swatch {
  flex: none;
  width: var(--h-input);
  height: var(--h-input);
  padding: 0;
  border: 1px solid var(--border-control);
  border-radius: var(--radius);
  background: none;
  cursor: pointer;
}
.swatch::-webkit-color-swatch-wrapper {
  padding: 0;
}
.swatch::-webkit-color-swatch {
  border: none;
  border-radius: inherit;
}
</style>
