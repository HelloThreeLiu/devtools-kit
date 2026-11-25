<script setup>
/**
 * 哈希计算（PRD 4.3.6）
 * MD5 / SHA-1 / SHA-256 / SHA-512 并行输出；经 preload node:crypto（浏览器 mock 为
 * Web Crypto + 纯 JS MD5）；大小写展示切换，默认小写
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { services } from '../../utils/utools.js'
import { copyText } from '../../utils/clipboard.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const upper = ref(false)
const loading = ref(false)
const hashes = ref({ md5: '', sha1: '', sha256: '', sha512: '' })
let seq = 0 // 防止慢请求晚到覆盖新结果

useReplay('hash', (v) => (input.value = String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    if (v) services.hash(v, 'md5').then((h) => recordHistory('hash', v, `md5: ${h}`)).catch(() => {})
  }, 1000)
})

const rows = computed(() => {
  const c = upper.value
  const f = (h) => (c ? h.toUpperCase() : h)
  return [
    { key: 'md5', k: 'MD5', v: f(hashes.value.md5) },
    { key: 'sha1', k: 'SHA-1', v: f(hashes.value.sha1) },
    { key: 'sha256', k: 'SHA-256', v: f(hashes.value.sha256) },
    { key: 'sha512', k: 'SHA-512', v: f(hashes.value.sha512) },
  ]
})

async function run() {
  const my = ++seq
  const text = input.value
  if (!text) {
    hashes.value = { md5: '', sha1: '', sha256: '', sha512: '' }
    loading.value = false
    return
  }
  loading.value = true
  const algos = ['md5', 'sha1', 'sha256', 'sha512']
  const settled = await Promise.allSettled(algos.map((a) => services.hash(text, a)))
  if (my !== seq) return // 已有更新的输入
  const next = {}
  algos.forEach((a, i) => {
    next[a] = settled[i].status === 'fulfilled' ? settled[i].value : '不可用'
  })
  hashes.value = next
  loading.value = false
  const md5v = next.md5
  if (md5v && md5v !== '不可用') recordHistory('hash', text, `md5: ${md5v}`)
}

watch(input, () => run())
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
        <label for="hashInput">输入文本（UTF-8）</label>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="大小写">
          <button type="button" :aria-pressed="!upper" @click="upper = false">小写</button>
          <button type="button" :aria-pressed="upper" @click="upper = true">大写</button>
        </div>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="hashInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 72px"
        placeholder="输入任意文本，四种算法并行计算"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span>摘要结果</span>
        <span v-if="loading" class="tag">计算中…</span>
        <span class="grow"></span>
      </div>
      <div v-if="!input" class="panel-empty">输入文本后自动计算 MD5 / SHA-1 / SHA-256 / SHA-512。</div>
      <template v-else>
        <div v-for="r in rows" :key="r.key" class="kv">
          <span class="k">{{ r.k }}</span>
          <span class="v">{{ r.v || '…' }}</span>
          <button
            type="button"
            class="icon-btn"
            :disabled="!r.v"
            :aria-label="`复制 ${r.k} 摘要`"
            :title="`复制 ${r.k} 摘要`"
            @click="copyText(r.v, r.k)"
          >
            <Icon name="copy" size="sm" />
          </button>
        </div>
      </template>
    </div>
  </div>

  <footer class="statusbar">
    <span>哈希在本地计算，不会上传任何内容</span>
  </footer>
</template>
