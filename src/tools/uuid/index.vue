<script setup>
/**
 * UUID 生成（PRD 4.5.1）
 * v4 随机源；批量 1–100；标准 / 无连字符 / 大写；行内或整批复制
 */
import { computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { formatUuid, generateUuids } from '../../utils/convert/uuid.js'
import { copyText } from '../../utils/clipboard.js'
import { useMainResult } from '../../utils/mainResult.js'

const count = ref(5)
const format = ref('standard') // standard | none | upper

const formats = [
  { id: 'standard', label: '标准' },
  { id: 'none', label: '无连字符' },
  { id: 'upper', label: '大写' },
]

/** 原始批次（标准小写形态）——切换展示格式只重排显示，不重新生成（PRD 4.5.1「展示格式切换」） */
const rawList = ref(generateUuids(count.value))

/** 展示列表：对同一批 UUID 应用当前格式 */
const list = computed(() => rawList.value.map((u) => formatUuid(u, format.value)))

const clampCount = () => {
  const n = Math.floor(Number(count.value) || 1)
  count.value = Math.min(100, Math.max(1, n))
  regenerate()
}

function regenerate() {
  rawList.value = generateUuids(count.value)
}

/** 切换展示格式：仅重映射当前批次，不产生新随机值 */
function setFormat(id) {
  format.value = id
}

const allText = computed(() => list.value.join('\n'))

/* Ctrl+Enter 复制主结果（PRD 4.2-2）：全部 UUID */
useMainResult(() => ({ value: allText.value, label: '全部 UUID' }))

function onCopyRow(u, i) {
  copyText(u, `第 ${i + 1} 个`)
}
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="field-row">
        <div class="seg" role="group" aria-label="格式">
          <button
            v-for="f in formats"
            :key="f.id"
            type="button"
            :aria-pressed="format === f.id"
            @click="setFormat(f.id)"
          >
            {{ f.label }}
          </button>
        </div>
        <span class="grow"></span>
        <label for="uuidCount" class="field-row" style="gap: 6px; font-size: var(--fs-12); color: var(--muted)">
          数量
          <input
            id="uuidCount"
            v-model="count"
            class="input"
            style="width: 76px; height: 30px; padding: 0 8px; text-align: center"
            type="number"
            min="1"
            max="100"
            @change="clampCount"
          />
        </label>
        <button type="button" class="btn primary" @click="regenerate">
          <Icon name="swap" size="sm" />重新生成
        </button>
      </div>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>生成结果</span>
        <span class="tag">{{ list.length }} 个 · v4</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="copyText(allText, '全部 UUID')">
          <Icon name="copy" size="sm" />复制全部
        </button>
      </div>
      <div class="pane">
        <div class="pane-scroll">
          <div v-for="(u, i) in list" :key="i" class="urow">
            <span class="urow-no" aria-hidden="true">{{ i + 1 }}</span>
            <code>{{ u }}</code>
            <button
              type="button"
              class="icon-btn"
              :aria-label="`复制第 ${i + 1} 个`"
              title="复制"
              @click="onCopyRow(u, i)"
            >
              <Icon name="copy" size="sm" />
            </button>
          </div>
        </div>
        <div class="pane-foot">128 bit 随机源 · 点击行尾 ⧉ 复制单个</div>
      </div>
    </div>
  </div>
</template>
