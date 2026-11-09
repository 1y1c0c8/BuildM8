# BuildM8 五金 Package 與組合矩陣格式 v1

## 1. 設計原則

| 原則 | 做法 |
|---|---|
| 不建模，只存參數 | 每個零件 = `geometry.type` + 標準尺寸（mm）。前端用 Box / Cylinder / Extrude（帶孔 Shape）即時生成。 |
| 對齊工業標準 | 尺寸取自 ISO / DIN / JIS / CNS（例：M8 六角螺帽 JIS B 1181 → 對邊 13、厚 6.5）。 |
| 可調參數最少化 | 只有「五金行會問你的規格」才開放成參數（長度、板材尺寸）。用 `"$length"` 在 geometry 內引用。 |
| 在地化 = 換一包 JSON | 新增國家 / 通路只需要新增一個 Package（或寫一個 Provider 轉換外部 API）。 |

## 2. Package 格式

```jsonc
{
  "packageId": "taiwan_hardware_store_v1",
  "name": "台灣五金行 標準件包",
  "region": "TW",
  "version": "1.0.0",
  "units": "mm",
  "standards": ["JIS", "CNS", "ISO", "DIN"],
  "source": { "type": "builtin" },          // 或 { "type": "api", "provider": "traceparts" }
  "parts": [
    {
      "id": "hex_nut_m8",                    // AI 輸出以此引用
      "category": "fastener",
      "name": { "zh-TW": "六角螺帽 M8", "en": "Hex Nut M8" },
      "standard": "JIS B 1181",
      "thread": "M8",
      "material": "zinc",
      "geometry": { "type": "hex_nut", "s": 13, "m": 6.5, "bore": 8 },
      "bom": { "name": "M8 六角螺帽（1 種）", "unit": "顆" },
      "priceTWD": 2,
      "aliases": ["螺帽", "螺母", "nut"]     // 給 AI 比對台灣俗名
    },
    {
      "id": "threaded_rod_m8",
      "category": "rod",
      "standard": "DIN 975",
      "geometry": { "type": "threaded_rod", "d": 8, "pitch": 1.25, "length": "$length" },
      "params": {
        "length": { "default": 300, "options": [50, 100, 150, 200, 300, 500, 1000],
                    "custom": true, "min": 20, "max": 1000, "unit": "mm" }   // custom = 可代客裁切
      },
      "bom": { "name": "M8 全牙螺絲條", "spec": "L{length}mm", "unit": "支" }
    }
  ]
}
```

### 支援的 geometry.type（最少參數）

| type | 參數 (mm) | 局部座標 |
|---|---|---|
| `perforated_bar` | length, width, thickness, hole_d, pitch | 中心原點；長邊 X、厚 Y；孔沿 X 置中 |
| `l_bracket` | leg, width, thickness, hole_d, hole_offset | 外角原點；水平腳 +X、垂直腳 +Y |
| `threaded_rod` | d, pitch, length | 中心原點；軸 Y |
| `hex_bolt` | d, head_s, head_k, length | 頭部下緣原點；頭 +Y、螺桿 −Y |
| `hex_nut` | s（對邊）, m（厚）, bore | 中心原點；軸 Y |
| `cap_nut` | s, m, h, bore | 底面原點；圓頂 +Y |
| `washer` | d1, d2, t | 中心原點 |
| `pipe` | od, wall, length, engage | 中心原點；軸 Y；兩端管口 |
| `tee` / `elbow` | od, a（中心到端面）, engage | 中心原點；tee 口 ±X、+Y；elbow 口 +X、+Y |
| `flange` | d, t, neck_d, neck_h, pcd, hole_d, engage | 底面中心；接口 +Y；4 孔 |
| `panel` | width, depth, thickness, hole_d, pattern | 中心原點；寬 X、深 Z、厚 Y |

### 錨點（自動由幾何推導，不需手寫）

| kind | 由誰提供 | 吸附行為 |
|---|---|---|
| `hole` | 洞洞鐵、角鐵、板材、法蘭 | 被 pin / bore / 另一個 hole 吸附 |
| `pin` | 螺條、螺栓 | 自動轉正、穿入孔（螺栓頭貼齊表面） |
| `bore` | 螺帽、華司 | 貼合孔表面，或沿螺條滑動 |
| `port` | 水管、三通、彎頭、法蘭 | 管口對管口接合（含插入深度 engage） |

## 3. AI 組合矩陣（Assembly）

```jsonc
{
  "schema": "buildm8.assembly/v1",
  "packageId": "taiwan_hardware_store_v1",
  "title": "簡易方形框架 30×30×30 cm",
  "summary": "四角 M8 螺條當立柱……",
  "items": [
    { "partId": "threaded_rod_m8", "params": { "length": 300 }, "position": [-142.5, 150, -142.5], "rotation": [0, 0, 0] },
    { "partId": "perforated_bar",  "params": { "length": 300 }, "position": [0, 10, -142.5],       "rotation": [0, 0, 0] },
    { "partId": "hex_nut_m8",                                   "position": [-142.5, 3.25, -142.5], "rotation": [0, 0, 0] }
  ],
  "steps": ["……給新手的組裝步驟……"]
}
```

* `position`：mm，Y 軸朝上，地面 y = 0。
* `rotation`：度，Euler XYZ（three.js 預設順序）。
* 前端收到後會 `validateAssembly()`：不存在的 `partId` 會被略過；不可裁切的參數會貼齊最近的現貨規格。
* 完整範例：[`src/data/mock/square_frame.json`](../src/data/mock/square_frame.json)。

## 4. 外部資料庫串接（規劃）

`src/data/providers.js` 定義 `PackageProvider { id, label, load() }`。TraceParts / PARTcommunity / McMaster-Carr
只需實作「外部欄位 → `geometry` 參數」的對應（範例：`mapTracePartsRow()`），**只抓標準參數、不下載 STEP/STL**，維持輕量。
