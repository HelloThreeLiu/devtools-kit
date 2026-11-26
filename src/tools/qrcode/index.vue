<script setup>
/**
 * 二维码生成（PRD 4.5.4）
 * 纯本地生成（qrcode 库）；预览 + 复制图片（utools.copyImage）
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { makeQr } from '../../utils/convert/qrcode.js'
import { utools } from '../../utils/utools.js'
import { copyText } from '../../utils/clipboard.js'
import { toast } from '../../utils/toast.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const MAX_CHARS = 1000 // PRD 4.5.4：输入上限 1000 字符

const input = ref('')
const inputEl = ref(null)
const dataUrl = ref('')
const err = ref('')
let seq = 0

const outText = computed(() => (dataUrl.value ? '二维码已生成' : ''))

useReplay('qrcode', (v) => (input.value = String(v ?? '')))

/* 历史记录：生成成功后停顿 1s 写入（卸载自动清理） */
useHistRecorder('qrcode', input, (v) => (v && dataUrl.value ? '[二维码]' : null))

async function run() {
  const my = ++seq
  const text = input.value
  if (!text) {
    dataUrl.value = ''
    err.value = ''
    return
  }
  if (text.length > MAX_CHARS) {
    dataUrl.value = ''
    err.value = `内容超过 ${MAX_CHARS} 字符（当前 ${text.length}），请缩短后重试`
    return
  }
  const r = await makeQr(text, { width: 240 })
  if (my !== seq) return
  if (r.ok) {
    dataUrl.value = r.dataUrl
    err.value = ''
  } else {
    dataUrl.value = ''
    err.value = r.error
  }
}

watch(input, run)

function onCopyImage() {
  if (!dataUrl.value) return
  let ok = false
  try {
    ok = utools.copyImage(dataUrl.value) === true
  } catch (e) {
    ok = false
  }
  if (!ok) {
    // 浏览器调试：无 copyImage，降级为下载提示
    toast('浏览器调试模式不支持复制图片，请在 uTools 中使用')
    return
  }
  toast('已复制 · 二维码图片')
}

/** 导出 PNG（PRD 4.5.4）：经浏览器下载能力落地为文件 */
function onExportPng() {
  if (!dataUrl.value) return
  const a = document.createElement('a')
  a.href = dataUrl.value
  a.download = `qrcode-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  toast('已导出 PNG')
}

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
        <label for="qrInput">输入文本或链接</label>
        <span v-if="input" class="tag" :class="{ 'tag--err': input.length > MAX_CHARS }">{{ input.length }} / {{ MAX_CHARS }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="input = ''; inputEl?.focus()">清空</button>
      </div>
      <textarea
        id="qrInput"
        ref="inputEl"
        v-model="input"
        class="textarea"
        style="min-height: 72px"
        placeholder="输入文本或 https://… 链接，实时生成二维码"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>二维码</span>
        <span v-if="dataUrl" class="tag">{{ outText }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!dataUrl" @click="onExportPng">
          <Icon name="arrow-right" size="sm" />导出 PNG
        </button>
        <button type="button" class="btn btn--ghost" :disabled="!dataUrl" @click="onCopyImage">
          <Icon name="copy" size="sm" />复制图片
        </button>
      </div>
      <div class="pane">
        <div class="pane-scroll qr-wrap">
          <img v-if="dataUrl" :src="dataUrl" alt="二维码" class="qr-img" />
          <div v-else class="placeholder">
            输入内容后生成二维码，手机扫码即可识别。
            <div class="examples">
              <button type="button" class="example" @click="input = 'https://github.com/HelloThreeLiu/devtools-kit'">
                https://github.com/HelloThreeLiu/devtools-kit
              </button>
            </div>
          </div>
        </div>
        <div class="pane-foot">{{ dataUrl ? '纠错级别 M · 透明底 · 可复制图片或导出 PNG' : '' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qr-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-img {
  width: 220px;
  height: 220px;
  border-radius: var(--radius);
  background:
    conic-gradient(var(--border) 25%, transparent 0 50%, var(--border) 0 75%, transparent 0) 0 0 / 16px 16px;
}
</style>
