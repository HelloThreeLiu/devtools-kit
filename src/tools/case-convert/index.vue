<script setup>
/**
 * 命名风格转换（PRD 4.5.2）
 * 任意风格输入 → 五种命名风格并行输出
 */
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { convertNaming } from '../../utils/convert/naming.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)

useReplay('case-convert', (v) => (input.value = String(v ?? '')))

/* 历史记录：有效结果停顿 1s 后写入（卸载自动清理） */
useHistRecorder('case-convert', input, (v) => {
  const r = convertNaming(v)
  return r.camel || null
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2）：camelCase */
useMainResult(() => (res.value.camel ? { value: res.value.camel, label: 'camelCase' } : null))

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
        <button v-show="input" type="button" class="input-clear" aria-label="清空" title="清空" @click="input = ''; inputEl?.focus()">
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
