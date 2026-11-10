# BuildM8

> 像拼樂高一樣，用**五金行常見標準件**設計生活用品的 3D 網頁平台。
> 「M8」是最常見的公制螺紋，也諧音 **Mate**：AI 是你的共創夥伴。

## 快速開始

```bash
npm install
npm run dev      # 開啟 http://localhost:5173
```

按右上角 **「AI 模擬生成」**，會讀取 `src/data/mock/square_frame.json`，在畫布上逐顆拼出由螺條、洞洞鐵、角鐵組成的方形框架。

## 功能

| 區塊 | 說明 |
|---|---|
| **3D 拼裝畫布** | 旋轉 / 縮放 / 平移視角；選取、移動 (G)、旋轉 (R)、刪除 (Del)、複製 (Ctrl+D)、復原 (Ctrl+Z) |
| **網格與孔洞磁吸** | 1 cm / 0.5 cm 網格；螺條自動穿孔、螺帽套上螺條、洞洞鐵孔對孔、水管管口接合，並有光圈提示 |
| **五金 Package 側欄** | `taiwan_hardware_store_v1`：洞洞鐵、L 角鐵、M8 螺條 / 螺栓 / 螺帽 / 蓋帽 / 華司、4 分鍍鋅管、三通、彎頭、法蘭、合板、鍍鋅 U 型折板、時鐘機芯（掃秒）；點擊或拖曳加入 |
| **AI Copilot** | 輸入「我想做一個有厚度的方形時鐘外殼」等需求 → 解析 → 比對零件 → 產生組合矩陣 → 驗證 → 自動拼裝；預設 Mock，可在 ⚙ 填 Claude API 金鑰改用真正的 LLM |
| **用我的 Claude 帳號生成** | 免 API 費用：複製網站產生的提示詞（含零件目錄與 JSON 格式）貼到 claude.ai，再把回覆的 JSON 貼回網站，自動驗證並拼裝 |
| **設計師 → 工程師 → 檢查員** | 貼到 claude.ai 的提示詞會要求 Claude 在一則回覆中先提出 3 個概念並評分、再依零件尺寸計算座標、最後逐項檢查（零件存在、牙規一致、螺帽夾緊、無懸空 / 穿插、對稱），才輸出 JSON；可選風格（工業風、極簡、日式木作、北歐、包浩斯、童趣），或勾選「我會附上參考圖片」讓 Claude 先分析你貼上的 Pinterest / IG 圖 |
| **請 Claude 修改這個設計** | 畫布上有作品時，AI 面板多一顆按鈕：複製 / 下載目前 3D 畫面的 PNG 截圖、輸入想怎麼改，複製含目前設計 JSON 的修改提示詞，讓 Claude 對照截圖與設計指南評論並輸出完整新版，貼回即套用（瀏覽器不能複製圖片時自動改為下載） |
| **採購清單 BOM** | 即時合併相同規格，顯示標準號與數量，可複製文字或匯出 CSV 帶去五金行 |
| **設計檔匯入 / 匯出** | 「匯入設計檔（.json）」或把 .json 拖到畫布；「匯出設計檔」把目前畫布存成 JSON |
| **Claude Code `/design`** | 在專案裡用 Claude Code 子代理人（外觀設計 → 平行實作 → 審查）產生經過幾何驗證的設計檔，見 [`docs/CLAUDE_CODE_WORKFLOW.md`](docs/CLAUDE_CODE_WORKFLOW.md) |

## 專案結構

```
src/
├─ data/
│  ├─ schema.js                 # Package / Assembly 格式定義 + LLM 用 JSON Schema
│  ├─ packages/taiwan_hardware_store_v1.js
│  ├─ parts.js                  # 參數解析、錨點推導、BOM 文字
│  ├─ providers.js              # 外部零件資料庫 Provider 介面（TraceParts 等，偽代碼）
│  └─ mock/square_frame.json    # 「AI 模擬生成」讀取的 Mock JSON
├─ ai/
│  ├─ copilot.js                # parseIntent → matchParts → generate → validate；Claude 結構化輸出；claude.ai 提示詞 / 修改提示詞 / 回覆解析
│  ├─ designGuide.js            # 設計指南與風格詞彙（純文字，designGuideMarkdown() 可給 agent 重用）
│  └─ builders.js               # Mock 設計產生器（時鐘外殼 / CD 架 / 方形框架 / 水管層架 / U 型折板時鐘）
├─ three/
│  ├─ geometry.js               # 標準參數 → Primitive 幾何
│  ├─ snapping.js               # 網格 + 孔洞磁吸
│  ├─ capture.js                # 畫布截圖（複製 / 下載 PNG）
│  ├─ PartMesh.jsx / Workspace.jsx
├─ store/useStore.js            # zustand：場景（mm / 度）、選取、歷史紀錄
└─ components/                  # TopBar、Sidebar、CopilotPanel、BomPanel、Inspector
```

測試：`npm test`（Node 內建 test runner，`tests/`）。

格式細節見 [`docs/PACKAGE_SPEC.md`](docs/PACKAGE_SPEC.md)。

## Claude Code 設計流程

```bash
npm run validate-design -- designs/foo.json   # 檢查設計檔：規格、懸空、穿透、牙規、BOM 與估價
npm run test:validator                        # 驗證工具自我測試（參考設計 + scripts/fixtures）
npm run render-design -- designs/foo.json     # 選用：無頭瀏覽器截圖（需 Playwright）
```

在 Claude Code 輸入 `/design 我想做一個 U 型折板時鐘` 即可啟動完整流程，詳見 [`docs/CLAUDE_CODE_WORKFLOW.md`](docs/CLAUDE_CODE_WORKFLOW.md)。

## 注意

* 尺寸為標準規格近似值（水管配件為 JIS B 2301 15A 近似），購買前請現場確認。
* Claude 模式由瀏覽器直接呼叫 API，只適合本機原型；正式上線請改由後端代理，避免金鑰外洩。
