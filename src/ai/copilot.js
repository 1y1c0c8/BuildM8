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
import { normalizeParams, resolvePartRef } from '../data/parts'
import { buildCdRack, buildClockCase, buildPipeShelf, buildSquareFrame } from './builders'

export const STAGES = [
  { key: 'parse', label: '解析需求' },
  { key: 'match', label: '比對 Package 標準件' },
  { key: 'generate', label: '計算組合矩陣' },
  { key: 'validate', label: '驗證規格與孔位' },
]

const INTENTS = [
  { key: 'clock', words: ['時鐘', '鐘', 'clock', '掛鐘', '座鐘'], builder: buildClockCase, needs: ['plywood_panel', 'threaded_rod', 'hex_nut', 'washer', 'cap_nut'] },
  { key: 'cd_rack', words: ['cd', '光碟', '唱片', '收納', '展示架', '書擋'], builder: buildCdRack, needs: ['plywood_panel', 'threaded_rod', 'hex_nut', 'washer', 'cap_nut'] },
  { key: 'pipe_shelf', words: ['水管', '工業風', '層架', '置物架', '書架', 'pipe', 'shelf'], builder: buildPipeShelf, needs: ['gi_pipe', 'gi_tee', 'gi_elbow', 'gi_flange', 'plywood_panel'] },
  { key: 'square_frame', words: ['框架', '方框', '框', 'frame', '骨架', '方形', '角鐵'], builder: buildSquareFrame, needs: ['threaded_rod', 'perforated_bar', 'l_bracket', 'hex_nut', 'washer', 'cap_nut'] },
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
  const needs = intent?.needs ?? []
  const has = (n) => !!resolvePartRef(pkg, n)
  return { found: needs.filter(has), missing: needs.filter((n) => !has(n)) }
}

/** ④ 驗證 / 修正 AI 輸出 */
export function validateAssembly(raw, pkg) {
  const warnings = []
  const items = []
  for (const it of raw.items ?? []) {
    // 舊版 partId（例 hex_nut_m8）→ 尺寸家族（hex_nut + size: 'M8'），見 package.idAliases
    const ref = resolvePartRef(pkg, it.partId, cleanNulls(it.params ?? (it.length ? { length: it.length } : {})))
    if (!ref) {
      warnings.push(`Package 中沒有「${it.partId}」，已略過`)
      continue
    }
    const { def } = ref
    const params = normalizeParams(def, ref.params)
    const pos = vec3(it.position)
    const rot = vec3(it.rotation)
    items.push({ partId: def.id, ...(def.params ? { params } : {}), position: pos, rotation: rot })
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
        text: '我還不太確定你想做什麼 🤔 目前 Mock 模式認得：「方形時鐘外殼」、「CD 收納展示架」、「簡易方形框架」、「工業風水管層架」。想自由設計的話，可以按下方「用我的 Claude 帳號生成」（免 API 費用），或在 ⚙ 設定 Claude API 金鑰。',
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
    aliases: p.aliases?.slice(0, 5),
    geometry: p.geometry,
    params: Object.fromEntries(
      Object.entries(p.params ?? {}).map(([k, v]) => [k, { default: v.default, options: v.options, custom: !!v.custom, min: v.min, max: v.max }]),
    ),
    // 規格表：geometry 中 '@key' 取自 sizes[params.size].key（價格欄位不給 LLM）
    ...(p.sizes
      ? { sizes: Object.fromEntries(Object.entries(p.sizes).map(([k, row]) => [k, Object.fromEntries(Object.entries(row).filter(([f]) => f !== 'price'))])) }
      : {}),
  }))
}

export const buildSystemPrompt = (pkg) => `你是 BuildM8 的五金共創夥伴，協助 DIY 新手用台灣五金行買得到的標準件設計生活用品。
只能使用下方 Package 目錄中的 partId。輸出一份可直接在 3D 畫布拼裝的組合矩陣。

規格（尺寸家族）：
- 很多零件用 params.size 選規格（例 'M6'、'M8'、'15A'），geometry 中的 '@key' 代表 sizes[size].key 的標準尺寸，
  '$length' 代表 params.length。計算座標時請用所選規格的尺寸。
- 螺帽 / 華司 / 螺條 / 螺栓的牙規要一致（M8 螺帽配 M8 螺條）；水管與管件的管徑要一致（15A 配 15A），
  變徑時用 gi_reducer。台灣俗稱：3 分 = 10A、4 分 = 15A、6 分 = 20A、1 吋 = 25A。
- 舊版 partId（threaded_rod_m8、hex_nut_m8、washer_m8、cap_nut_m8、hex_bolt_m8、gi_pipe_15a、gi_tee_15a、
  gi_elbow_15a、gi_flange_15a）仍可解析，但請改用新 partId 加 size。

座標規則：
- 單位 mm，Y 軸朝上，地面 y=0；rotation 為角度（Euler XYZ）。
- 每個零件的局部原點與方向：
  * perforated_bar / mending_plate：中心為原點，長邊沿 X、厚度沿 Y，孔沿 X 置中排列，孔軸 Y。
  * t_plate：T 字交會中心為原點，橫桿沿 X、直桿往 +Z，厚度沿 Y。
  * l_bracket / shelf_bracket：外角為原點，水平腳沿 +X、垂直腳沿 +Y，寬度沿 Z 置中（shelf_bracket 規格 a×b = 水平×垂直，附斜撐）。
  * threaded_rod / gi_pipe：中心為原點，軸沿 Y。
  * hex_bolt / carriage_bolt / eye_bolt：原點在頭部（或吊環頸部）下緣，頭朝 +Y、螺桿朝 -Y，螺桿長 length。
  * wood_screw：原點在沉頭頂面（與板面齊平），螺絲朝 -Y。
  * hex_nut / nylon_nut / coupling_nut / washer / spring_washer：中心為原點，軸沿 Y。
  * cap_nut / wing_nut：原點在底面，圓頂 / 蝶翼朝 +Y。
  * gi_tee：中心為原點，直通口 ±X、分支口 +Y，各口中心距 a（插入深度 engage）。gi_cross：四口 ±X、±Y。
  * gi_elbow：中心為原點，兩口 +X 與 +Y。gi_elbow45：中心為原點，一口朝 -Y、另一口朝 (+X,+Y) 45° 方向。
  * gi_cap：原點在開口端面中心，開口朝 -Y、封頭朝 +Y。gi_reducer：中心為原點，大口 +Y、小口 -Y。
  * gi_flange：原點在底面中心，接口朝 +Y。
  * u_bolt：原點在管心，U 形圓弧在 XY 平面朝 +Y，兩腳朝 -Y（夾沿 Z 方向的水管）。
  * hinge：攤平 180°，原點在軸心，軸沿 Z、兩片葉片沿 ±X，葉片底面在 y = -kd/2。
  * caster：原點在地面（輪子正上方的旋轉軸），頂板頂面在 y = height，頂板 4 孔。
  * plywood_panel：中心為原點，寬沿 X、深沿 Z、厚沿 Y；pattern=corners 為距邊 15mm 四角孔。
- 螺帽要確實夾住板材 / 洞洞鐵，螺條必須穿過孔位；零件不可懸空。
- params 只填該零件有的參數（含 size），其餘填 null。
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
    system: buildSystemPrompt(pkg),
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

// ---------------------------------------------------------------------------
// ③-c 手動橋接：複製提示詞到 claude.ai（使用者自己的訂閱）→ 貼回 JSON
//      不經過 API，不需要金鑰，也不產生 API 費用。
// ---------------------------------------------------------------------------

const MANUAL_EXAMPLE = {
  title: '範例：M8 螺條立柱',
  summary: '一句話說明設計理念',
  steps: ['步驟一', '步驟二'],
  items: [
    { partId: 'threaded_rod', params: { size: 'M8', length: 300, width: null, depth: null, thickness: null, pattern: null }, position: [0, 150, 0], rotation: [0, 0, 0] },
    { partId: 'hex_nut', params: { size: 'M8', length: null, width: null, depth: null, thickness: null, pattern: null }, position: [0, 3.25, 0], rotation: [0, 0, 0] },
  ],
}

/** 產生可直接貼到 claude.ai 的完整提示詞 */
export function buildManualPrompt(request, pkg) {
  return `${buildSystemPrompt(pkg)}

────────────────────────
輸出格式（非常重要）：
- 只回覆「一個 JSON 物件」，不要任何前言、說明或結語；可以用 \`\`\`json 程式碼框包起來。
- 請直接在對話中輸出 JSON，不要建立 Artifact 或檔案。
- JSON 結構必須符合這份 JSON Schema：
${JSON.stringify(ASSEMBLY_JSON_SCHEMA)}
- 範例（只示範格式，內容請依需求設計）：
${JSON.stringify(MANUAL_EXAMPLE)}

────────────────────────
使用者需求：
${request.trim()}`
}

/**
 * 解析使用者從 claude.ai 貼回來的文字：容許前後說明文字、\`\`\`json 程式碼框、
 * 或只有 items 陣列。失敗時丟出繁體中文錯誤訊息。
 */
export function parseAssemblyText(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '').trim()
  if (!src) throw new Error('還沒有貼上內容。')
  const candidates = []
  for (const m of src.matchAll(/\`\`\`(?:json|JSON)?\s*([\s\S]*?)\`\`\`/g)) candidates.push(m[1].trim())
  const first = src.search(/[[{]/)
  if (first >= 0) {
    const lastObj = src.lastIndexOf('}')
    const lastArr = src.lastIndexOf(']')
    const last = Math.max(lastObj, lastArr)
    if (last > first) candidates.push(src.slice(first, last + 1))
  }
  candidates.push(src)
  let parsed
  let lastErr
  for (const c of candidates) {
    try {
      parsed = JSON.parse(c)
      break
    } catch (e) {
      lastErr = e
    }
  }
  if (parsed === undefined) {
    throw new Error(`看不懂這段內容，請確認有完整複製 Claude 回覆的 JSON（${lastErr?.message ?? '格式錯誤'}）。若回覆被截斷，請請 Claude「繼續」後把完整 JSON 一起貼上。`)
  }
  if (Array.isArray(parsed)) parsed = { items: parsed }
  if (parsed && Array.isArray(parsed.assembly?.items)) parsed = parsed.assembly
  if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) {
    throw new Error('JSON 裡找不到 items 零件清單。請確認貼上的是 Claude 依照提示詞輸出的設計結果。')
  }
  return {
    title: parsed.title || '來自 Claude 的設計',
    summary: parsed.summary || '',
    steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
    items: parsed.items,
  }
}
