# 用 Claude Code 設計 BuildM8 作品（`/buildm8-design`）

網站上的「用我的 Claude 帳號生成」是一問一答；這份文件介紹更完整的做法：在專案資料夾裡開 **Claude Code**（Claude Max 訂閱內含，不需要 API 金鑰），輸入

```
/buildm8-design 我想做一個 U 型折板時鐘
```

> **為什麼不叫 `/design`？** claude.ai 內建一個同名的 `/design`（設計畫布），在網頁版會被它攔走，所以專案指令改名為 `/buildm8-design`。
>
> **不一定要開 terminal**：Claude Code 的網頁版（claude.ai/code，開新 session 時選這個 repo）、桌面 App（Mac／Windows）、terminal 或 VS Code／JetBrains 擴充套件都能用這個指令與子代理人。網頁版不需要在自己電腦安裝任何東西；截圖工具 `render-design` 需要 Playwright，網頁版雲端環境通常已內建 Chromium。

Claude Code 會派出三種**子代理人**分工合作，產出一份經過**真正幾何驗證**的設計檔 `designs/<slug>.json`，再匯入網站查看、採購、組裝。

```
/buildm8-design 需求
  │
  ├─ design-concept（外觀設計）     → 2–3 個概念：比例、風格、零件草單，推薦前兩名
  ├─ design-engineer × 2（平行）    → 各自用腳本算座標、存檔、跑驗證直到 0 錯誤
  ├─ design-reviewer（結構與美感）   → 驗證 + 截圖 + 看圖，評分、列修改清單、推薦一份
  ├─ design-engineer（修改一輪）
  └─ 定稿 → designs/<slug>.json + designs/<slug>.md（概念、採購清單、步驟、購買提醒）
```

| 檔案 | 用途 |
|---|---|
| `.claude/commands/buildm8-design.md` | `/buildm8-design` 指令（總指揮的流程） |
| `.claude/agents/design-concept.md` | 外觀設計子代理人（可用網路搜尋參考） |
| `.claude/agents/design-engineer.md` | 零件工程師子代理人（寫檔、跑腳本） |
| `.claude/agents/design-reviewer.md` | 審查子代理人（只讀、跑驗證與截圖） |
| `scripts/validate-design.mjs` | 設計檔驗證工具 |
| `scripts/render-design.mjs` | 設計檔截圖工具（選用，需要 Playwright） |
| `scripts/lib/design-kit.mjs` | 工程師計算座標用的小工具 |

## 1. 準備

```bash
git clone https://github.com/1y1c0c8/BuildM8.git
cd BuildM8
npm ci                 # 需要 Node.js 22 以上
claude                 # 在專案資料夾開啟 Claude Code（第一次會要求登入 Claude 帳號）
```

在 Claude Code 裡輸入 `/agents` 應該看得到 `design-concept`、`design-engineer`、`design-reviewer`；輸入 `/` 會出現 `/buildm8-design`。

### 選用：安裝截圖工具（讓審查員「看得到」設計）

```bash
npm i -D playwright
npx playwright install chromium
```

沒有安裝也能用，審查員會改用尺寸與座標判斷，並在報告註明「未目視檢查」。

## 2. 執行 `/buildm8-design`

```
/buildm8-design 我想做一個放在書桌上的 U 型折板時鐘，寬約 20 公分，工業風
```

- 需求寫得越具體越好：用途、大約尺寸、放桌上或掛牆、風格、預算。
- 過程中 Claude Code 會請你允許執行 `npm run validate-design`、`node designs/.work/...` 等指令，選「允許」即可。
- 完成後會得到：
  - `designs/<slug>.json`：組合矩陣（網站可匯入）
  - `designs/<slug>.md`：設計說明、採購清單（BOM）、組裝步驟、台灣五金行購買提醒
  - `designs/.work/`：草稿與計算腳本（不提交）；`designs/renders/`：截圖（不提交）

**省用量模式：** `/buildm8-design --quick <需求>` 只做一個概念、一位工程師、不審查，速度快、用量少。

## 3. 匯入網站

1. 打開網站（本機 `npm run dev`，或 GitHub Pages 上的版本）。
2. 在右側 **AI Copilot** 面板按 **「匯入設計檔（.json）」** 選擇 `designs/<slug>.json`；或直接把 `.json` 檔**拖到 3D 畫布**上。
3. 設計會逐顆拼裝到畫布，下方採購清單同步更新，可匯出 CSV 帶去五金行。

## 4. 反覆修改

- **在網站上手動調整後**：按 **「匯出設計檔」** 下載目前畫布的 JSON，放進 `designs/`，再請 Claude Code 修改：
  ```
  /buildm8-design 把 designs/u-fold-clock.json 的螺絲全部改成 M6，整體高度降到 18 公分
  ```
  指令偵測到既有檔案時會進入「修改模式」：跳過概念與平行實作，直接由工程師修改，再審查、定稿。
- **直接請代理人做事**：也可以不經過 `/buildm8-design`，例如「請 design-reviewer 審查 designs/foo.json」。
- **自己檢查**：
  ```bash
  npm run validate-design -- designs/foo.json          # 繁體中文報告
  npm run validate-design -- designs/foo.json --json   # 機器可讀
  npm run validate-design -- designs/foo.json --strict # 警告也算失敗
  npm run render-design -- designs/foo.json --views iso,front,side,top
  ```
- 好的設計建議提交保存：`git add designs/foo.json designs/foo.md`。

## 5. 驗證工具檢查什麼

| 類別 | 檢查 | 等級 |
|---|---|---|
| 規格 | partId 不存在（網站會略過該零件） | 錯誤 |
| 規格 | 參數不是現貨規格、超出可裁切範圍（網站會自動修正，座標可能因此錯位） | 警告 |
| 規格 | 舊版 partId（例 `hex_nut_m8`）、寫法統一、未指定 size 用預設值 | 提示 |
| 幾何 | 懸空：零件沒碰到地面，也沒有（間接）接觸到落地的零件 | 錯誤 |
| 幾何 | 互相穿透超過 0.5 mm（排除螺條穿孔、螺帽 / 華司套螺條、水管旋入管件、U 型管束夾管） | 錯誤 |
| 幾何 | 陷入地面以下超過 1 mm | 錯誤 |
| 相容 | 螺帽與螺條牙規不符、華司內徑太小、螺條比孔粗（> 孔徑 + 0.6 mm）、水管與管件管徑不同 | 錯誤 |
| 相容 | 華司大一號（會晃） | 警告 |
| 結構 | 螺帽 / 華司沒套在螺條上、沒夾住任何東西 | 警告 |
| 加工 | 螺條 / 水管垂直穿過合板沒有預設孔的位置 → 提示需鑽孔與孔徑 | 提示 |
| 摘要 | 整體尺寸、零件數、採購清單、預估價格 | — |

幾何檢查使用網站同一套 `buildPartMeshes()` 產生的幾何：每個子網格轉成世界座標的有向包圍盒，以分離軸定理計算重疊深度；「預期的穿插」用零件錨點（孔、軸、管口）判斷。容許誤差（`scripts/lib/analyze.mjs` 的 `TOL`）：接觸間隙 0.8 mm、落地 1 mm、穿透 0.5 mm、同軸 0.8 mm、管口 2 mm。

網站內建的參考設計（`src/ai/builders.js`、`src/data/mock/square_frame.json`）全部通過；`scripts/fixtures/` 是刻意做錯的設計，用來確認工具抓得到問題：

```bash
npm run test:validator
```

## 6. 限制

- **用量**：完整 `/buildm8-design` 會啟動 4–5 個子代理人（其中 2 個平行），比一般對話更快消耗 Claude Max 的用量；常用時請多用 `--quick`。
- 包圍盒是近似：圓柱用方盒近似，斜放的零件或很靠近但沒碰到的曲面可能被判為接觸；它抓得到明顯錯誤，但不能取代實際試組。
- 驗證工具不計算受力、重量或傾倒；穩定性由審查員依比例判斷。
- 合板上的鑽孔、裁切在畫布上不會顯示，請依說明檔的加工提示施作。
- 零件尺寸為標準規格近似值，購買前請現場確認。
- `/buildm8-design` 需要互動式的 Claude Code；網站本身不會呼叫 Claude Code。
- 截圖工具使用開發伺服器的除錯掛鉤 `window.__buildm8`，只在 `npm run dev` 時存在，正式網站沒有。
