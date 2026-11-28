<script setup>
/**
 * JSON 格式化（PRD 4.3.4 / 技术设计 §11.5）
 * 自写校验器定位行:列 + 出错行摘录与定位动作；逐行渲染 + 节点折叠；
 * 超 5000 行截断显示，复制始终完整内容
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  byteLen,
  computeFolds,
  escapeJsonText,
  formatJson,
  highlightJson,
  rootSummary,
  unescapeJsonText,
} from '../../utils/convert/jsonFormat.js'
import { copyText } from '../../utils/clipboard.js'
import { utools, inUtoolsEnv } from '../../utils/utools.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const SAMPLE =
  '{"name":"devtools-kit","version":"1.0.0","description":"uTools 开发工具箱","tools":[{"id":"timestamp","p0":true},{"id":"base64","p0":true},{"id":"json","p0":true}],"meta":{"author":"HelloThreeLiu","stars":42,"active":true,"repo":null}}'

const MAX_LINES = 5000
const LARGE = 100 * 1024 // >100KB 输入 debounce 200ms（技术设计 §12）

const input = ref('')
const inputEl = ref(null)
const mode = ref('format') // format | escape | unescape（R1.6 JSON 转义/去转义）
const keepQuotes = ref(true) // 转义模式：保留外层双引号
const format = ref('2') // '2' | '4' | 'tab' | 'min'
const collapsed = ref(new Set())

useReplay('json', (v) => (input.value = String(v ?? '')))

const formats = [
  { id: '2', label: '2 空格' },
  { id: '4', label: '4 空格' },
  { id: 'tab', label: 'Tab' },
  { id: 'min', label: '压缩' },
]

const toolModes = [
  { id: 'format', label: '格式化' },
  { id: 'escape', label: '转义' },
  { id: 'unescape', label: '去转义' },
]

/* Ctrl+Enter 复制主结果（PRD 4.2-2）：复制完整结果（不受截断影响） */
useMainResult(() => (output.value ? { value: output.value, label: resultLabel.value } : null))

/* ---------- 校验与结果 ---------- */

const result = computed(() => {
  const src = effectiveInput.value
  if (!src.trim()) return { empty: true }
  if (mode.value === 'escape') return escapeJsonText(src, { quotes: keepQuotes.value })
  if (mode.value === 'unescape') return unescapeJsonText(src)
  return formatJson(src, format.value)
})

const err = computed(() => (result.value.ok === false ? result.value : null))
const output = computed(() => (result.value.ok ? result.value.data : ''))
const lines = computed(() => (mode.value === 'format' && output.value ? output.value.split('\n') : []))
const truncated = computed(() => lines.value.length > MAX_LINES)
/** 实际渲染的行（超长截断，复制始终用完整 output） */
const shown = computed(() => (truncated.value ? lines.value.slice(0, MAX_LINES) : lines.value))
// 折叠区间基于「渲染行」计算：闭合行在截断边界之外的节点不可折叠，
// 避免渲染 undefined（此前为崩溃源，见 docs/修复记录.md）
const folds = computed(() => computeFolds(shown.value))

const resultLabel = computed(() =>
  mode.value === 'escape' ? '转义结果' : mode.value === 'unescape' ? '去转义结果' : '格式化结果',
)

const placeholderText = computed(() => {
  if (mode.value === 'escape') return '输入任意文本，转义为 JSON 字符串字面量，如：他说:"hi"'
  if (mode.value === 'unescape') return '粘贴 JSON 转义串（可带 / 不带外层引号），还原为原文'
  return '粘贴 JSON 后自动格式化、校验并定位语法错误'
})

/** 渲染行模型：折叠行内联为「… N 行」标记 */
const renderRows = computed(() => {
  const rows = []
  const shownLines = shown.value
  const single = shownLines.length === 1
  for (let i = 0; i < shownLines.length; i++) {
    const isOpen = !single && folds.value.has(i)
    const folded = isOpen && collapsed.value.has(i)
    let code = highlightJson(shownLines[i])
    if (folded) {
      const close = folds.value.get(i)
      code += `<span class="fold-mark">… ${close - i - 1} 行</span><span class="ln-code-bracket">${highlightJson(shownLines[close].trim())}</span>`
      i = close
    }
    rows.push({ no: i + 1, code, foldable: isOpen, folded })
  }
  return rows
})

const rootText = computed(() =>
  mode.value === 'format' && result.value.ok ? `根节点：${rootSummary(result.value.parsed)}` : '',
)

/* ---------- 交互 ---------- */

function setMode(id) {
  mode.value = id
}

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
  copyText(output.value, resultLabel.value)
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

/* 大输入 debounce（技术设计 §12）：渲染链（result）经 effectiveInput 消费防抖后的值 */
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

/* 出错行摘录（行内错误附加说明）；仅 format 模式的结构化错误有 line/col（unescape 错误无行号，防御 NaN） */
const excerpt = computed(() => {
  const e = err.value
  if (!e || e.line === undefined) return null
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

/* 历史记录：有效结果停顿 1s 后写入（PRD 4.7.1，卸载自动清理）；转义/去转义同样记录 */
useHistRecorder('json', () => [effectiveInput.value, mode.value, keepQuotes.value, format.value], (src) => {
  const [v, m, q, f] = src
  if (!v || !v.trim()) return null
  if (m === 'escape') return escapeJsonText(v, { quotes: q }).data
  if (m === 'unescape') {
    const r = unescapeJsonText(v)
    return r.ok ? r.data : null
  }
  const r = formatJson(v, f)
  return r.ok ? r.data : null
})

/* 大内容增高窗口（技术设计 §4：JSON 按需 setExpandHeight(600)，恢复默认 544） */
let expanded = false
watch(
  () => lines.value.length,
  (n) => {
    if (!inUtoolsEnv || typeof utools.setExpandHeight !== 'function') return
    const need = n > 20
    if (need === expanded) return
    expanded = need
    try {
      utools.setExpandHeight(need ? 600 : 544)
    } catch (e) {
      expanded = !need // 自定义窗口等场景不支持，回滚状态
    }
  },
)

onMounted(() => {
  const p = consumeEnterPayload()
  input.value = p ? String(p) : SAMPLE
  inputEl.value?.focus()
})

onUnmounted(() => {
  clearTimeout(timer)
  if (expanded) {
    try {
      utools.setExpandHeight(544)
    } catch (e) {
      /* 忽略 */
    }
  }
})
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="block-head">
        <div class="seg" role="group" aria-label="工具模式">
          <button
            v-for="m in toolModes"
            :key="m.id"
            type="button"
            :aria-pressed="mode === m.id"
            @click="setMode(m.id)"
          >
            {{ m.label }}
          </button>
          <button
            v-if="mode === 'escape'"
            type="button"
            :aria-pressed="keepQuotes"
            title="转义结果保留外层双引号（完整 JSON 字符串字面量）"
            @click="keepQuotes = !keepQuotes"
          >
            外层引号
          </button>
        </div>
        <span class="grow"></span>
        <span v-if="!input" class="tag">待输入</span>
        <span v-else-if="mode === 'format' && err" class="tag tag--err">
          <Icon name="alert" size="xs" />语法错误 · 第 {{ err.line }} 行
        </span>
        <span v-else-if="mode === 'format'" class="tag tag--ok"><Icon name="check" size="xs" />合法 JSON</span>
        <span v-else-if="mode === 'escape'" class="tag">文本 → JSON 字符串</span>
        <span v-else class="tag">转义串 → 原文</span>
      </div>

      <div v-if="mode === 'format'" class="seg" role="group" aria-label="输出格式" style="margin-top: 6px">
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

      <div class="block-head" style="margin-top: 8px">
        <label for="jsonInput">输入</label>
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
        :placeholder="placeholderText"
        spellcheck="false"
      ></textarea>

      <div v-if="mode === 'unescape' && err" class="alert" role="alert">
        <Icon name="alert" />
        <span>{{ err.error }}</span>
      </div>
      <div v-else-if="mode === 'format' && err" class="alert alert--stack" role="alert">
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
        <span>{{ resultLabel }}</span>
        <span class="grow"></span>
        <template v-if="mode === 'format' && lines.length > 1">
          <button type="button" class="btn btn--ghost" @click="setAllFolded(true)">全部折叠</button>
          <button type="button" class="btn btn--ghost" @click="setAllFolded(false)">全部展开</button>
        </template>
        <button type="button" class="btn btn--ghost" :disabled="!output" @click="onCopy">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>

      <div class="pane" :class="{ 'pane--text': mode !== 'format' }">
        <div class="pane-scroll">
          <div v-if="!input" class="placeholder">
            {{
              mode === 'escape'
                ? '输入任意文本后自动转义。'
                : mode === 'unescape'
                  ? '粘贴转义串后自动还原。'
                  : '粘贴 JSON 后自动格式化。'
            }}
          </div>
          <div v-else-if="err" class="placeholder">修正输入后，结果会显示在这里。</div>
          <div v-else-if="mode !== 'format'">
            <span style="white-space: pre-wrap; word-break: break-all">{{ output }}</span>
          </div>
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
