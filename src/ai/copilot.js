/**
 * BuildM8 AI Copilot — 自然語言 → 五金組合矩陣
 * ---------------------------------------------------------------------------
 * 處理流程（偽代碼）：
 *
 *   async function copilot(userText, pkg):
 *     intent   = parseIntent(userText)              // ① 解析：要做什麼、尺寸、風格
 *     parts    = matchParts(intent, pkg)             // ② 比對 Package 內有哪些標準件可用
 *     assembly = await generate(intent, parts, pkg)  // ③ 產生 [{partId, params, position, rotation}]
 *     assembly = validateAssembly(assembly, pkg)     // ④ 驗證：partId 必須存在、參數貼齊現貨規格
 *     return assembly                                // ⑤ 前端 loadAssembly() 逐顆拼裝到畫布
 *
 * generate() 有兩種實作：
 *   - mock  ：關鍵字 → 參數化產生器（builders.js），離線即可示範
 *   - claude：把 Package 目錄當作 system prompt，要求以 JSON Schema 結構化輸出
 */
import Anthropic from '@anthropic-ai/sdk'
import { ASSEMBLY_JSON_SCHEMA, ASSEMBLY_SCHEMA } from '../data/schema'
import { normalizeParams } from '../data/parts'
import { buildCdRack, buildClockCase, buildPipeShelf, buildSquareFrame } from './builders'

export const STAGES = [
  { key: 'parse', label: '解析需求' },
  { key: 'match', label: '比對 Package 標準件' },
  { key: 'generate', label: '計算組合矩陣' },
  { key: 'validate', label: '驗證規格與孔位' },
]

const INTENTS = [
  { key: 'clock', words: ['時鐘', '鐘', 'clock', '掛鐘', '座鐘'], builder: buildClockCase, needs: ['plywood_panel', 'threaded_rod_m8', 'hex_nut_m8', 'washer_m8', 'cap_nut_m8'] },
  { key: 'cd_rack', words: ['cd', '光碟', '唱片', '收納', '展示架', '書擋'], builder: buildCdRack, needs: ['plywood_panel', 'threaded_rod_m8', 'hex_nut_m8', 'washer_m8', 'cap_nut_m8'] },
  { key: 'pipe_shelf', words: ['水管', '工業風', '層架', '置物架', '書架', 'pipe', 'shelf'], builder: buildPipeShelf, needs: ['gi_pipe_15a', 'gi_tee_15a', 'gi_elbow_15a', 'gi_flange_15a', 'plywood_panel'] },
  { key: 'square_frame', words: ['框架', '方框', '框', 'frame', '骨架', '方形', '角鐵'], builder: buildSquareFrame, needs: ['threaded_rod_m8', 'perforated_bar', 'l_bracket', 'hex_nut_m8', 'washer_m8', 'cap_nut_m8'] },
]

/** ① 解析自然語言（Mock：關鍵字 + 尺寸抽取） */
export function parseIntent(text) {
  const t = text.toLowerCase()
  const scored = INTENTS.map((it) => ({ it, score: it.words.filter((w) => t.includes(w)).length }))
  scored.sort((a, b) => b.score - a.score)
  const hit = scored[0].score > 0 ? scored[0].it : null
  // 尺寸：「30公分」「20 cm」「300mm」
  const dims = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(公分|cm|釐米|mm|毫米)/g)].map((m) =>
    m[2] === 'mm' || m[2] === '毫米' ? Number(m[1]) : Number(m[1]) * 10,
  )
  return { key: hit?.key ?? null, intent: hit, dims, raw: text }
}

/** ② 比對 Package：確認所需標準件都存在 */
export function matchParts(intent, pkg) {
  const ids = new Set(pkg.parts.map((p) => p.id))
  const needs = intent?.needs ?? []
  return { found: needs.filter((n) => ids.has(n)), missing: needs.filter((n) => !ids.has(n)) }
}

/** ④ 驗證 / 修正 AI 輸出 */
export function validateAssembly(raw, pkg) {
  const warnings = []
  const items = []
  for (const it of raw.items ?? []) {
    const def = pkg.parts.find((p) => p.id === it.partId)
    if (!def) {
      warnings.push(`Package 中沒有「${it.partId}」，已略過`)
      continue
    }
    const params = normalizeParams(def, cleanNulls(it.params ?? (it.length ? { length: it.length } : {})))
    const pos = vec3(it.position)
    const rot = vec3(it.rotation)
    items.push({ partId: it.partId, ...(def.params ? { params } : {}), position: pos, rotation: rot })
  }
  return { ...raw, schema: ASSEMBLY_SCHEMA, packageId: pkg.packageId, items, warnings }
}

const vec3 = (v) => (Array.isArray(v) ? [0, 1, 2].map((i) => Number(v[i]) || 0) : [0, 0, 0])
const cleanNulls = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== null && v !== undefined))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 主入口
 * @param {string} text
 * @param {{ pkg, mode:'mock'|'claude', apiKey?:string, onStage?:(key:string)=>void }} opts
 */
export async function runCopilot(text, { pkg, mode = 'mock', apiKey, onStage = () => {} }) {
  onStage('parse')
  const intent = parseIntent(text)
  await sleep(mode === 'mock' ? 380 : 0)

  onStage('match')
  const match = matchParts(intent.intent, pkg)
  await sleep(mode === 'mock' ? 420 : 0)

  onStage('generate')
  let raw
  if (mode === 'claude' && apiKey) {
    raw = await generateWithClaude(text, pkg, apiKey)
  } else {
    await sleep(520)
    if (!intent.intent) {
      return {
        kind: 'clarify',
        text: '我還不太確定你想做什麼 🤔 目前 Mock 模式認得：「方形時鐘外殼」、「CD 收納展示架」、「簡易方形框架」、「工業風水管層架」。也可以在右上角 ⚙ 設定 Claude API 金鑰，讓真正的 AI 自由設計。',
      }
    }
    raw = intent.intent.builder(pkg, dimsFor(intent))
  }

  onStage('validate')
  await sleep(mode === 'mock' ? 300 : 0)
  const assembly = validateAssembly(raw, pkg)
  return { kind: 'assembly', assembly, intent, match }
}

function dimsFor({ key, dims }) {
  const [a, b] = dims
  const pick = (v, list) => (v ? list.reduce((x, y) => (Math.abs(y - v) < Math.abs(x - v) ? y : x)) : undefined)
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
  switch (key) {
    case 'clock': return clean({ size: a ? Math.min(400, Math.max(120, a)) : undefined, depth: b ? Math.min(100, Math.max(20, b)) : undefined })
    case 'square_frame': return clean({ size: pick(a, [150, 200, 300, 450, 600]), height: b ? Math.min(1000, Math.max(100, b)) : undefined })
    case 'cd_rack': return clean({ width: a ? Math.min(600, Math.max(200, a)) : undefined })
    case 'pipe_shelf': return clean({ rise: b ? Math.min(600, Math.max(150, b)) : undefined })
    default: return {}
  }
}

// ---------------------------------------------------------------------------
// ③-b 真正的 LLM：Claude + 結構化輸出（JSON Schema）
// ---------------------------------------------------------------------------

/** 把 Package 壓縮成 LLM 好讀的目錄（只給 ID、標準、幾何參數、可選規格） */
export function packageCatalogForLLM(pkg) {
  return pkg.parts.map((p) => ({
    partId: p.id,
    name: p.name['zh-TW'],
    standard: p.standard,
    geometry: p.geometry,
    params: Object.fromEntries(
      Object.entries(p.params ?? {}).map(([k, v]) => [k, { options: v.options, custom: !!v.custom, min: v.min, max: v.max }]),
    ),
  }))
}

const SYSTEM_PROMPT = (pkg) => `你是 BuildM8 的五金共創夥伴，協助 DIY 新手用台灣五金行買得到的標準件設計生活用品。
只能使用下方 Package 目錄中的 partId。輸出一份可直接在 3D 畫布拼裝的組合矩陣。

座標規則：
- 單位 mm，Y 軸朝上，地面 y=0；rotation 為角度（Euler XYZ）。
- 每個零件的局部原點與方向：
  * perforated_bar：中心為原點，長邊沿 X、厚度沿 Y，孔沿 X 以 pitch 排列並置中，孔軸 Y。
  * l_bracket：外角為原點，水平腳沿 +X、垂直腳沿 +Y，寬度沿 Z 置中；孔距外角 hole_offset。
  * threaded_rod_m8 / gi_pipe_15a：中心為原點，軸沿 Y。
  * hex_bolt_m8：原點在頭部下緣，頭朝 +Y、螺桿朝 -Y。
  * hex_nut_m8 / washer_m8：中心為原點，軸沿 Y。cap_nut_m8：原點在底面，圓頂朝 +Y。
  * gi_tee_15a：中心為原點，直通口 ±X、分支口 +Y，各口中心距 a（插入深度 engage）。
  * gi_elbow_15a：中心為原點，兩口 +X 與 +Y。gi_flange_15a：原點在底面中心，接口朝 +Y。
  * plywood_panel：中心為原點，寬沿 X、深沿 Z、厚沿 Y；pattern=corners 為距邊 15mm 四角孔。
- 螺帽要確實夾住板材 / 洞洞鐵，螺條必須穿過孔位；零件不可懸空。
- params 只填該零件有的參數，其餘填 null。
- steps 用繁體中文、給新手的組裝步驟；summary 說明設計理念。

Package（${pkg.packageId}）：
${JSON.stringify(packageCatalogForLLM(pkg))}`

export async function generateWithClaude(text, pkg, apiKey) {
  // 注意：瀏覽器直連只適合本地原型。正式上線請改由後端代理呼叫，避免金鑰外洩。
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // 安全分類器拒答時，由伺服器自動改用建議的備援模型
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: ASSEMBLY_JSON_SCHEMA },
    },
    system: SYSTEM_PROMPT(pkg),
    messages: [{ role: 'user', content: text }],
  })
  if (response.stop_reason === 'refusal') {
    throw new Error(`AI 無法處理這個請求${response.stop_details?.explanation ? `：${response.stop_details.explanation}` : ''}`)
  }
  if (response.stop_reason === 'max_tokens') throw new Error('設計太大，輸出被截斷了，請把需求縮小一點再試。')
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('AI 沒有回傳設計內容。')
  return JSON.parse(textBlock.text)
}
