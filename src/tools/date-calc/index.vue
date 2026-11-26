<script setup>
/**
 * 日期换算（PRD 4.4.1）
 * 星期 / 农历（Intl 中文历法）/ 年内序数 / ISO 周 / 距今天数 + 日期差计算器
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  LUNAR_MAX_YEAR,
  LUNAR_MIN_YEAR,
  WEEKDAYS,
  dayDiff,
  dayOfYear,
  isLeapYear,
  isoWeek,
  lunar,
  parseDateYMD,
  workdayDiff,
} from '../../utils/convert/dateCalc.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const input = ref('')
const inputEl = ref(null)
const d1 = ref('')
const d2 = ref('')

useReplay('date-calc', (v) => (input.value = String(v ?? '')))

/* 历史记录：用户输入停顿 1s 后写入（卸载自动清理）。
   进入页面自动填充的「今天」不算用户输入，不写入历史 */
let autoFilled = null
watch(input, (v) => {
  if (v !== autoFilled) autoFilled = null
})
useHistRecorder('date-calc', input, (v) => {
  if (v === autoFilled) return null
  const d = parseDateYMD(v)
  if (!d || d.getFullYear() < LUNAR_MIN_YEAR || d.getFullYear() > LUNAR_MAX_YEAR) return null
  return lunar(d).text // 农历不可用抛错 → recorder 静默跳过
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2）：日期信息摘要 */
useMainResult(() =>
  info.value ? { value: `${input.value} ${info.value.weekday} · 农历 ${info.value.lunarText}`, label: '日期信息' } : null,
)

const date = computed(() => parseDateYMD(input.value))
const inRange = computed(() => {
  const d = date.value
  return d && d.getFullYear() >= LUNAR_MIN_YEAR && d.getFullYear() <= LUNAR_MAX_YEAR
})
const err = computed(() => {
  if (!input.value.trim()) return ''
  if (!date.value) return '无法解析日期，请使用 YYYY-MM-DD 格式，且日期必须真实存在'
  if (!inRange.value) return `农历计算支持 ${LUNAR_MIN_YEAR}–${LUNAR_MAX_YEAR} 年，当前输入超出范围`
  return ''
})

const info = computed(() => {
  if (!inRange.value) return null
  const d = date.value
  const gap = dayDiff(new Date(), d)
  const lu = (() => {
    try {
      return lunar(d)
    } catch (e) {
      return null
    }
  })()
  const iso = isoWeek(d)
  return {
    weekday: WEEKDAYS[d.getDay()],
    lunarText: lu ? lu.text : '不可用',
    zodiac: lu && lu.zodiac ? `${lu.zodiac}年` : '',
    ord: dayOfYear(d),
    isoWeek: `${iso.year !== d.getFullYear() ? iso.year + ' 年 ' : ''}第 ${iso.week} 周`,
    leap: isLeapYear(d.getFullYear()) ? '闰年 · 366 天' : '平年 · 365 天',
    untilText: gap === 0 ? '今天' : gap > 0 ? `${gap} 天后` : `${-gap} 天前`,
  }
})

/* 日期差 */
const aDate = computed(() => parseDateYMD(d1.value))
const bDate = computed(() => parseDateYMD(d2.value))
const diff = computed(() => (aDate.value && bDate.value ? dayDiff(aDate.value, bDate.value) : null))
/** 工作日天数（剔除周六日，含头含尾，PRD 4.4.1 可选 P1） */
const workdays = computed(() => (diff.value !== null ? workdayDiff(aDate.value, bDate.value) : null))
const diffInvalid = computed(() => (d1.value && !aDate.value) || (d2.value && !bDate.value))
const diffText = computed(() => {
  if (diff.value === null) return '—'
  return `${Math.abs(diff.value)} 天`
})

function fillToday() {
  const v = fmtToday()
  autoFilled = v // 标记为自动填充：不写入历史
  input.value = v
  inputEl.value?.focus()
}

function fmtToday() {
  const n = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`
}

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) input.value = String(p)
  else fillToday()
  d1.value = fmtToday()
  inputEl.value?.focus()
})
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="block-head">
        <label for="dcInput">查询日期（YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日）</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="fillToday">今天</button>
      </div>
      <div class="input-wrap">
        <input
          id="dcInput"
          ref="inputEl"
          v-model="input"
          class="input"
          placeholder="如 2025-01-29"
          autocomplete="off"
          spellcheck="false"
          :aria-invalid="err ? 'true' : undefined"
          aria-describedby="dcErr"
        />
        <span v-if="date" class="input-affix" aria-hidden="true">
          <Icon name="check" />
          {{ WEEKDAYS[date.getDay()] }}
        </span>
        <button v-show="input" type="button" class="input-clear" aria-label="清空" title="清空" @click="input = ''; inputEl?.focus()">
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div id="dcErr" class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="panel" v-if="info">
      <div class="panel-head">
        <span>日期信息</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="copyText(`${input} ${info.weekday} · 农历 ${info.lunarText}`, '日期信息')">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <div class="panel-hero">
        <code>{{ input }}</code>
        <span class="aside">{{ info.weekday }}</span>
      </div>
      <div class="kv">
        <span class="k">农历</span>
        <span class="v">{{ info.lunarText }}<span v-if="info.zodiac" class="aside">{{ info.zodiac }}</span></span>
      </div>
      <div class="kv">
        <span class="k">年内序数</span>
        <span class="v">第 {{ info.ord }} 天<span class="aside">ISO {{ info.isoWeek }} · {{ info.leap }}</span></span>
      </div>
      <div class="kv">
        <span class="k">距今</span>
        <span class="v">{{ info.untilText }}</span>
      </div>
    </div>

    <!-- 日期差计算器 -->
    <div class="block">
      <div class="block-head">
        <span>日期差计算（自然日 + 工作日）</span>
        <span class="grow"></span>
        <button
          type="button"
          class="btn btn--ghost"
          :disabled="diff === null"
          @click="copyText(`${d1} → ${d2} · 相差 ${Math.abs(diff)} 天 · 工作日 ${workdays} 天`, '日期差')"
        >
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <div class="field-row">
        <input v-model="d1" class="input" placeholder="YYYY-MM-DD" spellcheck="false" />
        <Icon name="arrow-right" size="sm" style="color: var(--muted)" />
        <input v-model="d2" class="input" placeholder="YYYY-MM-DD" spellcheck="false" />
        <code class="diff-out">{{ diffText }}</code>
      </div>
      <div v-if="diffInvalid" class="field-note field-note--err" role="alert">
        日期格式不正确：请使用 YYYY-MM-DD，且日期须真实存在
      </div>
      <div v-else-if="diff !== null" class="field-note">
        {{ d1 }} → {{ d2 }} · 相差 {{ Math.abs(diff) }} 天（{{ diff >= 0 ? '向后' : '向前' }}）· 其中工作日 {{ workdays }} 天（剔除周六日）
      </div>
    </div>
  </div>

  <footer class="statusbar">
    <span class="hint"><kbd class="kbd">农历</kbd>支持 {{ LUNAR_MIN_YEAR }}–{{ LUNAR_MAX_YEAR }} 年</span>
    <span class="grow"></span>
    <span>数据全部本地计算</span>
  </footer>
</template>

<style scoped>
.diff-out {
  font-family: var(--mono);
  font-size: var(--fs-16);
  font-weight: var(--fw-medium);
  min-width: 64px;
  text-align: right;
  flex: none;
}
.field-note {
  margin-top: var(--sp-8);
  font-size: var(--fs-12);
  color: var(--muted);
}
.field-note--err {
  color: var(--danger);
}
</style>
