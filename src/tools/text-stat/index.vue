<script setup>
/**
 * 文本统计（PRD 4.5.3）
 * 字符数（含/不含空白）、单词数（中文按字计）、行数、UTF-8 字节数
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { textStats } from '../../utils/convert/textStat.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)

useReplay('text-stat', (v) => (input.value = String(v ?? '')))

/* 历史记录：停顿 1s 后写入（卸载自动清理）；输入全文交由 db.js 统一截断（5000 字符） */
useHistRecorder('text-stat', input, (v) => {
  const t = textStats(v)
  return t.chars ? `${t.chars} 字符 · ${t.words} 词` : null
})

const s = computed(() => textStats(input.value))

/** 一句话统计摘要（复制 / Ctrl+Enter 主结果） */
const summary = computed(() =>
  input.value
    ? `${s.value.chars} 字符 · ${s.value.words} 词 · ${s.value.lines} 行 · UTF-8 ${s.value.bytes} 字节`
    : '',
)
useMainResult(() => (summary.value ? { value: summary.value, label: '统计结果' } : null))

const rows = computed(() =>
  input.value
    ? [
        { k: '字符数', v: String(s.value.chars), aside: `不含空白 ${s.value.noSpace}` },
        { k: '单词数', v: String(s.value.words), aside: `中文按字计 ${s.value.cjkChars} · 词段 ${s.value.latinWords}` },
        { k: '行数', v: String(s.value.lines), aside: '' },
        { k: 'UTF-8 字节', v: String(s.value.bytes), aside: '' },
      ]
    : [],
)

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) input.value = String(p)
  inputEl.value?.focus()
})
</script>

<template>
  <div class="tool-body">
    <div class="block block--fill">
      <div class="block-head">
        <label for="statInput">输入文本</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="statInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        placeholder="粘贴文本，实时统计字符数、单词数、行数与 UTF-8 字节数"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span>统计结果</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!summary" @click="copyText(summary, '统计结果')">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <div v-if="rows.length">
        <div v-for="r in rows" :key="r.k" class="kv">
          <span class="k">{{ r.k }}</span>
          <span class="v">{{ r.v }}<span v-if="r.aside" class="aside">{{ r.aside }}</span></span>
        </div>
      </div>
      <div v-else class="panel-empty">
        输入文本后实时统计。
        <div class="examples">
          <button type="button" class="example" @click="input = 'Hello 世界，devtools kit 123'">Hello 世界，devtools kit 123</button>
        </div>
      </div>
    </div>
  </div>
</template>
