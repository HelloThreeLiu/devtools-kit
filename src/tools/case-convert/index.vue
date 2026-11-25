<script setup>
/**
 * 命名风格转换（PRD 4.5.2）
 * 任意风格输入 → 五种命名风格并行输出
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { convertNaming } from '../../utils/convert/naming.js'
import { copyText } from '../../utils/clipboard.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'

const input = ref('')
const inputEl = ref(null)

useReplay('case-convert', (v) => (input.value = String(v ?? '')))

let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const r = convertNaming(v)
    if (r.camel) recordHistory('case-convert', v, r.camel)
  }, 1000)
})

const res = computed(() => convertNaming(input.value))

const rows = computed(() => {
  if (!input.value.trim()) return []
  const r = res.value
  return [
    { k: 'camelCase', v: r.camel },
    { k: 'PascalCase', v: r.pascal },
    { k: 'snake_case', v: r.snake },
    { k: 'CONSTANT_CASE', v: r.constant },
    { k: 'kebab-case', v: r.kebab },
  ]
})

onMounted(() => inputEl.value?.focus())
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="block-head">
        <label for="caseInput">输入任意命名风格（camelCase / snake_case / kebab-case / 空格分词…）</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <div class="input-wrap">
        <input
          id="caseInput"
          ref="inputEl"
          v-model="input"
          class="input"
          placeholder="如 user_name、userName、hello world"
          autocomplete="off"
          spellcheck="false"
        />
        <button v-show="input" type="button" class="input-clear" aria-label="清空" title="清空" @click="input = ''">
          <Icon name="x" size="sm" />
        </button>
      </div>
    </div>

    <div class="panel" v-if="rows.length">
      <div class="panel-head"><span>转换结果</span></div>
      <div v-for="r in rows" :key="r.k" class="kv">
        <span class="k">{{ r.k }}</span>
        <span class="v">{{ r.v || '—' }}</span>
        <button type="button" class="icon-btn" :aria-label="`复制 ${r.k}`" :title="`复制 ${r.k}`" @click="copyText(r.v, r.k)">
          <Icon name="copy" size="sm" />
        </button>
      </div>
    </div>
    <div class="panel" v-else>
      <div class="panel-empty">
        输入任意风格的标识符或词组，同时得到五种命名风格。
        <div class="examples">
          <button v-for="x in ['user_name', 'userName', 'hello world', 'HTTPServer']" :key="x" type="button" class="example" @click="input = x">
            {{ x }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
