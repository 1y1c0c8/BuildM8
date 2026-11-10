---
description: 用 BuildM8 標準件設計一件 DIY 作品：外觀概念 → 兩位工程師平行實作 → 審查 → 修改一輪 → 輸出 designs/<slug>.json 與說明
argument-hint: "[--quick] <需求，例：我想做一個 U 型折板時鐘>"
allowed-tools: Read, Write, Edit, Glob, Grep, Task, Agent, Bash(npm run validate-design:*), Bash(npm run render-design:*), Bash(node:*), Bash(mkdir:*), Bash(cp:*)
---

你是 BuildM8 設計流程的**總指揮**。使用者的需求：

$ARGUMENTS

目標：產出一份**通過驗證**、好看又好做的組合矩陣 `designs/<slug>.json`，以及給人看的 `designs/<slug>.md`。所有給使用者看的內容用**繁體中文**。

## 0. 準備

- 若需求是空的，先請使用者描述想做什麼（用途、大約尺寸、風格、放桌上或掛牆），然後停止。
- 若需求以 `--quick` 開頭：**快速模式**（省用量）——只做 1 個概念、1 位工程師、不做審查與修改輪，直接到步驟 5。
- 若需求提到既有的設計檔（例 `designs/foo.json`，或使用者從網站「匯出設計檔」下載的 .json 路徑）：**修改模式**——跳過步驟 1–2；先把該檔複製到 `designs/.work/<slug>-a.json`，交給 **design-engineer** 依需求修改（沒有計算腳本時，它可以直接編輯 JSON 或重寫腳本），再做步驟 3–6；定稿時覆蓋原本的 `designs/<slug>.json` 前先告知使用者。
- 讀 `docs/CLAUDE_CODE_WORKFLOW.md` 了解流程；確認 `node_modules` 存在（沒有就請使用者先跑 `npm ci`）。
- 建立 `designs/.work/`（中間檔，不提交）。

## 1. 外觀概念（1 個代理人）

用 **design-concept** 子代理人，傳入完整需求。要求它回傳 2–3 個概念（含 slug、尺寸、結構、零件草單、風險）與推薦的前兩名。

## 2. 平行實作（2 個代理人，同一則訊息內同時發出）

對推薦的前兩個概念，**在同一則回覆中同時呼叫兩次** **design-engineer** 子代理人（平行執行）。每次的提示要包含：
- 原始需求全文、該概念的完整描述（直接貼概念代理人的那一段）
- 輸出檔：`designs/.work/<slug>-a.json` 與 `designs/.work/<slug>-b.json`（slug 用第一名概念的 slug），計算腳本放 `designs/.work/<slug>-a.mjs` / `-b.mjs`
- 完成條件：`npm run validate-design -- <檔案>` 0 個錯誤

## 3. 審查（1 個代理人）

用 **design-reviewer** 子代理人一次審查兩份草稿（傳入兩個路徑與原始需求），請它逐份評分、列出具體修改清單，並推薦一份。

若兩份都有無法修好的錯誤：把審查意見交給原工程師重做一次；仍失敗就向使用者說明卡在哪裡並停止。

## 4. 修改一輪（最多 1 個代理人）

若推薦的那份「需修改」：把審查員的修改清單交給 **design-engineer**（指定修改同一個檔案與腳本），完成後自己再跑一次：
```
npm run validate-design -- designs/.work/<slug>-X.json
```
只做**一輪**修改；之後仍有小問題就記在說明檔的「已知限制」。

## 5. 定稿

1. 最終檔案必須 0 錯誤。複製到 `designs/<slug>.json`（若已存在同名檔，改用 `<slug>-2.json` 等，不要覆蓋使用者的檔案）。
2. 執行 `npm run validate-design -- designs/<slug>.json --json`，用結果寫 `designs/<slug>.md`，內容：
   - 標題、一句話介紹、整體尺寸（cm）、零件數、預估費用
   - 設計概念（比例 / 風格理由，取自概念代理人）
   - 採購清單（BOM 表格：品名、規格、數量、單位、參考價）
   - 組裝步驟（取自 JSON 的 steps）
   - 加工提示（驗證結果中的「需鑽孔」等 info）
   - 台灣五金行購買小提醒：螺條可請老闆代客裁切、4 分 = 15A、水管可請水電行裁切車牙、合板可請木材行裁切並鑽孔、多買 1–2 顆螺帽華司備用、價格僅供參考
   - 如何在網站開啟：AI Copilot 面板「匯入設計檔（.json）」或把檔案拖到畫布
   - 已知限制（若有）
3. 若 `npm run render-design` 可用，為最終檔輸出 iso / front 截圖到 `designs/renders/`（不提交），並自己看一眼確認沒有明顯錯誤。

## 6. 回報使用者

簡短列出：最終檔案路徑、尺寸、零件數、估價、驗證結果、兩個概念各自的取捨（為什麼選這個）、如何匯入網站、若要修改可以怎麼說（例：「/design 把 designs/<slug>.json 改成 M6 螺絲，高度降到 25 公分」——此時跳過步驟 1–2，直接由 design-engineer 修改該檔再審查）。提醒：好的設計建議 `git add designs/<slug>.json designs/<slug>.md` 提交保存。

## 用量提醒

完整流程會啟動 4–5 個子代理人，其中 2 個平行執行，會比單一對話更快消耗 Claude Max 的用量額度。想省用量時用 `/design --quick <需求>`，或在步驟 2 只實作一個概念。
