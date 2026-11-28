<script setup>
/**
 * 图片/文件 ↔ Base64（R1.5，反馈热度第一）
 * · 编码：选择 / 拖入任意文件 → Base64 与 Data URL（MIME 按扩展名推断，>10 MB 体积警告）
 * · 解码：粘贴 Data URL 或裸 Base64 → MIME 识别（前缀解析 + 魔数嗅探）→ 图片预览
 * · 复制图片 / 另存为：uTools 宿主能力（浏览器调试隐藏入口）
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  IMAGE_MIMES,
  SIZE_WARN_BYTES,
  UNKNOWN_MIME,
  analyzeDecodeInput,
  buildDataUrl,
  extFromMime,
  formatBytes,
  mimeFromExt,
} from '../../utils/convert/fileB64.js'
import { copyText } from '../../utils/clipboard.js'
import { toast } from '../../utils/toast.js'
import { utools, services, inUtoolsEnv } from '../../utils/utools.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { recordHistory } from '../../utils/db.js'
import { consumeEnterPayload } from '../../router.js'

const direction = ref('encode') // encode | decode
const inputEl = ref(null)

useReplay('file-b64', (v) => {
  const s = String(v ?? '')
  // 编码方向历史是文件名，无法回放文件；Data URL / Base64 形态回填解码方向
  if (/^data:/i.test(s) || /^[A-Za-z0-9+/=\s]{20,}$/.test(s)) {
    direction.value = 'decode'
    decodeInput.value = s
  }
})

/* 解码历史：停顿 1s 写入（编码方向事件驱动，单独直记，见 encodeFile） */
useHistRecorder('file-b64', () => (direction.value === 'decode' ? decodeInput.value : ''), (v) => {
  const r = analyzeDecodeInput(v)
  return r.ok ? `${r.mime} · ${formatBytes(r.byteLen)}` : null
})

/* Ctrl+Enter 复制主结果（PRD 4.2-2） */
useMainResult(() => {
  if (direction.value === 'encode') {
    return enc.value ? { value: enc.value.dataUrl, label: 'Data URL' } : null
  }
  return dec.value.ok ? { value: buildDataUrl(dec.value.mime, dec.value.base64), label: 'Data URL' } : null
})

const directions = [
  { id: 'encode', label: '编码' },
  { id: 'decode', label: '解码' },
]

/* ---------- 编码方向 ---------- */

const enc = ref(null) // { name, size, mime, base64, dataUrl, tooLarge }
const fileError = ref('')
const dragging = ref(false)
const fileInputEl = ref(null)

function pickFile() {
  fileInputEl.value?.click()
}

function onFileChange(e) {
  const f = e.target.files && e.target.files[0]
  if (f) encodeFile(f)
  e.target.value = '' // 允许重复选择同一文件
}

function onDrop(e) {
  dragging.value = false
  const f = e.dataTransfer.files && e.dataTransfer.files[0]
  if (f) encodeFile(f)
}

function encodeFile(f) {
  fileError.value = ''
  const mime = mimeFromExt(f.name) || f.type || UNKNOWN_MIME
  const reader = new FileReader()
  reader.onload = () => {
    const raw = String(reader.result || '')
    const base64 = raw.slice(raw.indexOf(',') + 1)
    enc.value = {
      name: f.name,
      size: f.size,
      mime,
      base64,
      dataUrl: buildDataUrl(mime, base64),
      tooLarge: f.size > SIZE_WARN_BYTES,
    }
    recordHistory('file-b64', f.name, `${mime} · ${formatBytes(f.size)}`)
  }
  reader.onerror = () => {
    fileError.value = '文件读取失败，请重试'
  }
  reader.readAsDataURL(f)
}

function copyBase64() {
  copyText(enc.value?.base64 || '', 'Base64')
}

function copyDataUrl() {
  copyText(enc.value?.dataUrl || '', 'Data URL')
}

/* ---------- 解码方向 ---------- */

const decodeInput = ref('')
const decodeInputEl = ref(null)
const LARGE = 100 * 1024 // >100KB 输入 debounce 200ms（大粘贴防抖，与 JSON 工具同策略）
let timer = null
const debounced = ref('')
watch(decodeInput, (v) => {
  if (v.length <= LARGE) {
    debounced.value = v
    return
  }
  clearTimeout(timer)
  timer = setTimeout(() => {
    debounced.value = v
  }, 200)
})
const effectiveInput = computed(() => (decodeInput.value.length <= LARGE ? decodeInput.value : debounced.value))

const dec = computed(() => analyzeDecodeInput(effectiveInput.value))
const decErr = computed(() => (dec.value.error ? dec.value.error : ''))
/** 可预览图片 → Data URL 渲染；未知/非图片不预览 */
const previewOk = computed(() => dec.value.ok && IMAGE_MIMES.has(dec.value.mime))
const previewUrl = computed(() => (previewOk.value ? buildDataUrl(dec.value.mime, dec.value.base64) : ''))
const sourceLabel = computed(() =>
  dec.value.ok ? (dec.value.source === 'dataurl' ? 'Data URL' : '魔数嗅探') : '—',
)

/* 宿主能力（浏览器调试隐藏入口） */
const copyImgSupported = inUtoolsEnv && typeof utools.copyImage === 'function'
const saveSupported = inUtoolsEnv && typeof utools.showSaveDialog === 'function' && typeof services.saveFile === 'function'

function onCopyImage() {
  if (!copyImgSupported || !previewOk.value) return
  const ok = utools.copyImage(previewUrl.value) === true // 官方签名：Data URL 可直接入参
  toast(ok ? '已复制图片' : '复制失败')
}

function onSaveFile() {
  if (!saveSupported || !dec.value.ok) return
  const ext = extFromMime(dec.value.mime)
  const filePath = utools.showSaveDialog({
    title: '另存为文件',
    defaultPath: `converted.${ext}`,
  })
  if (!filePath) return // 取消 → 静默
  try {
    services.saveFile(filePath, dec.value.base64)
    toast('已保存')
  } catch (e) {
    toast('保存失败：' + (e?.message || '未知原因'))
  }
}

const decodeExamples = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
]

const placeholderText = computed(() =>
  direction.value === 'decode'
    ? '粘贴 Data URL（data:image/png;base64,…）或裸 Base64，自动识别 MIME 并预览'
    : '点击选择文件，或把文件拖入上方区域',
)

function clearInput() {
  if (direction.value === 'decode') {
    decodeInput.value = ''
    decodeInputEl.value?.focus()
  } else {
    enc.value = null
    fileError.value = ''
  }
}

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) {
    const s = String(p)
    if (/^data:/i.test(s) || /^[A-Za-z0-9+/=\s]{20,}$/.test(s)) {
      direction.value = 'decode'
      decodeInput.value = s
    }
  }
  inputEl.value?.focus()
})

onUnmounted(() => {
  clearTimeout(timer)
})
</script>

<template>
  <div class="tool-body">
    <div class="block">
      <div class="seg" role="group" aria-label="方向">
        <button
          v-for="d in directions"
          :key="d.id"
          type="button"
          :aria-pressed="direction === d.id"
          @click="direction = d.id"
        >
          {{ d.label }}
        </button>
      </div>

      <!-- 编码方向 -->
      <template v-if="direction === 'encode'">
        <div
          class="drop-zone"
          :class="{ 'is-dragging': dragging }"
          role="button"
          tabindex="0"
          aria-label="选择或拖入文件"
          @click="pickFile"
          @keydown.enter="pickFile"
          @keydown.space.prevent="pickFile"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <Icon name="image" />
          <span>点击选择文件，或拖入此处</span>
          <span class="drop-hint">任意文件 · 图片可直接预览（png / jpg / gif / webp / svg / bmp / ico）</span>
        </div>
        <input
          ref="fileInputEl"
          type="file"
          style="display: none"
          aria-hidden="true"
          @change="onFileChange"
        />
        <div class="alert" :hidden="!fileError" role="alert">
          <Icon name="alert" />
          <span>{{ fileError }}</span>
        </div>
      </template>

      <!-- 解码方向 -->
      <template v-else>
        <div class="block-head" style="margin-top: 6px">
          <label for="fb64Input">输入</label>
          <span class="grow"></span>
          <button type="button" class="btn btn--ghost" @click="clearInput">清空</button>
        </div>
        <textarea
          id="fb64Input"
          ref="decodeInputEl"
          v-model="decodeInput"
          class="textarea"
          style="min-height: 96px"
          :placeholder="placeholderText"
          spellcheck="false"
        ></textarea>
        <div class="alert" :hidden="!decErr" role="alert">
          <Icon name="alert" />
          <span>{{ decErr }}</span>
        </div>
      </template>
    </div>

    <!-- 编码结果 -->
    <div v-if="direction === 'encode' && enc" class="block">
      <div class="block-head">
        <span class="tag">{{ enc.name }}</span>
        <span class="tag">{{ enc.mime }}</span>
        <span class="tag">{{ formatBytes(enc.size) }}</span>
        <span v-if="enc.tooLarge" class="tag tag--err">
          <Icon name="alert" size="xs" />超过 10 MB，继续操作可能卡顿
        </span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="clearInput">清除</button>
      </div>
      <div class="block">
        <div class="block-head">
          <span>Data URL</span>
          <span class="grow"></span>
          <button type="button" class="btn btn--ghost" @click="copyDataUrl">
            <Icon name="copy" size="sm" />复制
          </button>
        </div>
        <div class="pane pane--text">
          <div class="pane-scroll"><span class="mono">{{ enc.dataUrl }}</span></div>
        </div>
      </div>
      <div class="block">
        <div class="block-head">
          <span>纯 Base64</span>
          <span class="grow"></span>
          <button type="button" class="btn btn--ghost" @click="copyBase64">
            <Icon name="copy" size="sm" />复制
          </button>
        </div>
        <div class="pane pane--text">
          <div class="pane-scroll"><span class="mono">{{ enc.base64 }}</span></div>
          <div class="pane-foot">Base64 长度 {{ enc.base64.length }} 字符</div>
        </div>
      </div>
    </div>

    <!-- 解码结果 -->
    <div v-if="direction === 'decode' && decodeInput" class="block block--fill">
      <div class="block-head">
        <span>识别结果</span>
        <span v-if="dec.ok" class="tag" :title="`识别方式：${sourceLabel}`">{{ dec.mime }}</span>
        <span v-if="dec.ok" class="tag">{{ formatBytes(dec.byteLen) }}</span>
        <span v-if="dec.ok && !dec.known" class="tag">未识别到已知格式（按 {{ UNKNOWN_MIME }} 处理）</span>
        <span class="grow"></span>
        <template v-if="dec.ok && previewOk">
          <button
            v-if="copyImgSupported"
            type="button"
            class="btn btn--ghost"
            title="复制图片到系统剪贴板"
            @click="onCopyImage"
          >
            <Icon name="copy" size="sm" />复制图片
          </button>
          <button
            v-if="saveSupported"
            type="button"
            class="btn btn--ghost"
            title="保存为文件"
            @click="onSaveFile"
          >
            <Icon name="download" size="sm" />另存为
          </button>
        </template>
      </div>
      <div v-if="dec.ok" class="pane">
        <div class="pane-scroll preview-wrap">
          <img v-if="previewOk" :src="previewUrl" class="preview" alt="图片预览" />
          <div v-else class="placeholder">已还原 {{ formatBytes(dec.byteLen) }} 数据（{{ dec.mime }}），非图片格式不预览；可复制 Data URL 或另存为文件。</div>
        </div>
        <div class="pane-foot">
          识别方式：{{ sourceLabel }} · 数据 {{ formatBytes(dec.byteLen) }}
        </div>
      </div>
      <div v-else class="pane">
        <div class="pane-scroll"><div class="placeholder">输入合法的 Data URL 或 Base64 后显示预览。</div></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drop-zone {
  margin-top: 8px;
  padding: 22px 16px;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--muted);
  text-align: center;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.drop-zone:hover,
.drop-zone:focus-visible {
  border-color: var(--accent);
  color: var(--fg);
  outline: none;
}
.drop-zone.is-dragging {
  border-color: var(--accent);
  background: var(--accent-weak, rgba(30, 128, 255, 0.08));
  color: var(--fg);
}
.drop-hint {
  font-size: var(--fs-12);
  color: var(--muted);
}
.mono {
  word-break: break-all;
  white-space: pre-wrap;
}
.preview-wrap {
  display: flex;
  justify-content: center;
  padding: 16px;
}
.preview {
  max-width: 100%;
  max-height: 320px;
  border-radius: var(--radius);
  background: var(--checker, conic-gradient(#8888 25%, transparent 0 50%, #8888 0 75%, transparent 0) 0 0 / 16px 16px);
}
</style>
