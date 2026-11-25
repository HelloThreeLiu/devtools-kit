<script setup>
/**
 * 文本统计（PRD 4.5.3）
 * 字符数（含/不含空白）、单词数（中文按字计）、行数、UTF-8 字节数
 */
import { computed, onMounted, ref, watch } from 'vue'
import { textStats } from '../../utils/convert/textStat.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'

const input = ref('')
const inputEl = ref(null)

useReplay('text-stat', (v) => (input.value = String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const s = textStats(v)
    if (s.chars) recordHistory('text-stat', v.slice(0, 80), `${s.chars} 字符 · ${s.words} 词`)
  }, 1000)
})

const s = computed(() => textStats(input.value))

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

onMounted(() => inputEl.value?.focus())
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
      <div class="panel-head"><span>统计结果</span></div>
      <div v-if="rows.length">
        <div v-for="r in rows" :key="r.k" class="kv">
          <span class="k">{{ r.k }}</span>
          <span class="v">{{ r.v }}<span v-if="r.aside" class="aside">{{ r.aside }}</span></span>
        </div>
      </div>
      <div v-else class="panel-empty">输入文本后实时统计。</div>
    </div>
  </div>
</template>
