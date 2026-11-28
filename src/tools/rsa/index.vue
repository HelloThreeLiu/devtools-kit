<script setup>
/**
 * RSA 加解密（R2.8）
 * 按任务动线分五个步骤区：① 密钥（生成/粘贴）→ ② 加密（公钥）→ ③ 解密（私钥）
 * → ④ 签名（私钥）→ ⑤ 验签（公钥）。
 * 密钥对生成（2048/4096，SPKI/PKCS#8 PEM）· 加密填充 OAEP-SHA256 / PKCS#1 v1.5
 * · 签名哈希 SHA-256 / SHA-1 · 粘贴 PEM 即时校验并给出具体原因
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

/* preload 版本探测：RSA 六个动作是 v1.2 批次新增，旧装载的 preload 不含（给出生效指引而非裸错误） */
const rsaReady =
  typeof services.rsaGenerateKeyPair === 'function' &&
  typeof services.rsaExtractPublic === 'function' &&
  typeof services.rsaPublicEncrypt === 'function' &&
  typeof services.rsaPrivateDecrypt === 'function' &&
  typeof services.rsaSign === 'function' &&
  typeof services.rsaVerify === 'function'
const PRELOAD_STALE_MSG =
  '当前装载的 preload 版本不含 RSA 能力：请在 uTools 开发者模式下重新安装本插件（或重启 uTools）后重试——修改 preload.js 需重新装载才生效'

/* ---------- ① 密钥 ---------- */

const keyBits = ref(2048)
const generating = ref(false)
const pubPem = ref('')
const priPem = ref('')
const pubErr = computed(() => {
  const r = validatePem(pubPem.value, 'public')
  return r.ok ? '' : r.error
})
const priErr = computed(() => {
  const r = validatePem(priPem.value, 'private')
  return r.ok ? '' : r.error
})
const pubStatusText = computed(() => {
  if (!pubPem.value.trim()) return '未就绪 · 粘贴或生成'
  return pubErr.value ? '格式有误' : '就绪 ✓'
})
const priStatusText = computed(() => {
  if (!priPem.value.trim()) return '未就绪 · 粘贴或生成'
  return priErr.value ? '格式有误' : '就绪 ✓'
})

let generatingSeq = 0
async function generate() {
  if (generating.value) return
  if (!rsaReady) {
    toast(PRELOAD_STALE_MSG)
    return
  }
  generating.value = true
  const my = ++generatingSeq
  try {
    // 先让「生成中…」渲染，再执行耗时生成（4096 秒级）
    await new Promise((r) => setTimeout(r, 50))
    const kp = await services.rsaGenerateKeyPair(keyBits.value)
    if (my !== generatingSeq) return
    pubPem.value = kp.publicKey
    priPem.value = kp.privateKey
    toast(`已生成 ${keyBits.value} 位密钥对并填入下方输入框`)
  } catch (e) {
    if (my !== generatingSeq) return
    toast('生成失败：' + (e?.message || '未知原因'))
  } finally {
    if (my === generatingSeq) generating.value = false
  }
}

/** 私钥提取公钥（等价 openssl rsa -pubout）：校验私钥区后导出并填入公钥区 */
async function extractFromPrivate() {
  if (priErr.value) return
  if (!rsaReady) {
    toast(PRELOAD_STALE_MSG)
    return
  }
  try {
    pubPem.value = await services.rsaExtractPublic(priPem.value)
    toast('已由私钥导出公钥')
  } catch (e) {
    toast('提取失败：' + (e?.message || '未知原因'))
  }
}

/* ---------- ② 加密（公钥） ---------- */

const pubMode = ref('oaep') // oaep | pkcs1
const pubPlain = ref('')
const pubRes = ref({ ok: false, empty: true })
/** 签名输入误粘 PEM 公钥/私钥的识别（真机反馈高频误用：签名应为「生成签名」产出的 Base64 串） */
const pubSig = ref('')
const pubSigLooksLikePem = computed(() => pubSig.value.trim().startsWith('-----BEGIN'))
const pubHash = ref('sha256') // 验签哈希
const verifyRes = ref(null) // true / false / null

const RSA_PLAIN_MAX = 470 // 单块加密上限：最大支持 4096 位密钥（OAEP-SHA256）约 470 字节明文

function utf8ToB64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

let seq = 0
watch([pubPem, pubPlain, pubMode], async () => {
  const my = ++seq
  verifyRes.value = null
  if (!pubPlain.value.trim() || !pubPem.value.trim()) {
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
    const r = await services.rsaPublicEncrypt(pubPem.value, utf8ToB64(pubPlain.value), pubMode.value)
    if (my !== seq) return
    pubRes.value = { ok: true, data: r }
  } catch (e) {
    if (my !== seq) return
    pubRes.value = { ok: false, error: e?.message || '加密失败' }
  }
})

/* ---------- ④ 签名（私钥） ---------- */

const priData = ref('') // 签名原文输入
const priHash = ref('sha256')
const priSig = ref('') // 签名输出
const priSigHash = ref('') // 签名产出时的哈希（展示用，随产出固化）
const signing = ref(false)

/* 结果失效联动（W4 审查 I-2/I-3）：改签名或哈希后旧验签结论不得继续展示；密钥/原文/哈希变化使旧签名失效 */
watch([pubSig, pubHash], () => {
  verifyRes.value = null
})
watch([priPem, priData, priHash], () => {
  priSig.value = ''
  priSigHash.value = ''
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
    priSigHash.value = priHash.value // 固化生成时哈希，标签随产出而非随当前选择
  } catch (e) {
    toast('签名失败：' + (e?.message || '未知原因'))
  } finally {
    signing.value = false
  }
}

/* ---------- ③ 解密（私钥） ---------- */

const priMode = ref('oaep')
const priCipher = ref('')
const priDecRes = ref({ ok: false, empty: true })

let seq2 = 0
watch([priPem, priCipher, priMode], async () => {
  const my = ++seq2
  if (!priCipher.value.trim() || !priPem.value.trim()) {
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

/* ---------- ⑤ 验签（公钥） ---------- */

async function onVerify() {
  if (!rsaReady || pubErr.value || !pubPlain.value.trim() || !pubSig.value.trim()) return
  if (pubSigLooksLikePem.value) {
    verifyRes.value = false // 走「误粘 PEM」专用提示分支
    return
  }
  try {
    verifyRes.value = (await services.rsaVerify(pubPem.value, pubPlain.value, pubSig.value, pubHash.value)) === true
  } catch (e) {
    verifyRes.value = false
  }
}

/* ---------- 历史 / 主结果 / 回放 ---------- */

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

onMounted(() => {
  const p = consumeEnterPayload()
  if (p) pubPlain.value = String(p)
})
</script>

<template>
  <div class="tool-body">
    <!-- preload 版本过旧提示 -->
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

    <!-- 使用指引 -->
    <div class="guide">
      <span>四种操作 · 两把钥匙：<b>加密 / 验签</b> 用公钥，<b>解密 / 签名</b> 用私钥。</span>
      <span>典型流程：把公钥发给对方 → 对方用你的公钥加密后发回 → 你用私钥解密；要证明内容出自你手 → 私钥签名，对方用你的公钥验签。</span>
    </div>

    <!-- ① 密钥 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">1</span>
        <div class="step-texts">
          <span class="step-title">密钥</span>
          <span class="step-hint">公钥发给别人 · 私钥自己保管；也可直接粘贴已有的密钥</span>
        </div>
        <span class="grow"></span>
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
        <button type="button" class="btn btn--ghost" :disabled="generating" @click="generate">
          <Icon name="swap" size="sm" />{{ generating ? '生成中…' : '生成密钥对' }}
        </button>
        <button
          v-if="priPem && !priErr"
          type="button"
          class="btn btn--ghost"
          title="由下方私钥导出公钥并填入"
          @click="extractFromPrivate"
        >
          私钥提取公钥
        </button>
      </div>
      <div class="key-cols">
        <div class="key-col">
          <div class="block-head">
            <label for="rsaPubPem">公钥（SPKI PEM · 用于加密与验签）</label>
            <span class="tag" :class="pubStatusText.includes('✓') ? 'tag--ok' : pubStatusText.includes('有误') ? 'tag--err' : ''">
              {{ pubStatusText }}
            </span>
            <span class="grow"></span>
            <button type="button" class="icon-btn" aria-label="复制公钥" title="复制公钥" :disabled="!pubPem" @click="copyText(pubPem, '公钥')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <textarea
            id="rsaPubPem"
            v-model="pubPem"
            class="textarea pem-textarea"
            style="min-height: 72px"
            placeholder="粘贴公钥 PEM（-----BEGIN PUBLIC KEY-----）"
            spellcheck="false"
          ></textarea>
          <div class="alert" :hidden="!pubPem || !pubErr" role="alert">
            <Icon name="alert" />
            <span>{{ pubErr }}</span>
          </div>
        </div>
        <div class="key-col">
          <div class="block-head">
            <label for="rsaPriPem">私钥（PKCS#8 PEM · 用于解密与签名，妥善保管）</label>
            <span class="tag" :class="priStatusText.includes('✓') ? 'tag--ok' : priStatusText.includes('有误') ? 'tag--err' : ''">
              {{ priStatusText }}
            </span>
            <span class="grow"></span>
            <button type="button" class="icon-btn" aria-label="复制私钥" title="复制私钥" :disabled="!priPem" @click="copyText(priPem, '私钥')">
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <textarea
            id="rsaPriPem"
            v-model="priPem"
            class="textarea pem-textarea"
            style="min-height: 72px"
            placeholder="粘贴私钥 PEM（-----BEGIN PRIVATE KEY-----）"
            spellcheck="false"
          ></textarea>
          <div class="alert" :hidden="!priPem || !priErr" role="alert">
            <Icon name="alert" />
            <span>{{ priErr }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ② 加密 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">2</span>
        <div class="step-texts">
          <span class="step-title">加密</span>
          <span class="step-hint">用上方公钥把明文变成密文 · 只有对应私钥能解开</span>
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="加密填充">
          <button type="button" :aria-pressed="pubMode === 'oaep'" title="OAEP-SHA256（推荐）" @click="pubMode = 'oaep'">OAEP</button>
          <button type="button" :aria-pressed="pubMode === 'pkcs1'" title="PKCS#1 v1.5（兼容旧系统）" @click="pubMode = 'pkcs1'">PKCS#1</button>
        </div>
      </div>
      <div class="block-head">
        <label for="rsaPubPlain">明文（单次最多约 470 字节，长内容请用 AES）</label>
        <span class="grow"></span>
      </div>
      <textarea
        id="rsaPubPlain"
        v-model="pubPlain"
        class="textarea"
        style="min-height: 64px"
        placeholder="输入要加密的明文；输入后自动加密"
        spellcheck="false"
      ></textarea>
      <div class="block-head" style="margin-top: 6px">
        <span>密文（Base64）</span>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制密文" title="复制密文" :disabled="!pubRes.ok" @click="copyText(pubRes.data, '加密结果')">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <div class="pane pane--text">
        <div class="pane-scroll">
          <div v-if="!pubPlain.trim() || !pubPem.trim()" class="placeholder">上方公钥就绪并输入明文后，这里显示密文。</div>
          <span v-else-if="pubRes.error">—</span>
          <template v-else>{{ pubRes.data }}</template>
        </div>
      </div>
    </div>

    <!-- ③ 解密 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">3</span>
        <div class="step-texts">
          <span class="step-title">解密</span>
          <span class="step-hint">用私钥还原「用你的公钥加密」的密文</span>
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="解密填充">
          <button type="button" :aria-pressed="priMode === 'oaep'" @click="priMode = 'oaep'">OAEP</button>
          <button type="button" :aria-pressed="priMode === 'pkcs1'" @click="priMode = 'pkcs1'">PKCS#1</button>
        </div>
      </div>
      <div class="block-head">
        <label for="rsaPriCipher">密文（Base64，与加密时的填充方式一致）</label>
        <span class="grow"></span>
        <button type="button" class="icon-btn" aria-label="复制解密结果" title="复制解密结果" :disabled="!priDecRes.ok" @click="copyText(priDecRes.data, '解密结果')">
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <input
        id="rsaPriCipher"
        v-model="priCipher"
        class="input"
        style="font-family: var(--mono)"
        placeholder="粘贴收到的密文"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="pane pane--text" style="margin-top: 6px">
        <div class="pane-scroll">
          <div v-if="!priCipher.trim() || !priPem.trim()" class="placeholder">私钥就绪并粘贴密文后，这里显示还原的明文。</div>
          <span v-else-if="priDecRes.error">—</span>
          <template v-else>{{ priDecRes.data }}</template>
        </div>
      </div>
    </div>

    <!-- ④ 签名 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">4</span>
        <div class="step-texts">
          <span class="step-title">签名</span>
          <span class="step-hint">用私钥证明「这段内容出自我手、未被篡改」</span>
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="签名哈希">
          <button type="button" :aria-pressed="priHash === 'sha256'" @click="priHash = 'sha256'">SHA-256</button>
          <button type="button" :aria-pressed="priHash === 'sha1'" @click="priHash = 'sha1'">SHA-1</button>
        </div>
        <button type="button" class="btn btn--ghost" :disabled="priErr || !priData.trim() || signing" @click="onSign">
          {{ signing ? '签名中…' : '生成签名' }}
        </button>
      </div>
      <div class="block-head">
        <label for="rsaPriData">要签名的原文</label>
        <span class="grow"></span>
      </div>
      <textarea
        id="rsaPriData"
        v-model="priData"
        class="textarea"
        style="min-height: 56px"
        placeholder="输入要签名的原文"
        spellcheck="false"
      ></textarea>
      <div class="block-head sig-output-head" v-if="priSig">
        <span class="tag">签名已生成（Base64 · {{ priSigHash.toUpperCase() }}）</span>
        <span class="grow"></span>
        <button type="button" class="btn btn--ghost" @click="copyText(priSig, '签名')">
          <Icon name="copy" size="sm" />复制签名
        </button>
      </div>
    </div>

    <!-- ⑤ 验签 -->
    <div class="block">
      <div class="step-head">
        <span class="step-badge">5</span>
        <div class="step-texts">
          <span class="step-title">验签</span>
          <span class="step-hint">用公钥核对「签名与原文是否匹配」——核对时原文需与签名时一致</span>
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="验签哈希">
          <button type="button" :aria-pressed="pubHash === 'sha256'" @click="pubHash = 'sha256'">SHA-256</button>
          <button type="button" :aria-pressed="pubHash === 'sha1'" @click="pubHash = 'sha1'">SHA-1</button>
        </div>
        <button type="button" class="btn btn--ghost" :disabled="!rsaReady || pubErr || !pubPlain.trim() || !pubSig.trim() || pubSigLooksLikePem" @click="onVerify">验证签名</button>
        <span v-if="verifyRes === true" class="tag tag--ok">验签通过</span>
        <span v-else-if="verifyRes === false && pubSigLooksLikePem" class="tag tag--err">粘贴的是 PEM 公钥，不是签名——请先在「④ 签名」用「生成签名」产出 Base64 签名</span>
        <span v-else-if="verifyRes === false" class="tag tag--err">验签失败（内容或签名被篡改，或密钥/哈希不匹配）</span>
      </div>
      <div class="block-head">
        <label for="rsaPubSig">对方给的签名（Base64）</label>
        <span class="grow"></span>
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
      <div class="pane pane--text" style="margin-top: 6px">
        <div class="pane-scroll">
          <div class="placeholder">被验签的原文使用上方「② 加密」的明文输入框（两者共用，保证核对的是同一份内容）。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 步骤区卡片化：边框 + 内边距 + 表面底色，区块间自然分离（真机反馈：页面拥挤、内容贴在一起） */
.tool-body > .block {
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-12) var(--sp-14);
  background: var(--surface);
}
.guide {
  flex-shrink: 0;
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
  color: var(--accent-text, #fff);
  font-size: var(--fs-12);
  font-weight: 600;
}
/* 结果面板与上方输入框的最小间距（直连时会贴在一起，W4 真机反馈） */
.pane {
  margin-top: 8px;
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
.key-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-12);
  margin-top: 8px;
}
.key-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pem-textarea {
  font-family: var(--mono);
  font-size: var(--fs-12);
}
/* 签名输出行：.block-head 定高 22px 装不下 30px 按钮，放开高度并留出与上方输入框的间距（W4 真机反馈） */
.sig-output-head {
  height: auto;
  min-height: 30px;
  margin-top: 10px;
}
</style>
