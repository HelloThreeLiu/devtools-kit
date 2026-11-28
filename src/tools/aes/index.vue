<script setup>
/**
 * AES 加解密（R2.5）—— 按任务动线分三个步骤区：
 * ① 密钥与模式（加密/解密共用）→ ② 加密（明文 → 密文，IV 自动生成）
 * → ③ 解密（密文 → 明文，需同名 IV）。
 * CBC（默认，PKCS#7，与 OpenSSL 互验）/ GCM（推荐，认证标签随密文）；
 * 密钥 128/192/256 位一键生成（Hex/Base64）；密文与 IV 支持 Base64 / Hex。
 * 纯函数在 utils/convert/aes.js（WebCrypto）；UI 仅编排输入输出。
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

const dataFormats = [
  { id: 'base64', label: 'Base64' },
  { id: 'hex', label: 'Hex' },
]

/* ---------- ① 密钥与模式 ---------- */

const key = ref('')
const keyBits = ref(256)
const keyFormat = ref('hex') // 密钥文本格式（与密文格式无关）
const mode = ref('CBC') // CBC | GCM（加密/解密共用）
const dataFormat = ref('base64') // base64 | hex：密文与 IV 的编码（两方向保持一致即可互通）

let generatedKeyBytes = null // 生成密钥的原始字节：切换密钥格式时自动重编码（手动编辑解除绑定）
function onKeyInput() {
  generatedKeyBytes = null
}
function genKey() {
  generatedKeyBytes = generateAesKey(keyBits.value, 'raw').key
  key.value = aesKeyToString(generatedKeyBytes, keyFormat.value)
}
watch(keyFormat, () => {
  if (generatedKeyBytes) key.value = aesKeyToString(generatedKeyBytes, keyFormat.value)
})

const keyFormatLabel = computed(() => (keyFormat.value === 'hex' ? 'Hex' : 'Base64'))
const dataFormatLabel = computed(() => (dataFormat.value === 'hex' ? 'Hex' : 'Base64'))

/* ---------- ② 加密 ---------- */

const encPlain = ref('')
const encRes = ref({ ok: false, empty: true })
const encIv = computed(() => (encRes.value.ok && encRes.value.iv ? encRes.value.iv : ''))

let seq1 = 0
watch([encPlain, key, keyFormat, dataFormat, mode], async () => {
  const my = ++seq1
  if (!encPlain.value.trim() || !key.value.trim()) {
    encRes.value = { ok: false, empty: true }
    return
  }
  const r = await aesEncrypt({ key: key.value, keyFormat: keyFormat.value, mode: mode.value, plaintext: encPlain.value, output: dataFormat.value })
  if (my !== seq1) return
  encRes.value = r
})

const encFoot = computed(() => {
  if (!encRes.value.ok) return ''
  return mode.value === 'GCM'
    ? `GCM 认证标签已随密文返回（尾部 16 字节）· ${dataFormatLabel.value} 格式`
    : `CBC · PKCS#7 填充（密文长度为 16 字节的倍数）· ${dataFormatLabel.value} 格式`
})

/* ---------- ③ 解密 ---------- */

const decCipher = ref('')
const decIv = ref('')
const decRes = ref({ ok: false, empty: true })

let seq2 = 0
watch([decCipher, decIv, key, keyFormat, dataFormat, mode], async () => {
  const my = ++seq2
  if (!decCipher.value.trim() || !key.value.trim()) {
    decRes.value = { ok: false, empty: true }
    return
  }
  if (!decIv.value.trim()) {
    decRes.value = { ok: false, error: '请输入加密时返回的 IV（② 加密区可直接复制）' }
    return
  }
  const r = await aesDecrypt({ key: key.value, keyFormat: keyFormat.value, mode: mode.value, iv: decIv.value, cipher: decCipher.value, inputFormat: dataFormat.value })
  if (my !== seq2) return
  decRes.value = r
})

/* ---------- 历史 / 主结果 / 回放 ---------- */

/* 历史记录加密流程（入库 input = 明文；密钥不入库——getter 数组首元素为入库 input） */
useHistRecorder(
  'aes',
  () => [encPlain.value, decCipher.value, decIv.value, key.value, keyFormat.value, dataFormat.value, mode.value],
  async (src) => {
    const [e, , , k, kf, df, m] = src
    if (!e.trim() || !k.trim()) return null
    const r = await aesEncrypt({ key: k, keyFormat: kf, mode: m, plaintext: e, output: df })
    return r.ok ? r.data : null
  },
)

useMainResult(() => {
  if (decRes.value.ok) return { value: decRes.value.data, label: '解密明文' }
  if (encRes.value.ok) return { value: encRes.value.data, label: '加密密文' }
  return null
})

useReplay('aes', (v) => (encPlain.value = String(v ?? '')))

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) encPlain.value = String(p)
})
</script>

<template>
  <div class="tool-body">
    <!-- 使用指引 -->
    <div class="guide">
      <span>解密需要与加密时<b>完全相同</b>的密钥和 IV——三者任一不同都无法还原，密钥丢失数据不可恢复。</span>
      <span>密文与 IV 支持 Base64 / Hex 两种编码；两方向保持同一种即可互通。</span>
    </div>

    <!-- ① 密钥与模式 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">1</span>
        <div class="step-texts">
          <span class="step-title">密钥与模式</span>
          <span class="step-hint">加密与解密共用同一把密钥、同一个模式</span>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" title="用 crypto.getRandomValues 生成随机密钥" @click="genKey">
          <Icon name="swap" size="sm" />生成密钥
        </button>
      </div>
      <div class="block-head">
        <label for="aesKey">密钥</label>
        <div class="seg" role="group" aria-label="密钥格式">
          <button type="button" :aria-pressed="keyFormat === 'hex'" @click="keyFormat = 'hex'">Hex</button>
          <button type="button" :aria-pressed="keyFormat === 'base64'" @click="keyFormat = 'base64'">Base64</button>
        </div>
        <span class="grow"></span>
        <span class="step-hint">长度即强度（128 已足够安全，256 余量更高）</span>
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
      <div class="block-head" style="margin-top: 8px">
        <span>模式与密文编码（加密 / 解密共用）</span>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="模式">
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
        </div>
        <div class="seg" role="group" aria-label="密文编码">
          <button
            v-for="f in dataFormats"
            :key="f.id"
            type="button"
            :aria-pressed="dataFormat === f.id"
            @click="dataFormat = f.id"
          >
            {{ f.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- ② 加密 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">2</span>
        <div class="step-texts">
          <span class="step-title">加密</span>
          <span class="step-hint">用上方密钥把明文变成密文 · IV 自动生成</span>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!encPlain" @click="encPlain = ''">清空</button>
      </div>
      <div class="block-head">
        <label for="aesEncPlain">明文</label>
        <span class="grow"></span>
      </div>
      <textarea
        id="aesEncPlain"
        v-model="encPlain"
        class="textarea"
        style="min-height: 64px"
        placeholder="输入要加密的明文；输入后自动加密"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!encRes.error" role="alert">
        <Icon name="alert" />
        <span>{{ encRes.error }}</span>
      </div>
      <div class="block-head iv-head">
        <span class="tag" title="加密自动生成的初始向量 · 解密时必须提供同名 IV">IV · {{ dataFormatLabel }}</span>
        <code class="mono iv-text">{{ encIv }}</code>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制 IV" title="复制 IV" :disabled="!encIv" @click="copyText(encIv, 'IV')">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <div class="block-head">
        <span>密文（{{ dataFormatLabel }}）</span>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制密文" title="复制密文" :disabled="!encRes.ok" @click="copyText(encRes.data, '加密结果')">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <div v-if="!encPlain.trim() || !key.trim()" class="placeholder">① 的密钥就绪并输入明文后，这里显示密文与 IV。</div>
          <span v-else-if="encRes.error">—</span>
          <template v-else>{{ encRes.data }}</template>
        </div>
        <div class="pane-foot">{{ encFoot }}</div>
      </div>
    </div>

    <!-- ③ 解密 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">3</span>
        <div class="step-texts">
          <span class="step-title">解密</span>
          <span class="step-hint">用同一把密钥与 IV 还原明文 · GCM 篡改自动识别</span>
        </div>
        <span class="grow"></span>
      </div>
      <div class="block-head">
        <label for="aesDecIv">IV（{{ dataFormatLabel }}，加密时返回的初始向量）</label>
        <span class="grow"></span>
      </div>
      <input
        id="aesDecIv"
        v-model="decIv"
        class="input"
        style="font-family: var(--mono)"
        placeholder="粘贴加密时返回的 IV"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="block-head" style="margin-top: 8px">
        <label for="aesDecCipher">密文（{{ dataFormatLabel }}）</label>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制明文" title="复制明文" :disabled="!decRes.ok" @click="copyText(decRes.data, '解密结果')">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <textarea
        id="aesDecCipher"
        v-model="decCipher"
        class="textarea"
        style="min-height: 64px"
        placeholder="粘贴收到的密文；输入后自动解密"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!decRes.error" role="alert">
        <Icon name="alert" />
        <span>{{ decRes.error }}</span>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <div v-if="!decCipher.trim() || !key.trim() || !decIv.trim()" class="placeholder">① 的密钥就绪并粘贴密文与 IV 后，这里显示还原的明文。</div>
          <span v-else-if="decRes.error">—</span>
          <template v-else>{{ decRes.data }}</template>
        </div>
        <div class="pane-foot">
          {{ decRes.ok ? `解密成功 · ${mode === 'GCM' ? 'GCM 已通过认证校验（内容未被篡改）' : 'CBC 还原完成'}` : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 长表单页：区块不参与 flex 压缩，超出部分交给 tool-body 自然滚动 */
.tool-body > .block {
  flex-shrink: 0;
}
.guide {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--muted);
  font-size: var(--fs-12);
  line-height: 1.6;
}
.guide b {
  color: var(--fg);
}
.step-head {
  display: flex;
  align-items: center;
  gap: var(--sp-8);
  min-height: 30px;
  margin-bottom: var(--sp-8);
  padding-bottom: var(--sp-8);
  border-bottom: 1px solid var(--border);
}
.step-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-size: var(--fs-12);
  font-weight: 600;
}
.step-texts {
  display: flex;
  align-items: baseline;
  gap: var(--sp-8);
  min-width: 0;
}
.step-title {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--fg);
}
.step-hint {
  font-size: var(--fs-12);
  color: var(--muted);
}
.iv-head {
  margin-top: 6px;
}
.mono {
  font-family: var(--mono);
}
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
