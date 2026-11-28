<script setup>
/**
 * RSA 加解密（R2.8）
 * 密钥对生成（2048/4096，SPKI/PKCS#8 PEM）· 私钥提取公钥
 * 公钥：加密（OAEP-SHA256 默认 / PKCS#1 v1.5）· 验签（SHA-256 / SHA-1）
 * 私钥：解密 · 签名；粘贴 PEM 即时校验并给出具体原因
 * 运算在 preload（node:crypto，uTools）或 mock（WebCrypto，浏览器调试）中执行
 */
import { computed, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { RSA_BITS, validatePem } from '../../utils/convert/rsa.js'
import { copyText } from '../../utils/clipboard.js'
import { toast } from '../../utils/toast.js'
import { services, servicesInfo } from '../../utils/utools.js'
import { useHistRecorder } from '../../utils/histRecorder.js'
import { useMainResult } from '../../utils/mainResult.js'
import { useReplay } from '../../utils/replay.js'
import { consumeEnterPayload } from '../../router.js'

/* ---------- 宿主能力（浏览器调试隐藏入口） ---------- */

/* preload 版本探测：RSA 六个动作是 v1.2 批次新增，旧装载的 preload 不含（W4：给出生效指引而非裸错误） */
const rsaReady =
  typeof services.rsaGenerateKeyPair === 'function' &&
  typeof services.rsaExtractPublic === 'function' &&
  typeof services.rsaPublicEncrypt === 'function' &&
  typeof services.rsaPrivateDecrypt === 'function' &&
  typeof services.rsaSign === 'function' &&
  typeof services.rsaVerify === 'function'
const PRELOAD_STALE_MSG =
  '当前装载的 preload 版本不含 RSA 能力：请在 uTools 开发者模式下重新安装本插件（或重启 uTools）后重试——修改 preload.js 需重新装载才生效'

/* ---------- 密钥对 ---------- */

const keyBits = ref(2048)
const generating = ref(false)
const keyPair = ref(null) // { publicKey, privateKey }

async function generate() {
  if (generating.value) return
  if (!rsaReady) {
    toast(PRELOAD_STALE_MSG)
    return
  }
  generating.value = true
  try {
    // 先让「生成中…」渲染，再执行耗时生成（4096 秒级）
    await new Promise((r) => setTimeout(r, 50))
    keyPair.value = await services.rsaGenerateKeyPair(keyBits.value)
    pubPem.value = keyPair.value.publicKey
    toast(`已生成 ${keyBits.value} 位密钥对`)
  } catch (e) {
    toast('生成失败：' + (e?.message || '未知原因'))
  } finally {
    generating.value = false
  }
}

function onCopyKey(text, label) {
  copyText(text, label)
}

/* ---------- 公钥区 ---------- */

const pubPem = ref('')
const pubErr = computed(() => {
  const r = validatePem(pubPem.value, 'public')
  return r.ok ? '' : r.error
})

const pubMode = ref('oaep') // oaep | pkcs1
const pubPlain = ref('')
const pubCipher = ref('') // 加密输出 / 验签输入共用（密文 Base64）
const pubHash = ref('sha256') // 验签哈希
const pubSig = ref('') // 验签签名输入
const pubRes = ref({ ok: false, empty: true }) // 加密结果
const verifyRes = ref(null) // true / false / null
/** 签名输入框误粘 PEM 公钥/私钥的识别（真机反馈高频误用：签名应为「生成签名」产出的 Base64 串） */
const sigLooksLikePem = computed(() => pubSig.value.trim().startsWith('-----BEGIN'))

/* RSA 单块加密上限：最大支持 4096 位密钥（OAEP-SHA256）约 470 字节明文，超限提前给出准确指引（W4 审查 I-1） */
const RSA_PLAIN_MAX = 470

function utf8ToB64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

/* 验签结论跟随数据失效：改签名或哈希后旧结论不得继续展示（W4 审查 I-2） */
watch([pubSig, pubHash], () => {
  verifyRes.value = null
})

let seq = 0
watch([pubPem, pubPlain, pubMode], async () => {
  const my = ++seq
  verifyRes.value = null
  if (!pubPlain.value.trim()) {
    pubRes.value = { ok: false, empty: true }
    return
  }
  if (!rsaReady) {
    pubRes.value = { ok: false, error: PRELOAD_STALE_MSG }
    return
  }
  if (pubErr.value) {
    pubRes.value = { ok: false, error: pubErr.value }
    return
  }
  const byteLen = new TextEncoder().encode(pubPlain.value).length
  if (byteLen > RSA_PLAIN_MAX) {
    pubRes.value = {
      ok: false,
      error: `明文超长（${byteLen} 字节）：RSA 单块加密受密钥长度限制（RSA-2048 约 190 字节、4096 约 470 字节），请缩短明文或改用 AES 加密`,
    }
    return
  }
  try {
    const dataB64 = utf8ToB64(pubPlain.value)
    const r = await services.rsaPublicEncrypt(pubPem.value, dataB64, pubMode.value)
    if (my !== seq) return
    pubRes.value = { ok: true, data: r }
  } catch (e) {
    if (my !== seq) return
    pubRes.value = { ok: false, error: e?.message || '加密失败' }
  }
})

async function onVerify() {
  if (!rsaReady || pubErr.value || !pubPlain.value.trim() || !pubSig.value.trim()) return
  if (sigLooksLikePem.value) {
    verifyRes.value = false // 走「误粘 PEM」专用提示分支
    return
  }
  try {
    verifyRes.value = (await services.rsaVerify(pubPem.value, pubPlain.value, pubSig.value, pubHash.value)) === true
  } catch (e) {
    verifyRes.value = false
  }
}

/* ---------- 私钥区 ---------- */

const priPem = ref('')
const priErr = computed(() => {
  const r = validatePem(priPem.value, 'private')
  return r.ok ? '' : r.error
})

const priMode = ref('oaep')
const priCipher = ref('')
const priText = ref('') // 解密输出
const priData = ref('') // 签名原文输入
const priHash = ref('sha256')
const priSig = ref('') // 签名输出
const priSigHash = ref('') // 签名产出时的哈希（展示用，随产出固化）
const priDecRes = ref({ ok: false, empty: true })
const signing = ref(false)

let seq2 = 0
watch([priPem, priCipher, priMode], async () => {
  const my = ++seq2
  if (!priCipher.value.trim()) {
    priDecRes.value = { ok: false, empty: true }
    return
  }
  if (!rsaReady) {
    priDecRes.value = { ok: false, error: PRELOAD_STALE_MSG }
    return
  }
  if (priErr.value) {
    priDecRes.value = { ok: false, error: priErr.value }
    return
  }
  try {
    const r = await services.rsaPrivateDecrypt(priPem.value, priCipher.value.trim(), priMode.value)
    if (my !== seq2) return
    // 解密结果为 UTF-8 文本
    const bytes = Uint8Array.from(atob(r), (c) => c.charCodeAt(0))
    priDecRes.value = { ok: true, data: new TextDecoder('utf-8').decode(bytes) }
  } catch (e) {
    if (my !== seq2) return
    priDecRes.value = { ok: false, error: e?.message || '解密失败' }
  }
})

async function onSign() {
  if (signing.value || priErr.value || !priData.value.trim()) return
  if (!rsaReady) {
    toast(PRELOAD_STALE_MSG)
    return
  }
  signing.value = true
  try {
    priSig.value = await services.rsaSign(priPem.value, priData.value, priHash.value)
    priSigHash.value = priHash.value // 固化生成时哈希，标签随产出而非随当前选择（W4 审查 I-3）
  } catch (e) {
    toast('签名失败：' + (e?.message || '未知原因'))
  } finally {
    signing.value = false
  }
}

/* 结果失效联动（W4 审查 I-2/I-3）：改签名或哈希后旧验签结论不得继续展示；密钥/原文/哈希变化使旧签名失效 */
watch([pubSig, pubHash], () => {
  verifyRes.value = null
})
watch([priPem, priData, priHash], () => {
  priSig.value = ''
  priSigHash.value = ''
})

/* ---------- 历史与主结果 ---------- */

useHistRecorder('rsa', () => [pubPlain.value, pubPem.value], (src) => {
  if (!src[0].trim() || pubErr.value) return null
  return pubRes.value.ok ? pubRes.value.data : null
})

useMainResult(() => {
  if (pubRes.value.ok) return { value: pubRes.value.data, label: '加密结果' }
  if (priSig.value) return { value: priSig.value, label: '签名' }
  if (priDecRes.value.ok) return { value: priDecRes.value.data, label: '解密结果' }
  return null
})

useReplay('rsa', (v) => (pubPlain.value = String(v ?? '')))

function extractPublic() {
  if (!keyPair.value) return
  try {
    pubPem.value = keyPair.value.publicKey
    toast('已提取公钥')
  } catch (e) {
    toast('提取失败：' + (e?.message || '未知原因'))
  }
}

async function extractFromPrivate() {
  if (priErr.value) return
  try {
    pubPem.value = await services.rsaExtractPublic(priPem.value)
    toast('已提取公钥')
  } catch (e) {
    toast('提取失败：' + (e?.message || '浏览器调试不支持该操作'))
  }
}

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) pubPlain.value = String(p)
})
</script>

<template>
  <div class="tool-body">
    <!-- preload 版本过旧提示（v1.2 批次新增能力需要重新装载插件生效） -->
    <div v-if="!rsaReady" class="alert" role="alert">
      <Icon name="alert" />
      <div class="alert-body">
        {{ PRELOAD_STALE_MSG }}
        <div style="margin-top: 4px; font-family: var(--mono); font-size: var(--fs-12)">
          诊断：当前 preload 构建标记 = {{ servicesInfo.buildTag }}；可用动作 = {{ servicesInfo.methods || '（无）' }}。
          请核对 uTools 开发者面板中本插件绑定的目录是否为仓库的 <b>dist</b> 目录（该目录下 preload.js 应含 rsaGenerateKeyPair）。
        </div>
      </div>
    </div>

    <!-- 密钥对生成 -->
    <div class="block">
      <div class="block-head">
        <span>密钥对生成</span>
        <div class="seg" role="group" aria-label="密钥长度">
          <button
            v-for="b in RSA_BITS"
            :key="b"
            type="button"
            :aria-pressed="keyBits === b"
            :title="b === 4096 ? '生成耗时秒级' : ''"
            @click="keyBits = b"
          >
            RSA-{{ b }}
          </button>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="generating" @click="generate">
          <Icon name="swap" size="sm" />{{ generating ? '生成中…' : '生成密钥对' }}
        </button>
        <button
          v-if="keyPair"
          type="button"
          class="btn btn--ghost"
          title="把当前生成的公钥填入下方公钥区"
          @click="extractPublic"
        >
          填入公钥
        </button>
      </div>
      <div v-if="keyPair" class="kv-grid">
        <div class="kv-col">
          <div class="block-head">
            <span>公钥（SPKI PEM）</span>
            <span class="grow"></span>
            <button type="button" class="icon-btn" aria-label="复制公钥" title="复制公钥" @click="onCopyKey(keyPair.publicKey, '公钥')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <div class="pane pane--text pem-pane">
            <div class="pane-scroll"><span class="mono">{{ keyPair.publicKey }}</span></div>
          </div>
        </div>
        <div class="kv-col">
          <div class="block-head">
            <span>私钥（PKCS#8 PEM，妥善保管）</span>
            <span class="grow"></span>
            <button type="button" class="icon-btn" aria-label="复制私钥" title="复制私钥" @click="onCopyKey(keyPair.privateKey, '私钥')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <div class="pane pane--text pem-pane">
            <div class="pane-scroll"><span class="mono">{{ keyPair.privateKey }}</span></div>
          </div>
        </div>
      </div>
      <div v-else class="placeholder" style="padding: 6px 0">
        点击「生成密钥对」开始；密钥仅在本机内存中生成与展示，不落盘、不上传。
      </div>
    </div>

    <!-- 公钥操作 -->
    <div class="block">
      <div class="block-head">
        <span>公钥 · 加密 / 验签</span>
        <div class="seg" role="group" aria-label="加密填充">
          <button type="button" :aria-pressed="pubMode === 'oaep'" title="OAEP-SHA256（推荐）" @click="pubMode = 'oaep'">OAEP</button>
          <button type="button" :aria-pressed="pubMode === 'pkcs1'" title="PKCS#1 v1.5（兼容旧系统）" @click="pubMode = 'pkcs1'">PKCS#1</button>
        </div>
        <span class="grow"></span>
        <button
          v-if="priPem"
          type="button"
          class="btn btn--ghost"
          title="由下方私钥导出公钥"
          @click="extractFromPrivate"
        >
          私钥提取公钥
        </button>
      </div>
      <textarea
        v-model="pubPem"
        class="textarea pem-textarea"
        style="min-height: 72px"
        placeholder="粘贴公钥 PEM（-----BEGIN PUBLIC KEY-----）"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!pubErr" role="alert">
        <Icon name="alert" />
        <span>{{ pubErr }}</span>
      </div>

      <div class="block-head" style="margin-top: 8px">
        <label for="rsaPubPlain">原文（加密 / 验签共用）</label>
        <span class="grow"></span>
      </div>
      <textarea
        id="rsaPubPlain"
        v-model="pubPlain"
        class="textarea"
        style="min-height: 64px"
        placeholder="输入要加密的明文；同一原文也可用于验签"
        spellcheck="false"
      ></textarea>

      <div class="block-head" style="margin-top: 8px">
        <span>加密结果（Base64）</span>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制加密结果" title="复制加密结果" :disabled="!pubRes.ok" @click="copyText(pubRes.data, '加密结果')">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <div v-if="!pubPlain.trim()" class="placeholder">输入原文后自动加密。</div>
          <span v-else-if="pubErr">—</span>
          <template v-else>{{ pubRes.ok ? pubRes.data : pubRes.error || '—' }}</template>
        </div>
      </div>

      <div class="block-head" style="margin-top: 8px">
        <label for="rsaPubSig">验签：签名（Base64）</label>
        <div class="seg" role="group" aria-label="验签哈希">
          <button type="button" :aria-pressed="pubHash === 'sha256'" @click="pubHash = 'sha256'">SHA-256</button>
          <button type="button" :aria-pressed="pubHash === 'sha1'" @click="pubHash = 'sha1'">SHA-1</button>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!rsaReady || pubErr || !pubPlain.trim() || !pubSig.trim()" @click="onVerify">验证签名</button>
        <span v-if="verifyRes === true" class="tag tag--ok">验签通过</span>
        <span v-else-if="verifyRes === false && sigLooksLikePem" class="tag tag--err">粘贴的是 PEM 公钥，不是签名——请先在「私钥」区用「生成签名」产出 Base64 签名</span>
        <span v-else-if="verifyRes === false" class="tag tag--err">验签失败（内容或签名被篡改，或密钥/哈希不匹配）</span>
      </div>
      <input
        id="rsaPubSig"
        v-model="pubSig"
        class="input"
        style="font-family: var(--mono)"
        placeholder="粘贴「生成签名」产出的 Base64 签名（不是公钥，也不是密文）"
        autocomplete="off"
        spellcheck="false"
      />
    </div>

    <!-- 私钥操作 -->
    <div class="block">
      <div class="block-head">
        <span>私钥 · 解密 / 签名</span>
        <div class="seg" role="group" aria-label="解密填充">
          <button type="button" :aria-pressed="priMode === 'oaep'" @click="priMode = 'oaep'">OAEP</button>
          <button type="button" :aria-pressed="priMode === 'pkcs1'" @click="priMode = 'pkcs1'">PKCS#1</button>
        </div>
      </div>
      <textarea
        v-model="priPem"
        class="textarea pem-textarea"
        style="min-height: 72px"
        placeholder="粘贴私钥 PEM（-----BEGIN PRIVATE KEY-----）"
        spellcheck="false"
      ></textarea>
      <div class="alert" :hidden="!priErr" role="alert">
        <Icon name="alert" />
        <span>{{ priErr }}</span>
      </div>

      <div class="block-head" style="margin-top: 8px">
        <label for="rsaPriCipher">密文（Base64，与加密填充方式一致）</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="!priDecRes.ok" @click="copyText(priDecRes.data, '解密结果')">
          <Icon name="copy" size="sm" />复制
        </button>
      </div>
      <input
        id="rsaPriCipher"
        v-model="priCipher"
        class="input"
        style="font-family: var(--mono)"
        placeholder="粘贴加密结果"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="pane pane--text" style="margin-top: 6px">
        <div class="pane-scroll">
          <div v-if="!priCipher.trim()" class="placeholder">粘贴密文后自动解密。</div>
          <span v-else-if="priErr">—</span>
          <template v-else>{{ priDecRes.ok ? priDecRes.data : priDecRes.error || '—' }}</template>
        </div>
      </div>

      <div class="block-head" style="margin-top: 8px">
        <label for="rsaPriData">签名：原文</label>
        <div class="seg" role="group" aria-label="签名哈希">
          <button type="button" :aria-pressed="priHash === 'sha256'" @click="priHash = 'sha256'">SHA-256</button>
          <button type="button" :aria-pressed="priHash === 'sha1'" @click="priHash = 'sha1'">SHA-1</button>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" :disabled="priErr || !priData.trim() || signing" @click="onSign">
          {{ signing ? '签名中…' : '生成签名' }}
        </button>
      </div>
      <textarea
        id="rsaPriData"
        v-model="priData"
        class="textarea"
        style="min-height: 56px"
        placeholder="输入要签名的原文"
        spellcheck="false"
      ></textarea>
      <div class="block-head" v-if="priSig">
        <span class="tag">签名已生成（Base64 · {{ priSigHash.toUpperCase() }}）</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="copyText(priSig, '签名')">
          <Icon name="copy" size="sm" />复制签名
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 长表单页：区块不参与 flex 压缩，超出部分交给 tool-body 自然滚动（否则内容互相叠压） */
.tool-body > .block {
  flex-shrink: 0;
}
.pem-textarea {
  font-family: var(--mono);
  font-size: var(--fs-12);
}
.pem-pane {
  max-height: 120px;
}
.kv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-12);
  margin-top: 8px;
}
.kv-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.mono {
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
