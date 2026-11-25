<script setup>
/**
 * 时间戳转换（PRD 4.3.1 v0.3 / 技术设计 §11.1）
 * 单输入框方向自动识别；转换逻辑全部在 utils/convert/timestamp.js 纯函数中
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  analyze,
  fmtDate,
  fmtLocal,
  fmtUTC,
  relTime,
  zoneLabel,
} from '../../utils/convert/timestamp.js'
import { copyText } from '../../utils/clipboard.js'
import { recordHistory } from '../../utils/db.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const nowTick = ref(Date.now())
const zone = zoneLabel()

/* 历史回填：点击历史记录后回到本工具并恢复输入 */
useReplay('timestamp', (v) => setInput(String(v ?? '')))

/* 历史记录：有效结果停顿 1s 后写入（PRD 4.7.1） */
let histTimer = null
watch(input, (v) => {
  clearTimeout(histTimer)
  histTimer = setTimeout(() => {
    const r = analyze(v)
    if (r.kind === 'ts' || r.kind === 'date') recordHistory('timestamp', v, fmtLocal(new Date(r.ms)))
  }, 1000)
})

const res = computed(() => analyze(input.value))
const isValue = computed(() => res.value.kind === 'ts' || res.value.kind === 'date')
const err = computed(() => (res.value.kind === 'error' ? res.value : null))

/* 同一时刻的全部表示；标出哪一项来自输入 */
const values = computed(() => {
  if (!isValue.value) return null
  const d = new Date(res.value.ms)
  return {
    local: fmtLocal(d),
    utc: fmtUTC(d),
    iso: d.toISOString(),
    sec: String(Math.floor(res.value.ms / 1000)),
    ms: String(res.value.ms),
    rel: relTime(res.value.ms, nowTick.value),
    weekday: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()],
  }
})

const mainValue = computed(() => {
  if (!values.value) return ''
  return res.value.kind === 'date' ? values.value.sec : values.value.local
})

const mainLabel = computed(() => (res.value.kind === 'date' ? '秒级时间戳' : '本地时间'))

/* ---------- 输入交互 ---------- */

function setInput(v) {
  input.value = v
  // 焦点留在输入框：粘贴与快捷键不中断
  inputEl.value?.focus()
  inputEl.value?.setSelectionRange(v.length, v.length)
}
const clear = () => setInput('')
const fillNow = () => setInput(fmtLocal(new Date()))
const fillToday = () => setInput(fmtDate(new Date()))

function onCopy(key) {
  copyText(values.value[key], { local: '本地时间', utc: 'UTC 时间', iso: 'ISO 8601', sec: '秒级时间戳', ms: '毫秒级时间戳', rel: '相对时间' }[key])
}

function onKeydown(e) {
  // Ctrl+Enter 复制主结果（PRD 4.2-2）：时间戳 → 本地时间，日期 → 秒级时间戳
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && mainValue.value) {
    e.preventDefault()
    copyText(mainValue.value, mainLabel.value)
  }
}

/* ---------- 当前时间戳实时条（每秒刷新，卸载清理） ---------- */

const nowSec = ref('')
const nowMs = ref('')
let timer = null

function tick() {
  const n = Date.now()
  nowTick.value = n
  nowSec.value = String(Math.floor(n / 1000))
  nowMs.value = String(n)
}

onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
  // 匹配指令携载预填（PRD 4.8.2）
  const p = consumeEnterPayload()
  if (p) setInput(String(p))
  else {
    // 呼起即聚焦，Ctrl+V 直接粘贴（PRD 4.2-3）
    inputEl.value?.focus()
    inputEl.value?.select()
  }
})
onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(histTimer)
})
</script>

<template>
  <div class="tool-body" @keydown="onKeydown">
    <!-- 输入区：时间戳与日期自动识别方向，无需切换模式 -->
    <div class="block">
      <div class="block-head">
        <label for="tsInput">时间戳或日期</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="fillNow">填入现在</button>
        <button type="button" class="btn btn--ghost" @click="fillToday">填入今天</button>
      </div>
      <div class="input-wrap">
        <input
          id="tsInput"
          ref="inputEl"
          v-model="input"
          class="input"
          placeholder="如 1735689600000 或 2025-01-01 08:00:00"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :aria-invalid="err ? 'true' : undefined"
          aria-describedby="tsErr"
        />
        <span v-if="isValue" class="input-affix" aria-hidden="true">
          <Icon name="check" />
          <template v-if="res.kind === 'ts'">{{ res.digits }} 位 · {{ res.unit }}</template>
          <template v-else>识别为日期</template>
        </span>
        <button v-show="input" type="button" class="input-clear" aria-label="清空" title="清空" @click="clear">
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div id="tsErr" class="alert" :hidden="!err" role="alert">
        <template v-if="err">
          <Icon name="alert" />
          <span>{{ err.message }}</span>
        </template>
      </div>
    </div>

    <!-- 结果区：出错或空态回到引导（不输出错误结果，PRD 4.2-4） -->
    <div class="panel">
      <template v-if="values">
        <div class="panel-head">
          <span>本地时间</span>
          <span v-if="res.kind === 'date'" class="tag">输入</span>
          <span class="note">{{ zone.short }}{{ zone.name ? ' · ' + zone.name : '' }}</span>
          <span class="grow"></span>
          <button type="button" class="btn btn--ghost" @click="onCopy('local')">
            <Icon name="copy" size="sm" />复制
          </button>
        </div>
        <div class="panel-hero">
          <code>{{ values.local }}</code>
          <span class="aside">{{ values.weekday }}</span>
        </div>
        <div class="heroes">
          <div class="hero" :class="{ 'hero--source': res.kind === 'ts' && res.unit === '秒' }">
            <small>秒级 <span v-if="res.kind === 'ts' && res.unit === '秒'" class="tag">输入</span></small>
            <code>{{ values.sec }}</code>
            <button type="button" class="icon-btn" aria-label="复制秒级时间戳" title="复制秒级时间戳" @click="onCopy('sec')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <div class="hero" :class="{ 'hero--source': res.kind === 'ts' && res.unit === '毫秒' }">
            <small>毫秒级 <span v-if="res.kind === 'ts' && res.unit !== '秒'" class="tag">输入</span></small>
            <code>{{ values.ms }}</code>
            <button type="button" class="icon-btn" aria-label="复制毫秒级时间戳" title="复制毫秒级时间戳" @click="onCopy('ms')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
        </div>
        <div class="kvs">
          <div class="kv">
            <span class="k">UTC</span>
            <span class="v">{{ values.utc }}</span>
            <button type="button" class="icon-btn" aria-label="复制 UTC 时间" title="复制 UTC 时间" @click="onCopy('utc')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <div class="kv">
            <span class="k">ISO 8601</span>
            <span class="v">{{ values.iso }}</span>
            <button type="button" class="icon-btn" aria-label="复制 ISO 8601" title="复制 ISO 8601" @click="onCopy('iso')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <div class="kv">
            <span class="k">相对时间</span>
            <span class="v">{{ values.rel }}</span>
            <button type="button" class="icon-btn" aria-label="复制相对时间" title="复制相对时间" @click="onCopy('rel')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
        </div>
      </template>
      <div v-else class="panel-empty">
        输入时间戳（秒 / 毫秒 / 微秒自动识别）得到日期；输入日期时间得到时间戳。方向自动识别，无需切换。
        <div class="examples">
          <button
            v-for="x in ['1735689600000', '1735689600', '2025-01-01 08:00:00']"
            :key="x"
            type="button"
            class="example"
            @click="setInput(x)"
          >
            {{ x }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 当前时间戳实时条（PRD 4.3.1） -->
  <footer class="statusbar statusbar--live">
    <span class="live">
      <span class="dot" aria-hidden="true"></span>
      <span>当前</span>
      <code>{{ nowSec }}</code>
      <button type="button" class="icon-btn" title="复制秒级时间戳" aria-label="复制当前秒级时间戳" @click="copyText(nowSec, '当前秒级时间戳')">
        <Icon name="copy" size="xs" />
      </button>
      <code>{{ nowMs }}</code>
      <button type="button" class="icon-btn" title="复制毫秒级时间戳" aria-label="复制当前毫秒级时间戳" @click="copyText(nowMs, '当前毫秒级时间戳')">
        <Icon name="copy" size="xs" />
      </button>
      <span>{{ zone.short }}{{ zone.name ? ' · ' + zone.name : '' }}</span>
    </span>
    <span class="grow"></span>
    <span class="hint"><kbd class="kbd">Ctrl</kbd><kbd class="kbd">Enter</kbd> 复制主结果</span>
  </footer>
</template>
