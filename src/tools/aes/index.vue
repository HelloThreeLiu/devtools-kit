<script setup>
/**
 * AES 加解密（R2.5）
 * CBC（默认，PKCS#7）/ GCM（推荐，认证标签随密文）；密钥 128/192/256 位
 * （Hex/Base64，可一键随机生成）；IV 自动生成并分栏返回，解密方向粘贴 IV；
 * 密文 Base64 / Hex 两种格式
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  KEY_BITS,
  MODES,
  aesDecrypt,
  aesEncrypt,
  aesKeyToString,
  generateAesKey,
} from '../../utils/convert/aes.js'
import { copyText } from '../../utils/clipboard.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

const direction = ref('encrypt') // encrypt | decrypt
const mode = ref('CBC') // CBC | GCM
const keyBits = ref(256)
const keyFormat = ref('hex') // hex | base64：密钥的解析/展示格式
const dataFormat = ref('base64') // base64 | hex：加密 = 密文与 IV 输出；解密 = 密文与 IV 输入
const key = ref('')
const ivInput = ref('') // 解密方向的 IV
const text = ref('')
const textEl = ref(null)
const res = ref({ ok: false, empty: true })

useReplay('aes', (v) => (text.value = String(v ?? '')))

/* 历史：全部输入停顿 1s 后写入（异步结果由 hook await） */
useHistRecorder(
  'aes',
  () => [text.value, key.value, ivInput.value, direction.value, mode.value, keyFormat.value, dataFormat.value],
  async (src) => {
    const [t, k, iv, dir, m, kf, df] = src
    if (!t.trim() || !k.trim()) return null
    if (dir === 'encrypt') {
      const r = await aesEncrypt({ key: k, keyFormat: kf, mode: m, plaintext: t, output: df })
      return r.ok ? r.data : null
    }
    const r = await aesDecrypt({ key: k, keyFormat: kf, mode: m, iv, cipher: t, inputFormat: df })
    return r.ok ? r.data : null
  },
)

/* Ctrl+Enter 复制主结果（PRD 4.2-2） */
useMainResult(() => (out.value ? { value: out.value, label: direction.value === 'encrypt' ? '密文' : '明文' } : null))

const directions = [
  { id: 'encrypt', label: '加密' },
  { id: 'decrypt', label: '解密' },
]

const dataFormats = [
  { id: 'base64', label: 'Base64' },
  { id: 'hex', label: 'Hex' },
]

/* 异步计算：输入任一变化触发，seq 守卫丢弃过期结果 */
let seq = 0
watch([text, key, ivInput, direction, mode, keyFormat, dataFormat], async () => {
  const my = ++seq
  if (!text.value.trim() || !key.value.trim()) {
    res.value = { ok: false, empty: true }
    return
  }
  let r
  if (direction.value === 'encrypt') {
    r = await aesEncrypt({ key: key.value, keyFormat: keyFormat.value, mode: mode.value, plaintext: text.value, output: dataFormat.value })
  } else {
    // IV 未输入属于「待补全」而非格式错误，给出指引性提示（W4 审查 M-10）
    if (!ivInput.value.trim()) {
      res.value = { ok: false, error: '请输入加密时返回的 IV（上方结果区可直接复制）' }
      return
    }
    r = await aesDecrypt({ key: key.value, keyFormat: keyFormat.value, mode: mode.value, iv: ivInput.value, cipher: text.value, inputFormat: dataFormat.value })
  }
  if (my !== seq) return
  res.value = r
})

const err = computed(() => (res.value.error ? res.value.error : ''))
const out = computed(() => (res.value.ok ? res.value.data : ''))
const outIv = computed(() => (res.value.ok && res.value.iv ? res.value.iv : ''))

/* 切到解密方向时自动回填刚生成的 IV，免去手动复制（W4 审查建议 1） */
watch(direction, (d, old) => {
  if (d === 'decrypt' && old === 'encrypt' && outIv.value && !ivInput.value) ivInput.value = outIv.value
})

const directionLabel = computed(() =>
  !text.value.trim() ? '—' : direction.value === 'encrypt' ? `明文 → 密文（AES-${mode.value}）` : `密文 → 明文（AES-${mode.value}）`,
)

const dataFormatLabel = computed(() => (dataFormat.value === 'hex' ? 'Hex' : 'Base64'))

/** 结果区脚注：按模式给出准确说明（CBC 无认证标签，W4 修正——此前 GCM 文案在 CBC 下错误显示） */
const footText = computed(() => {
  if (!res.value.ok || direction.value !== 'encrypt') return ''
  return mode.value === 'GCM'
    ? `GCM 认证标签已随密文返回（尾部 16 字节）· ${dataFormatLabel.value} 格式`
    : `CBC · PKCS#7 填充（密文长度为 16 字节的倍数）· ${dataFormatLabel.value} 格式`
})

/* 随机密钥：记住原始字节，切换密钥格式时自动重编码（手动编辑后解除绑定） */
let generatedKeyBytes = null
function onKeyInput() {
  generatedKeyBytes = null
}
function genKey() {
  const r = generateAesKey(keyBits.value, 'raw')
  generatedKeyBytes = r.key
  key.value = aesKeyToString(r.key, keyFormat.value)
}
watch(keyFormat, () => {
  if (generatedKeyBytes) key.value = aesKeyToString(generatedKeyBytes, keyFormat.value)
})

function onCopy() {
  copyText(out.value, direction.value === 'encrypt' ? '密文' : '明文')
}

function onCopyIv() {
  copyText(outIv.value, 'IV')
}

function clearInput() {
  text.value = ''
  textEl.value?.focus()
}

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) text.value = String(p)
  textEl.value?.focus()
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
        <button
          v-for="m in MODES"
          :key="m.id"
          type="button"
          :aria-pressed="mode === m.id"
          :title="m.hint"
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
        <span style="width: 12px" aria-hidden="true"></span>
        <button
          v-for="f in dataFormats"
          :key="f.id"
          type="button"
          :aria-pressed="dataFormat === f.id"
          :title="direction === 'encrypt' ? '密文与 IV 的输出格式' : '密文与 IV 的输入格式'"
          @click="dataFormat = f.id"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="block-head" style="margin-top: 8px">
        <label for="aesKey">密钥（{{ keyFormat === 'hex' ? 'Hex' : 'Base64' }}）</label>
        <div class="seg" role="group" aria-label="密钥格式">
          <button type="button" :aria-pressed="keyFormat === 'hex'" @click="keyFormat = 'hex'">Hex</button>
          <button type="button" :aria-pressed="keyFormat === 'base64'" @click="keyFormat = 'base64'">Base64</button>
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="密钥长度">
          <button
            v-for="b in KEY_BITS"
            :key="b"
            type="button"
            :aria-pressed="keyBits === b"
            @click="keyBits = b"
          >
            AES-{{ b }}
          </button>
        </div>
        <button type="button" class="btn btn--ghost" title="用 crypto.getRandomValues 生成随机密钥" @click="genKey">
          <Icon name="swap" size="sm" />生成密钥
        </button>
      </div>
      <input
        id="aesKey"
        v-model="key"
        class="input"
        style="font-family: var(--mono)"
        :placeholder="keyFormat === 'hex' ? '粘贴 Hex 密钥（AES-256 为 64 位十六进制）或点击「生成密钥」' : '粘贴 Base64 密钥或点击「生成密钥」'"
        autocomplete="off"
        spellcheck="false"
        @input="onKeyInput"
      />

      <!-- 解密方向：IV 输入 -->
      <template v-if="direction === 'decrypt'">
        <div class="block-head" style="margin-top: 8px">
          <label for="aesIv">IV（{{ dataFormatLabel }}，{{ mode === 'GCM' ? 12 : 16 }} 字节）</label>
          <span class="grow"></span>
        </div>
        <input
          id="aesIv"
          v-model="ivInput"
          class="input"
          style="font-family: var(--mono)"
          placeholder="粘贴加密时返回的 IV"
          autocomplete="off"
          spellcheck="false"
        />
      </template>

      <div class="block-head" style="margin-top: 8px">
        <label for="aesText">{{ direction === 'encrypt' ? '明文' : '密文' }}</label>
        <span class="tag">{{ directionLabel }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="clearInput">清空</button>
      </div>
      <textarea
        id="aesText"
        ref="textEl"
        v-model="text"
        class="textarea"
        style="min-height: 88px"
        :placeholder="direction === 'encrypt' ? '输入要加密的文本' : dataFormat === 'hex' ? '粘贴 Hex 密文' : '粘贴 Base64 密文'"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!err" role="alert">
        <Icon name="alert" />
        <span>{{ err }}</span>
      </div>
    </div>

    <div class="block block--fill">
      <div class="block-head">
        <span>{{ direction === 'encrypt' ? '密文' : '明文' }}</span>
        <span v-if="res.ok" class="tag">AES-{{ mode }}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!out" @click="onCopy">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <!-- 加密方向：IV 分栏展示，解密时需要同名 IV -->
      <div v-if="direction === 'encrypt' && outIv" class="block-head">
        <span class="tag" title="加密自动生成的初始向量，解密时必须提供同名 IV">IV · {{ dataFormatLabel }}</span>
        <code class="mono iv-text">{{ outIv }}</code>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制 IV" title="复制 IV" @click="onCopyIv">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <div v-if="!text.trim()" class="placeholder">输入{{ direction === 'encrypt' ? '明文与密钥' : '密文、密钥与 IV' }}后自动转换。</div>
          <span v-else-if="err">—</span>
          <template v-else>{{ out }}</template>
        </div>
        <div class="pane-foot">{{ footText }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iv-text {
  font-family: var(--mono);
  font-size: var(--fs-12);
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
