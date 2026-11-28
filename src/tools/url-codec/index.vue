<script setup>
/**
 * URL 编解码（PRD 4.3.3；R1.1 智能模式 + 宽容解码）
 * 解码（宽容模式，非法 % 序列按字面保留并提示）/
 * 编码智能模式（http(s):// 开头走 encodeURI，其余全编码）/ Component / URI；
 * 完整 URL 额外给出结构化解析
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { decodeUrl, encodeUrl, parseUrl } from '../../utils/convert/urlCodec.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const mode = ref('decode') // decode | smart | component | uri

useReplay('url-codec', (v) => (input.value = String(v ?? '')))

/* 历史记录：有效结果停顿 1s 后写入（卸载自动清理） */
useHistRecorder('url-codec', input, (v) => {
  const r = mode.value === 'decode' ? decodeUrl(v) : encodeUrl(v, mode.value)
  return r.ok ? r.data : null
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2） */
useMainResult(() => (out.value ? { value: out.value, label: '结果' } : null))

const modes = [
  { id: 'decode', label: '解码' },
  { id: 'smart', label: '编码 · 智能' },
  { id: 'component', label: '编码 · Component' },
  { id: 'uri', label: '编码 · URI' },
]

const res = computed(() => {
  if (!input.value) return { ok: false, empty: true }
  return mode.value === 'decode' ? decodeUrl(input.value) : encodeUrl(input.value, mode.value)
})
const err = computed(() => res.value.error || '')
const out = computed(() => (res.value.ok ? res.value.data : ''))
const partial = computed(() => res.value.partial === true)

const parsed = computed(() => parseUrl(input.value))

const directionLabel = computed(() => {
  if (!input.value) return '—'
  if (mode.value === 'decode') return '解码'
  if (mode.value === 'smart') {
    return res.value.resolvedMode === 'uri' ? '智能 → encodeURI' : '智能 → Component'
  }
  return '编码'
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
        <label for="urlInput">输入</label>
        <span class="tag">{{ directionLabel }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="urlInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 72px"
        placeholder="输入 URL 或含 % 转义的文本&#10;编码 · 智能模式：http(s):// 开头保留 URL 结构，其余全编码&#10;完整 URL 会额外解析出协议、主机与参数表"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="block">
      <div class="block-head">
        <span>结果</span>
        <span
          v-if="partial"
          class="tag"
          title="非法的 % 序列已按原文保留，其余内容正常解码"
        >部分内容无法解码</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!out" @click="copyText(out, '结果')">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <div v-if="!input" class="placeholder">
            输入内容后自动转换。
            <div class="examples">
              <button
                v-for="x in ['https://a.com/?kw=你好', '%E4%BD%A0%E5%A5%BD']"
                :key="x"
                type="button"
                class="example"
                @click="input = x"
              >
                {{ x }}
              </button>
            </div>
          </div>
          <span v-else-if="err">—</span>
          <template v-else>{{ out }}</template>
        </div>
      </div>
    </div>

    <!-- 完整 URL 结构化解析（PRD 4.3.3） -->
    <div v-if="parsed" class="panel">
      <div class="panel-head"><span>URL 结构</span></div>
      <div class="kv">
        <span class="k">协议</span><span class="v">{{ parsed.protocol }}</span>
      </div>
      <div class="kv">
        <span class="k">主机</span><span class="v">{{ parsed.hostname }}</span>
      </div>
      <div v-if="parsed.port" class="kv">
        <span class="k">端口</span><span class="v">{{ parsed.port }}</span>
      </div>
      <div class="kv">
        <span class="k">路径</span><span class="v">{{ parsed.pathname }}</span>
      </div>
      <div v-if="parsed.hash" class="kv">
        <span class="k">锚点</span><span class="v">{{ parsed.hash }}</span>
      </div>
      <template v-if="parsed.params.length">
        <div v-for="([k, v], idx) in parsed.params" :key="`${k}=${v}#${idx}`" class="kv">
          <span class="k">{{ k }}</span>
          <span class="v">{{ v }}</span>
          <button type="button" class="icon-btn" :aria-label="`复制参数 ${k}`" title="复制参数值" @click="copyText(v, k)">
            <Icon name="copy" size="sm" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
