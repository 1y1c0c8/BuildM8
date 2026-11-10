/**
 * BuildM8 設計指南 — 讓五金 DIY 作品「好看、做得出來、站得穩」
 * ---------------------------------------------------------------------------
 * 純資料 + 字串產生器，不依賴 React / three / Package，
 * 可直接被網站的提示詞（copilot.js）或 Claude Code agent 讀取重用。
 *
 *   DESIGN_PRINCIPLES      設計原則（標題 + 具體規則）
 *   STYLE_VOCABULARY       風格詞彙（使用者可選，對應到具體零件與做法）
 *   getStyle(key)          以 key 或中文名稱取得風格
 *   designGuideText(opts)  提示詞用的精簡版（約 2k 字元）
 *   designGuideMarkdown()  給人或 agent 閱讀的完整 Markdown
 */

/** @typedef {{ key: string, title: string, rules: string[] }} DesignPrinciple */

/** @type {DesignPrinciple[]} */
export const DESIGN_PRINCIPLES = [
  {
    key: 'proportion',
    title: '比例與模組',
    rules: [
      '外形尺寸用簡單整數比（1:1、1:2、2:3、3:4）；長方形可用黃金比 1:1.618（例 200×324、300×485）。',
      '全件共用一個模組：洞洞鐵孔距 15 mm 或 1 cm 網格，尺寸與座標盡量落在模組倍數上。',
      '層板間距、桿距相同或依比例遞減（例 300 / 240 / 180），不要隨意的數字。',
    ],
  },
  {
    key: 'symmetry',
    title: '對稱與對齊',
    rules: [
      '預設左右（X）對稱、前後（Z）對稱，以原點為中心；不對稱必須是刻意的。',
      '同一層的零件頂面 / 中心線對齊；螺條與孔位在同一直線上。',
    ],
  },
  {
    key: 'rhythm',
    title: '重複與節奏',
    rules: [
      '相同零件等距重複（例 4 支立柱、5 支等距橫桿），比各種零件混搭更好看。',
      '重複件數用奇數（3、5）或成對（2、4），間距 = 總長 ÷ (件數 − 1)。',
    ],
  },
  {
    key: 'weight',
    title: '視覺重量與穩定',
    rules: [
      '下重上輕：較厚 / 較大的板材、法蘭、底座放在下方；上方輕巧。',
      '重心落在支撐面內；高度大於底面短邊 2.5 倍時要加寬底座、加腳或建議固定牆面。',
      '每個零件都要接觸地面或其他零件，沒有懸空件。',
    ],
  },
  {
    key: 'fasteners',
    title: '扣件一致',
    rules: [
      '整件只用一種牙規（例全部 M8），水管只用一種管徑（例全部 15A），採購與工具最單純。',
      '外露的螺條末端用蓋頭螺帽（cap_nut）收邊，安全也好看。',
      '螺帽壓在木板上時，底下墊華司（washer）分散壓力；兩側都要螺帽夾緊。',
      '扣件「藏」或「秀」要刻意：極簡風把螺帽藏在內側；工業風讓螺帽、法蘭成為裝飾並整齊排列。',
    ],
  },
  {
    key: 'material',
    title: '材質對比與留白',
    rules: [
      '金屬（鍍鋅鐵、黑鐵管）與木材（合板）形成對比；一件作品以 1 種金屬 + 1 種木材為佳。',
      '保留負空間：零件之間留出呼吸空間，不要塞滿；開放的框架比密實的盒子輕盈。',
      '木板邊距一致（例孔距板邊 15 mm），金屬件不超出木板邊緣，除非是刻意的造型。',
    ],
  },
  {
    key: 'buildability',
    title: '新手做得出來',
    rules: [
      '零件種類越少越好（理想 ≤ 6 種），同規格多買比多種規格各買一個容易。',
      '長度用現貨規格（Package 的 options）；只有 Package 標示可裁切（custom）的才用自訂長度。',
      '組裝順序由下往上、由內往外；步驟只需扳手 / 起子，避免需要焊接或攻牙。',
    ],
  },
]

/** @typedef {{ key: string, label: string, idea: string, parts: string }} StyleWord */

/** @type {StyleWord[]} */
export const STYLE_VOCABULARY = [
  {
    key: 'industrial',
    label: '工業風',
    idea: '粗獷、結構外露、金屬為主角',
    parts: '鍍鋅水管 + 三通 / 彎頭 / 法蘭當骨架，厚合板層板；法蘭與管件外露並對齊，扣件即裝飾。',
  },
  {
    key: 'minimal',
    label: '極簡',
    idea: '線條少、留白多、看不到多餘零件',
    parts: '細螺條（M6/M8）+ 薄板，零件種類 ≤ 4；螺帽藏在板內側，只露出蓋頭螺帽；嚴格對稱。',
  },
  {
    key: 'japanese',
    label: '日式木作',
    idea: '木材為主、溫潤、低矮水平',
    parts: '以合板為主體，金屬盡量少且小；低重心、水平延伸，比例偏扁（例 3:1）；扣件藏起來。',
  },
  {
    key: 'nordic',
    label: '北歐',
    idea: '明亮、圓潤、功能取向',
    parts: '淺色合板 + 少量細金屬，層板間距寬鬆、四腳外撐微開；蓋頭螺帽圓頂收邊，整體輕巧。',
  },
  {
    key: 'bauhaus',
    label: '包浩斯',
    idea: '幾何、模組化、形隨機能',
    parts: '方形與長方形網格，所有尺寸是 15 mm / 1 cm 模組倍數；洞洞鐵、角鐵、螺條清楚分工並外露。',
  },
  {
    key: 'playful',
    label: '童趣',
    idea: '活潑、不對稱的節奏、可動',
    parts: '刻意的高低錯落（仍維持穩定）、圓頂蓋頭螺帽、蝶型螺帽方便徒手調整；邊角圓滑無尖刺。',
  },
]

/** 以 key 或中文名稱取得風格 */
export const getStyle = (k) => STYLE_VOCABULARY.find((s) => s.key === k || s.label === k) ?? null

/**
 * 提示詞用精簡版（純文字，約 2k 字元）。
 * @param {{ style?: string }} [opts] style 為風格 key 或中文名稱；有給時附上該風格的具體做法
 */
export function designGuideText({ style } = {}) {
  const s = style ? getStyle(style) : null
  const lines = ['【設計指南】']
  DESIGN_PRINCIPLES.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.title}`)
    p.rules.forEach((r) => lines.push(`   - ${r}`))
  })
  lines.push(`風格詞彙：${STYLE_VOCABULARY.map((v) => `${v.label}（${v.idea}）`).join('、')}`)
  if (s) lines.push(`本次指定風格「${s.label}」：${s.idea}。做法：${s.parts}`)
  return lines.join('\n')
}

/** 給人或 Claude Code agent 閱讀的完整 Markdown */
export function designGuideMarkdown() {
  const out = ['# BuildM8 設計指南', '', '讓五金 DIY 作品好看、做得出來、站得穩。', '']
  for (const p of DESIGN_PRINCIPLES) {
    out.push(`## ${p.title}`, '', ...p.rules.map((r) => `- ${r}`), '')
  }
  out.push('## 風格詞彙', '', '| 風格 | 意象 | 零件與做法 |', '|---|---|---|')
  for (const v of STYLE_VOCABULARY) out.push(`| ${v.label} | ${v.idea} | ${v.parts} |`)
  out.push('')
  return out.join('\n')
}
