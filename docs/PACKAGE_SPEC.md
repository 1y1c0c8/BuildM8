# BuildM8 五金 Package 與組合矩陣格式 v1

## 1. 設計原則

| 原則 | 做法 |
|---|---|
| 不建模，只存參數 | 每個零件 = `geometry.type` + 標準尺寸（mm）。前端用 Box / Cylinder / Extrude（帶孔 Shape）即時生成。 |
| 對齊工業標準 | 尺寸取自 ISO / DIN / JIS / CNS（例：M8 六角螺帽 JIS B 1181 → 對邊 13、厚 6.5）。 |
| 可調參數最少化 | 只有「五金行會問你的規格」才開放成參數（長度、板材尺寸）。用 `"$length"` 在 geometry 內引用。 |
| 尺寸家族不灌水 | 同一種零件的 M4~M12 / 10A~25A 用一張「規格表」(`sizes`) 表示，側欄只出現一張卡片，用 `params.size` 切換。 |
| 在地化 = 換一包 JSON | 新增國家 / 通路只需要新增一個 Package（或寫一個 Provider 轉換外部 API）。 |

## 2. Package 格式

```jsonc
{
  "packageId": "taiwan_hardware_store_v1",
  "name": "台灣五金行 標準件包",
  "region": "TW",
  "version": "1.1.0",
  "units": "mm",
  "standards": ["JIS", "CNS", "ISO", "DIN"],
  "source": { "type": "builtin" },          // 或 { "type": "api", "provider": "traceparts" }
  "idAliases": {                             // 舊版 partId → 尺寸家族 + 預設規格（見 §2.2）
    "hex_nut_m8": { "partId": "hex_nut", "params": { "size": "M8" } }
  },
  "parts": [
    {
      "id": "hex_nut",                       // AI 輸出以此引用
      "category": "fastener",
      "name": { "zh-TW": "六角螺帽", "en": "Hex Nut" },
      "standard": "JIS B 1181",
      "material": "zinc",
      "params": { "size": { "label": "牙規", "default": "M8", "options": ["M4", "M5", "M6", "M8", "M10", "M12"] } },
      "sizes": {                             // 規格表：一列 = 一個現貨規格
        "M6": { "s": 10, "m": 5,   "d": 6, "price": 1 },
        "M8": { "s": 13, "m": 6.5, "d": 8, "price": 2 }
        // …
      },
      "geometry": { "type": "hex_nut", "thread": "$size", "s": "@s", "m": "@m", "bore": "@d" },
      "bom": { "name": "{size} 六角螺帽（1 種）", "unit": "顆" },
      "priceTWD": 2,                         // 規格表沒有 price 時使用
      "aliases": ["螺帽", "螺母", "nut"]     // 給 AI 比對台灣俗名
    },
    {
      "id": "threaded_rod",
      "category": "rod",
      "standard": "DIN 975",
      "geometry": { "type": "threaded_rod", "thread": "$size", "d": "@d", "pitch": "@pitch", "length": "$length" },
      "params": {
        "size": { "label": "牙規", "default": "M8", "options": ["M4", "M5", "M6", "M8", "M10", "M12"] },
        "length": { "default": 300, "options": [50, 100, 150, 200, 300, 500, 1000],
                    "custom": true, "min": 20, "max": 1000, "unit": "mm" }   // custom = 可代客裁切
      },
      "sizes": { "M8": { "d": 8, "pitch": 1.25, "price": 25 } /* … */ },
      "bom": { "name": "{size} 全牙螺絲條", "spec": "L{length}mm", "unit": "支" }
    }
  ]
}
```

### 2.1 參數引用語法（geometry 內）

| 寫法 | 意義 | 例 |
|---|---|---|
| `"$name"` | 取 `params.name` 的值（使用者 / AI 可調） | `"length": "$length"`、`"thread": "$size"` |
| `"@key"` | 取規格表 `sizes[params.size].key` | `"s": "@s"` → M8 時為 13 |
| 數字 / 字串 | 固定值 | `"hole_d": 8.5` |

* 規格表的 key 必須與 `params.size.options` 完全一致；每一列可以有任意欄位，`price` 為該規格的參考單價（新台幣）。
* `bom.name` / `bom.spec` 的 `{name}` 先找參數，再找規格表欄位（例 `{size}`、`{l}`、`{label}`）。
* `geometry.thread`（牙規如 `M8`、管徑如 `15A`）會寫入錨點；磁吸時只接相容規格（見 §2.3）。
* `normalizeParams()` 對字串規格做寬鬆比對：`m8` → `M8`、`4` → `Ø4`、`100` → `100mm`；找不到則用預設值。
* 台灣水管俗稱：3 分 = 10A、4 分 = 15A、6 分 = 20A、1 吋 = 25A（JIS G 3452 SGP）。

### 2.2 舊版 partId 相容（idAliases）

v1.0 的單一尺寸 ID 仍可使用，`validateAssembly()` / `loadAssembly()` / `addPart()` 會經由 `resolvePartRef()` 轉換：

| 舊 ID | 新 ID + 規格 |
|---|---|
| `threaded_rod_m8` / `hex_bolt_m8` / `hex_nut_m8` / `cap_nut_m8` / `washer_m8` | `threaded_rod` / `hex_bolt` / `hex_nut` / `cap_nut` / `washer` + `size: "M8"` |
| `gi_pipe_15a` / `gi_tee_15a` / `gi_elbow_15a` / `gi_flange_15a` | `gi_pipe` / `gi_tee` / `gi_elbow` / `gi_flange` + `size: "15A"` |

M8 / 15A 的尺寸與 v1.0 完全相同，舊設計拼裝結果不變。

### 2.3 規格相容（磁吸）

* 錨點帶 `thread`（牙規 / 管徑）與 `d`（mm）。
* 螺帽 / 華司（bore）只會套上**同牙規**的螺條 / 螺栓（pin）。
* 螺條 / 螺栓 / 螺帽不會吸進比自己細的孔（`d ≤ 孔徑 + 0.6mm`）。
* 管口只接**同管徑**；異徑接頭（`reducer`）兩端各自標示大 / 小管徑。

### 支援的 geometry.type（最少參數）

| type | 參數 (mm) | 局部座標 |
|---|---|---|
| `perforated_bar` | length, width, thickness, hole_d, pitch | 中心原點；長邊 X、厚 Y；孔沿 X 置中 |
| `mending_plate` | length, width, thickness, hole_d, n | 一字片；中心原點；長邊 X、厚 Y；n 孔沿 X 置中 |
| `t_plate` | length, stem, width, thickness, hole_d | T 型片；T 字交會中心原點；橫桿 X、直桿 +Z；6 孔 |
| `l_bracket` | leg, width, thickness, hole_d, hole_offset | 外角原點；水平腳 +X、垂直腳 +Y |
| `shelf_bracket` | a, b, width, thickness, hole_d | 三角架；外角原點；水平腳 a 沿 +X、垂直腳 b 沿 +Y，附斜撐；每腳 2 孔 |
| `threaded_rod` | thread, d, pitch, length | 中心原點；軸 Y |
| `hex_bolt` | thread, d, pitch, head_s, head_k, length | 頭部下緣原點；頭 +Y、螺桿 −Y |
| `carriage_bolt` | thread, d, pitch, dk, k, f, fh, length | 馬車螺絲；圓頭下緣原點；方頸 + 螺桿 −Y |
| `eye_bolt` | thread, d, ring_id, wire, collar_d, collar_h, length | 吊環；頸部下緣原點；環 +Y（XY 平面）、螺桿 −Y |
| `wood_screw` | d, dk, length | 木螺絲；沉頭頂面原點（與板面齊平）；螺絲 −Y |
| `hex_nut` | thread, s（對邊）, m（厚）, bore | 中心原點；軸 Y |
| `nylon_nut` | thread, s, m（六角高）, h（總高）, bore | 尼龍螺帽；中心原點；尼龍環 +Y |
| `coupling_nut` | thread, s, length, bore | 長螺帽；中心原點；軸 Y |
| `cap_nut` | thread, s, m, h, bore | 底面原點；圓頂 +Y |
| `wing_nut` | thread, bore, dk, m, h, e（翼展）, wt | 蝶型螺帽；底面原點；翼 +Y（XY 平面） |
| `washer` | thread, d1, d2, t | 中心原點 |
| `spring_washer` | thread, d1, d2, t | 彈簧華司；中心原點；開口兩端上下錯開 |
| `pipe` | thread, od, wall, length, engage | 中心原點；軸 Y；兩端管口 |
| `tee` / `elbow` / `cross` | thread, od, a（中心到端面）, engage | 中心原點；tee 口 ±X、+Y；elbow 口 +X、+Y；cross 口 ±X、±Y |
| `elbow45` | thread, od, a, engage | 中心原點；一口 −Y、一口朝 (+X,+Y) 45° |
| `pipe_cap` | thread, od, h, engage | 開口端面中心原點；開口 −Y、封頭 +Y |
| `reducer` | thread_big, thread_small, od_big, od_small, length, engage_big, engage_small | 中心原點；大口 +Y、小口 −Y |
| `flange` | thread, d, t, neck_d, neck_h, pcd, hole_d, engage | 底面中心；接口 +Y；4 孔 |
| `u_bolt` | d, inner（內寬 ≈ 管外徑）, leg | U 型管束；管心原點；圓弧 +Y（XY 平面）、兩腳 −Y |
| `hinge` | length, leaf, thickness, kd（軸徑）, hole_d, n | 鉸鏈攤平 180°；軸心原點；軸沿 Z、葉片 ±X；每片 n 孔 |
| `caster` | wheel_d, wheel_w, plate, plate_t, height, hole_d | 腳輪；地面原點（旋轉軸正下方）；頂板頂面 y = height；4 孔 |
| `panel` | width, depth, thickness, hole_d, pattern | 中心原點；寬 X、深 Z、厚 Y |

### 錨點（自動由幾何推導，不需手寫）

| kind | 由誰提供 | 吸附行為 |
|---|---|---|
| `hole` | 洞洞鐵、一字片、T 片、角鐵、三角架、板材、法蘭、鉸鏈、腳輪頂板 | 被 pin / bore / 另一個 hole 吸附 |
| `pin` | 螺條、螺栓、馬車螺絲、吊環、木螺絲、U 型管束兩腳 | 自動轉正、穿入孔（螺栓頭貼齊表面） |
| `bore` | 各種螺帽、華司 | 貼合孔表面，或沿螺條滑動 |
| `port` | 水管、三通、四通、彎頭、管帽、大小頭、法蘭 | 管口對管口接合（含插入深度 engage） |

## 3. AI 組合矩陣（Assembly）

```jsonc
{
  "schema": "buildm8.assembly/v1",
  "packageId": "taiwan_hardware_store_v1",
  "title": "簡易方形框架 30×30×30 cm",
  "summary": "四角 M8 螺條當立柱……",
  "items": [
    { "partId": "threaded_rod",   "params": { "size": "M8", "length": 300 }, "position": [-142.5, 150, -142.5], "rotation": [0, 0, 0] },
    { "partId": "perforated_bar", "params": { "length": 300 },               "position": [0, 10, -142.5],       "rotation": [0, 0, 0] },
    { "partId": "hex_nut",        "params": { "size": "M8" },                "position": [-142.5, 3.25, -142.5], "rotation": [0, 0, 0] }
  ],
  "steps": ["……給新手的組裝步驟……"]
}
```

* `position`：mm，Y 軸朝上，地面 y = 0。
* `rotation`：度，Euler XYZ（three.js 預設順序）。
* 前端收到後會 `validateAssembly()`：舊版 `partId` 經 `idAliases` 轉換；不存在的 `partId` 會被略過；不可裁切的參數會貼齊最近的現貨規格；不認得的 `size` 回到預設規格。
* 給 LLM 的 JSON Schema（`ASSEMBLY_JSON_SCHEMA`）中 `params` 固定包含 `size, length, width, depth, thickness, pattern`，零件沒有的參數填 `null`。
* 完整範例：[`src/data/mock/square_frame.json`](../src/data/mock/square_frame.json)。

## 4. 外部資料庫串接（規劃）

`src/data/providers.js` 定義 `PackageProvider { id, label, load() }`。TraceParts / PARTcommunity / McMaster-Carr
只需實作「外部欄位 → `geometry` 參數」的對應（範例：`mapTracePartsRow()`），**只抓標準參數、不下載 STEP/STL**，維持輕量。
