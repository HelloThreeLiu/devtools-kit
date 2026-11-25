<script setup>
/**
 * JSON 格式化（PRD 4.3.4 / 技术设计 §11.5）
 * 自写校验器定位行:列 + 出错行摘录与定位动作；逐行渲染 + 节点折叠；
 * 超 5000 行截断显示，复制始终完整内容
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  byteLen,
  computeFolds,
  formatJson,
  highlightJson,
  rootSummary,
} from '../../utils/convert/jsonFormat.js'
import { copyText } from '../../utils/clipboard.js'

const SAMPLE =
  '{"name":"devtools-kit","version":"1.0.0","description":"uTools 开发工具箱","tools":[{"id":"timestamp","p0":true},{"id":"base64","p0":true},{"id":"json","p0":true}],"meta":{"author":"HelloThreeLiu","stars":42,"active":true,"repo":null}}'

const MAX_LINES = 5000
const LARGE = 100 * 1024 // >100KB 输入 debounce 200ms（技术设计 §12）

const input = ref('')
const inputEl = ref(null)
const format = ref('2') // '2' | '4' | 'tab' | 'min'
const collapsed = ref(new Set())

const formats = [
  { id: '2', label: '2 空格' },
  { id: '4', label: '4 空格' },
  { id: 'tab', label: 'Tab' },
  { id: 'min', label: '压缩' },
]

/* ---------- 校验与结果 ---------- */

const result = computed(() => {
  const src = input.value
  if (!src.trim()) return { empty: true }
  return formatJson(src, format.value)
})

const err = computed(() => (result.value.ok === false ? result.value : null))
const output = computed(() => (result.value.ok ? result.value.data : ''))
const lines = computed(() => (output.value ? output.value.split('\n') : []))
const folds = computed(() => computeFolds(lines.value))
const truncated = computed(() => lines.value.length > MAX_LINES)

/** 渲染行模型：折叠行内联为「… N 行」标记 */
const renderRows = computed(() => {
  const rows = []
  const shown = truncated.value ? lines.value.slice(0, MAX_LINES) : lines.value
  const single = shown.length === 1
  for (let i = 0; i < shown.length; i++) {
    const isOpen = !single && folds.value.has(i)
    const folded = isOpen && collapsed.value.has(i)
    let code = highlightJson(shown[i])
    if (folded) {
      const close = folds.value.get(i)
      code += `<span class="fold-mark">… ${close - i - 1} 行</span><span class="ln-code-bracket">${highlightJson(shown[close].trim())}</span>`
      i = close
    }
    rows.push({ no: i + 1, code, foldable: isOpen, folded })
  }
  return rows
})

const rootText = computed(() =>
  result.value.ok ? `根节点：${rootSummary(result.value.parsed)}` : '',
)

/* ---------- 交互 ---------- */

function toggleFold(no) {
  const idx = no - 1
  const set = new Set(collapsed.value)
  set.has(idx) ? set.delete(idx) : set.add(idx)
  collapsed.value = set
}

function setAllFolded(v) {
  collapsed.value = v ? new Set(folds.value.keys()) : new Set()
}

function locateError() {
  const e = err.value
  if (!e || !inputEl.value) return
  inputEl.value.focus()
  inputEl.value.setSelectionRange(e.pos, Math.min(e.pos + 1, input.value.length))
}

function onCopy() {
  copyText(output.value, '格式化结果')
}

function loadSample() {
  input.value = SAMPLE
  inputEl.value?.focus()
}

function clearInput() {
  input.value = ''
  collapsed.value = new Set()
  inputEl.value?.focus()
}

/* 大输入 debounce（技术设计 §12） */
let timer = null
const debouncedInput = ref('')
watch(input, (v) => {
  if (byteLen(v) <= LARGE) {
    debouncedInput.value = v
    return
  }
  clearTimeout(timer)
  timer = setTimeout(() => {
    debouncedInput.value = v
  }, 200)
})
const effectiveInput = computed(() => (byteLen(input.value) <= LARGE ? input.value : debouncedInput.value))

/* 出错行摘录（行内错误附加说明） */
const excerpt = computed(() => {
  const e = err.value
  if (!e) return null
  const text = input.value.split('\n')[e.line - 1] || ''
  const HALF = 40
  const start = Math.max(0, e.col - 1 - HALF)
  const end = Math.min(text.length, start + HALF * 2)
  const pre = start > 0 ? '…' : ''
  const caretAt = pre.length + Math.max(0, e.col - 1 - start)
  return {
    text: pre + text.slice(start, end),
    caretAt,
  }
})

/* 输入变化时重置折叠 */
watch(effectiveInput, () => {
  collapsed.value = new Set()
})

onMounted(() => {
  input.value = SAMPLE
  inputEl.value?.focus()
})
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="block-head">
        <div class="seg" role="group" aria-label="输出格式">
          <button
            v-for="f in formats"
            :key="f.id"
            type="button"
            :aria-pressed="format === f.id"
            @click="format = f.id"
          >
            {{ f.label }}
          </button>
        </div>
        <span class="grow"></span>
        <span v-if="!input" class="tag">待输入</span>
        <span v-else-if="err" class="tag tag--err">
          <Icon name="alert" size="xs" />语法错误 · 第 {{ err.line }} 行
        </span>
        <span v-else class="tag tag--ok"><Icon name="check" size="xs" />合法 JSON</span>
      </div>

      <div class="block-head" style="margin-top: 2px">
        <label for="jsonInput">输入 JSON</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="loadSample">示例</button>
        <button type="button" class="btn btn--ghost" @click="clearInput">清空</button>
      </div>
      <textarea
        id="jsonInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 96px"
        placeholder="粘贴 JSON 后自动格式化、校验并定位语法错误"
        spellcheck="false"
      ></textarea>

      <div v-if="err" class="alert alert--stack" role="alert">
        <Icon name="alert" />
        <div class="alert-body">
          第 {{ err.line }} 行第 {{ err.col }} 列：{{ err.reason }}
          <pre v-if="excerpt" class="excerpt" aria-hidden="true"><code>{{ excerpt.text || ' ' }}</code>
{{ ' '.repeat(excerpt.caretAt) }}<span class="caret">^</span></pre>
        </div>
        <button type="button" class="act" @click="locateError">定位到出错位置</button>
      </div>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>格式化结果</span>
        <span class="grow"></span>
        <template v-if="lines.length > 1">
          <button type="button" class="btn btn--ghost" @click="setAllFolded(true)">全部折叠</button>
          <button type="button" class="btn btn--ghost" @click="setAllFolded(false)">全部展开</button>
        </template>
        <button type="button" class="btn btn--ghost" :disabled="!output" @click="onCopy">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>

      <div class="pane">
        <div class="pane-scroll">
          <div v-if="!input" class="placeholder">粘贴 JSON 后自动格式化。</div>
          <div v-else-if="err" class="placeholder">修正输入后，格式化结果会显示在这里。</div>
          <div v-else class="json">
            <div
              v-for="row in renderRows"
              :key="row.no"
              class="ln"
              :class="{ 'is-folded': row.folded }"
            >
              <span class="ln-no" aria-hidden="true">{{ row.no }}</span>
              <button
                v-if="row.foldable"
                type="button"
                class="ln-toggle"
                :aria-expanded="!row.folded"
                :aria-label="`${row.folded ? '展开' : '折叠'}第 ${row.no} 行`"
                :title="row.folded ? '展开' : '折叠'"
                @click="toggleFold(row.no)"
              >
                <Icon name="chevron-right" size="xs" />
              </button>
              <span v-else class="ln-gutter" aria-hidden="true"></span>
              <!-- eslint-disable-next-line vue/no-v-html —— 内容均经 esc() 转义 -->
              <span class="ln-code" v-html="row.code"></span>
            </div>
            <div v-if="truncated" class="ln">
              <span class="ln-no"></span>
              <span class="ln-gutter"></span>
              <span class="pane-note">共 {{ lines.length }} 行，仅显示前 {{ MAX_LINES }} 行；复制仍为完整内容</span>
            </div>
          </div>
        </div>
        <div class="pane-foot">
          {{ lines.length ? `${lines.length} 行 · ${byteLen(input)} B` : '' }}{{ rootText ? ` · ${rootText}` : '' }}
        </div>
      </div>
    </div>
  </div>
</template>
