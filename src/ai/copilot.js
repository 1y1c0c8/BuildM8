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
import { normalizeJoints, normalizeParams, resolvePartRef } from '../data/parts'
import { buildCdRack, buildClockCase, buildPipeShelf, buildSquareFrame, buildUPlateClock } from './builders'
import { designGuideText } from './designGuide'

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
  // 「折板」或「U 型 / ㄇ 型 + 鐘」→ U 型折板時鐘（優先於一般 clock；只說「時鐘」仍走合板外殼）
  {
    key: 'u_plate_clock',
    words: ['折板', 'u型', 'u 型', 'u形', 'ㄇ型', 'ㄇ 型', 'ㄈ型', '鈑金', '4x4', '4×4'],
    match: (t) => t.includes('折板') || (/(u\s*[型形]|ㄇ\s*型|ㄈ\s*型|鈑金|4\s*[x×]\s*4)/.test(t) && /(鐘|clock)/.test(t)),
    builder: buildUPlateClock,
    needs: ['u_folded_plate', 'clock_movement'],
  },
]

/** ① 解析自然語言（Mock：關鍵字 + 尺寸抽取） */
export function parseIntent(text) {
  const t = text.toLowerCase()
  const scored = INTENTS.map((it) => ({ it, score: it.match ? (it.match(t) ? 100 : 0) : it.words.filter((w) => t.includes(w)).length }))
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
    // 關節值超出範圍 → 夾住（wrap 關節取模）；沒給 → 預設值
    const joints = normalizeJoints(def, it.joints)
    items.push({ partId: def.id, ...(def.params ? { params } : {}), position: pos, rotation: rot, ...(joints ? { joints } : {}) })
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
        text: '我還不太確定你想做什麼 🤔 目前 Mock 模式認得：「方形時鐘外殼」、「CD 收納展示架」、「簡易方形框架」、「工業風水管層架」、「U 型折板時鐘」。想自由設計的話，可以按下方「用我的 Claude 帳號生成」（免 API 費用），或在 ⚙ 設定 Claude API 金鑰。',
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
    case 'u_plate_clock': return clean({ size: pick(a, [64, 89, 120, 140])?.toString() })
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
    // 可動關節（item.joints 的 key、範圍與預設值）
    ...(p.joints ? { joints: p.joints.map((j) => ({ id: j.id, label: j.label, range: j.range, default: j.default, unit: j.unit })) } : {}),
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
  * hinge：（joints.angle = 180 時）攤平，原點在軸心，軸沿 Z、兩片葉片沿 ±X，葉片底面在 y = -kd/2。
  * caster：原點在地面（輪子正上方的旋轉軸），頂板頂面在 y = height，頂板 4 孔。
  * plywood_panel：中心為原點，寬沿 X、深沿 Z、厚沿 Y；pattern=corners 為距邊 15mm 四角孔。
  * u_folded_plate（鍍鋅 U 型折板，size = 內寬 '64' / '89' / '120' / '140'）：原點在底板外面中心，底板厚 t 佔 y∈[0,t]；
    兩腳在 x = ±(width/2 … width/2+t) 往 +Y 立起，外緣高 length+t；板條寬 depth 沿 Z 置中。底板中心大孔 + 四角小孔，每腳 4 孔。
    互套技巧：兩片「相同」折板（depth = width、length = width + t）互轉 90° 即成 (width+2t) 的封閉方盒：
    A 片 rotation [-90,0,0]、position [0, cy, +outer/2]（底板當前面、兩腳當左右牆）；
    B 片 rotation [90,90,0]、position [0, cy, -outer/2]（底板當背板、兩腳當上下牆），outer = width + 2t、cy = outer/2。
  * clock_movement（時鐘機芯 56×56×16，M7.5 螺牙軸）：原點在機身正面中心（貼面板背面），螺牙軸與指針朝 +Y，機身在 y∈[-16,0]；
    12 點方向 = 局部 -Z。params.thickness = 面板厚（華司 + 黃銅螺帽鎖在 y = thickness），length = 螺牙軸長（需 ≥ 面板厚 + 3），
    size = 指針 S / M / L。裝在 U 型折板前板時：rotation [90,0,0]、position = 前板內面中心（軸穿過中心孔，12 點朝上）。
- 螺帽要確實夾住板材 / 洞洞鐵，螺條必須穿過孔位；零件不可懸空。
- params 只填該零件有的參數（含 size），其餘填 null。
- joints（可動關節，單位度）：沒有關節的零件填 null；有關節的零件給 { angle, swivel, roll }，用不到的填 null（= 預設值），超出範圍會被夾住。
  * hinge：joints.angle = 開合角度 0~180（180 = 攤平、90 = 直角、0 = 闔起）。-X 葉片固定，+X 葉片繞軸心（Z 軸）往 +Y 翻起；
    角度 90 時活動葉片朝 +Y 立起，孔軸朝 -X。
  * caster：joints.swivel = 轉向 0~360（0 時輪子在軸心 -Z 側、適合往 +Z 推動；繞 Y 軸旋轉）；joints.roll = 輪子轉動角 0~360（外觀用，可填 null）。
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
    { partId: 'threaded_rod', params: { size: 'M8', length: 300, width: null, depth: null, thickness: null, pattern: null }, position: [0, 150, 0], rotation: [0, 0, 0], joints: null },
    { partId: 'hex_nut', params: { size: 'M8', length: null, width: null, depth: null, thickness: null, pattern: null }, position: [0, 3.25, 0], rotation: [0, 0, 0], joints: null },
  ],
}

const HR = '════════════════════════'

/** 角色 3 檢查員的清單（新設計與修改共用） */
const INSPECTOR_CHECKLIST = `逐項檢查，以 ✔ / ✘ 列出；有 ✘ 就先修正座標或零件，再進入最終輸出：
1. 每個 partId 都在 Package 目錄中，params.size 是該零件的有效規格。
2. 牙規 / 管徑一致（整件一種為佳）；長度是現貨規格，或該參數標示可裁切（custom）。
3. 每顆螺帽都確實夾住東西（板材、洞洞鐵、另一顆螺帽），木板上的螺帽有墊華司。
4. 沒有懸空件：每個零件都接觸地面（y=0）或另一個零件。
5. 零件互不穿插（螺條 / 螺栓穿過孔位除外）。
6. 螺條 / 螺栓的中心線對準孔位中心，且長度足夠穿過全部疊層再加一顆螺帽。
7. 應該對稱的地方，座標確實對稱（例 ±x 相同）。
8. 重心在支撐面內、站得穩；外露的螺條末端已收邊。`

/** 最終輸出規則（新設計與修改共用） */
const outputRules = () => `- 回覆的最後面輸出「唯一一個」\`\`\`json 程式碼框，內容是完整的設計；程式碼框之後不要再寫任何文字。
- 前面的分析、表格、計算都不要放進 \`\`\`json 框，也不要輸出草稿 JSON。
- 直接在對話中輸出，不要建立 Artifact 或檔案；回覆太長被截斷時，使用者會請你「繼續」。
- 前面的角色段落請精簡（合計約 40 行內），把篇幅留給完整、正確的 JSON。
- JSON 結構必須符合這份 JSON Schema：
${JSON.stringify(ASSEMBLY_JSON_SCHEMA)}
- 格式範例（只示範格式，內容請依需求設計）：
${JSON.stringify(MANUAL_EXAMPLE)}`

const IMAGE_ANALYSIS = `## 角色 0　參考圖片分析（使用者附上了參考圖片）
先逐張看圖，條列：整體風格、主要比例（估計長寬高比）、接合方式（螺條 / 水管管件 / 角鐵 / 木作）、材質與顏色、哪些特徵能用 Package 零件重現、哪些做不到要怎麼取捨。之後的概念要呼應這些觀察。`

/**
 * 產生可直接貼到 claude.ai 的完整提示詞：在一則回覆中依序扮演
 * 設計師 → 工程師 → 檢查員，最後輸出一段 JSON。
 * @param {string} request 使用者需求
 * @param {object} pkg Package
 * @param {{ style?: string, withImages?: boolean }} [options]
 */
export function buildManualPrompt(request, pkg, { style, withImages = false } = {}) {
  return `${buildSystemPrompt(pkg)}

${designGuideText({ style })}

${HR}
工作流程（非常重要）：在同一則回覆中依序扮演下列角色，每個角色用 Markdown 標題分段，最後輸出 JSON。
${withImages ? `\n${IMAGE_ANALYSIS}\n` : ''}
## 角色 1　設計師
- 重述需求：用途、尺寸（沒給就依用途假設合理尺寸並寫出來）、擺放位置（桌上 / 地面 / 掛牆）。
- 提出 3 個明顯不同的概念，每個寫：名稱、文字草圖（一兩句描述外形）、主要比例（mm）、依設計指南為什麼好看、預估零件數與種類數。
- 用表格評分（美觀 / 穩定 / 好做 / 零件少，各 1–5 分），選出最佳概念並說明理由。

## 角色 2　工程師
- 把選定概念對應到 Package 零件（partId + size + length），列出零件表與數量。
- 用目錄中的實際尺寸逐一計算座標：堆疊高度（螺帽厚、華司厚、板厚、洞洞鐵厚）、孔位（距板邊、孔距）、管件中心距 a 與插入深度 engage、旋轉後的方向。
- 在 JSON 之前列一張精簡計算表（Markdown 表格）：零件 | 數量 | 位置計算式 | 結果 (mm)。

## 角色 3　檢查員
${INSPECTOR_CHECKLIST}

## 最終輸出
${outputRules()}

${HR}
使用者需求${style ? `（風格：${style}）` : ''}：
${request.trim()}`
}

/** 把畫布上的零件（store items，mm / 度）轉成符合 Schema 的組合矩陣，給修改提示詞用 */
export function assemblyForPrompt(items, meta = {}) {
  const KEYS = ['size', 'length', 'width', 'depth', 'thickness', 'pattern']
  const r = (v) => Math.round(Number(v) * 10) / 10 || 0
  return {
    title: meta.title || '目前的設計',
    summary: meta.summary || '',
    steps: Array.isArray(meta.steps) ? meta.steps : [],
    items: (items ?? []).map((it) => ({
      partId: it.partId,
      params: Object.fromEntries(KEYS.map((k) => [k, it.params?.[k] ?? null])),
      position: (it.position ?? [0, 0, 0]).map(r),
      rotation: (it.rotation ?? [0, 0, 0]).map(r),
      // 可動關節（鉸鏈 / 腳輪）：沒有關節的零件填 null，與 ASSEMBLY_JSON_SCHEMA 一致
      joints: it.joints && Object.keys(it.joints).length
        ? { angle: it.joints.angle ?? null, swivel: it.joints.swivel ?? null, roll: it.joints.roll ?? null }
        : null,
    })),
  }
}

/**
 * 「請 Claude 修改這個設計」：目前設計 JSON + 使用者回饋 + 截圖評論 → 完整的新 JSON
 * @param {{ assembly: object, feedback?: string, pkg: object, style?: string,
 *           withScreenshot?: boolean, sameChat?: boolean }} opts
 *   sameChat：在原本的 claude.ai 對話接續時不重附零件目錄（縮短提示詞）
 */
export function buildRevisionPrompt({ assembly, feedback = '', pkg, style, withScreenshot = true, sameChat = false }) {
  const head = sameChat
    ? '沿用這個對話前面的 BuildM8 零件目錄、座標規則與設計指南。'
    : `${buildSystemPrompt(pkg)}\n\n${designGuideText({ style })}`
  return `${head}

${HR}
修改任務：下方是目前 3D 畫布上的設計（BuildM8 組合矩陣，單位 mm / 度）${withScreenshot ? '，我也附上了目前畫面的截圖' : ''}。請改善它，並輸出修改後的完整設計。
在同一則回覆中依序扮演下列角色，每個角色用 Markdown 標題分段。

## 角色 1　評論員
${withScreenshot ? '- 先看截圖，對照 JSON 找出每個零件；描述你在畫面上看到的整體印象。\n' : ''}- 依設計指南逐項評論：比例、對稱與對齊、重複節奏、視覺重量、扣件一致、材質與留白、新手好做。
- 找出結構問題：懸空、穿插、螺帽沒夾住、螺條沒穿孔、站不穩。
- 列出最值得改的 3–5 點（先處理使用者回饋提到的）。

## 角色 2　設計師兼工程師
- 依使用者回饋與評論提出修改方案，說明改了什麼、為什麼更好看或更穩。
- 重新計算受影響零件的座標，列精簡計算表（零件 | 位置計算式 | 結果 mm）；沒改到的零件保持原座標。

## 角色 3　檢查員
${INSPECTOR_CHECKLIST}

## 最終輸出
- 輸出修改後的「完整」設計（包含沒有改動的零件），不是只有差異。
${outputRules()}

目前的設計：
\`\`\`json
${JSON.stringify(assembly)}
\`\`\`

${HR}
使用者回饋${style ? `（風格：${style}）` : ''}：
${feedback.trim() || '（沒有特別意見，請依設計指南自行改善外觀與結構）'}`
}

// ---------------------------------------------------------------------------
// 解析貼回的回覆
// ---------------------------------------------------------------------------

/** 找出文字中所有「括號平衡」的 JSON 片段（略過字串內的括號；只從像 JSON 的開頭起算） */
function jsonSpans(src) {
  const spans = []
  const looksLikeJson = (i) => {
    const rest = src.slice(i + 1, i + 40).trimStart()
    return src[i] === '{' ? /^["}]/.test(rest) : /^[{\["\]]/.test(rest)
  }
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if ((ch !== '{' && ch !== '[') || !looksLikeJson(i)) {
      i++
      continue
    }
    let depth = 0
    let inStr = false
    let end = -1
    for (let j = i; j < src.length; j++) {
      const c = src[j]
      if (inStr) {
        if (c === '\\') j++
        else if (c === '"') inStr = false
      } else if (c === '"') inStr = true
      else if (c === '{' || c === '[') depth++
      else if (c === '}' || c === ']') {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end > 0) {
      spans.push({ start: i, text: src.slice(i, end + 1) })
      i = end + 1
    } else i++
  }
  return spans
}

/** 把解析出的 JSON 正規化成 { items, ... }；不是組合矩陣時回傳 null */
function asAssembly(parsed) {
  if (Array.isArray(parsed)) parsed = { items: parsed }
  if (parsed && Array.isArray(parsed.assembly?.items)) parsed = parsed.assembly
  if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return null
  if (!parsed.items.some((it) => it && typeof it === 'object' && typeof it.partId === 'string')) return null
  return parsed
}

/**
 * 解析使用者從 claude.ai 貼回來的文字：容許前後說明文字、\`\`\`json 程式碼框、
 * 或只有 items 陣列。回覆中有多個程式碼框（計算表、草稿、最終版）時，
 * 取「最後一個完整的」組合矩陣（優先有 title / steps 的完整設計）。
 * 失敗時丟出繁體中文錯誤訊息。
 */
export function parseAssemblyText(text) {
  const src = String(text ?? '').replace(/^﻿/, '').trim()
  if (!src) throw new Error('還沒有貼上內容。')

  const fenced = [...src.matchAll(/```[\w-]*[ \t]*\r?\n?([\s\S]*?)```/g)].map((m) => m[1].trim())
  // 程式碼框沒有收尾（回覆被截斷或只複製到一半）：把最後一個開頭之後的內容也當候選
  const lastOpen = src.lastIndexOf('```')
  if ((src.match(/```/g)?.length ?? 0) % 2 === 1) fenced.push(src.slice(lastOpen + 3).replace(/^[\w-]*/, '').trim())

  let parsedAny = false
  let lastErr
  const tryParse = (c) => {
    try {
      const v = JSON.parse(c)
      parsedAny = true
      return asAssembly(v)
    } catch (e) {
      lastErr = e
      return null
    }
  }
  const pick = (list) => {
    const found = list.map(tryParse).filter(Boolean)
    if (!found.length) return null
    const complete = found.filter((a) => a.title || a.steps)
    return (complete.length ? complete : found).at(-1)
  }

  const parsed =
    pick(fenced) ??
    pick(fenced.flatMap((f) => jsonSpans(f).map((s) => s.text))) ??
    pick([src]) ??
    pick(jsonSpans(src).map((s) => s.text))

  if (!parsed) {
    if (!parsedAny) {
      throw new Error(`看不懂這段內容，請確認有完整複製 Claude 回覆的 JSON（${lastErr?.message ?? '格式錯誤'}）。若回覆被截斷，請請 Claude「繼續」後把完整 JSON 一起貼上。`)
    }
    throw new Error('JSON 裡找不到 items 零件清單。請確認貼上的是 Claude 依照提示詞輸出的設計結果。')
  }
  return {
    title: parsed.title || '來自 Claude 的設計',
    summary: parsed.summary || '',
    steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
    items: parsed.items,
  }
}
