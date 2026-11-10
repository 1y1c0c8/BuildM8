/**
 * BuildM8 — 輕量化五金 Package 與 AI 組合矩陣的格式定義（JSDoc 型別）
 * ---------------------------------------------------------------------------
 * 設計原則：
 *   1. 不存 3D 模型檔，只存「標準幾何參數」(mm)。前端用 Primitive 幾何即時生成。
 *   2. 一個零件 = 一個 geometry.type + 少量參數；可調參數（如長度）用 `$param` 引用。
 *      同一種零件的不同尺寸（M4~M12、10A~25A）用「規格表」：params.size 選一列 sizes，
 *      geometry 內以 `@key` 引用該列的標準尺寸（例 `s: '@s'` → sizes[params.size].s）。
 *   3. 單位一律 mm / 度(deg)，與工業標準文件一致；3D 場景內部再換算為 cm。
 *   4. Package 可以來自內建 JSON，也可以來自外部 API（TraceParts / PARTcommunity /
 *      McMaster-Carr），只要 Provider 轉成同一份 schema 即可（見 providers.js）。
 *
 * @typedef {'fastener'|'profile'|'bracket'|'rod'|'pipe'|'fitting'|'panel'|'hardware'} PartCategory
 *
 * @typedef {Object} ParamSpec  使用者 / AI 可調整的參數
 * @property {number|string} default
 * @property {(number|string)[]} options   五金行常見現貨規格
 * @property {boolean} [custom]            可代客裁切 → 允許 min~max 內任意值
 * @property {number} [min]
 * @property {number} [max]
 * @property {string} [unit]               'mm'
 * @property {string} [label]
 *
 * @typedef {Object} PartDef
 * @property {string} id                   Package 內唯一 ID（AI 輸出以此引用）
 * @property {PartCategory} category
 * @property {{ 'zh-TW': string, en: string }} name
 * @property {string} standard             e.g. 'JIS B 1181'
 * @property {string} [thread]             e.g. 'M8'（單一尺寸零件用；尺寸家族改由 geometry.thread: '$size' 提供）
 * @property {string} material             'zinc' | 'steel' | 'galvanized' | 'plywood' | 'stainless'
 * @property {Object} geometry             { type, ...標準尺寸 }，數值可為 '$length'（引用參數）或 '@s'（引用規格表欄位）。
 *                                         geometry.thread（牙規 / 管徑）會寫進錨點，磁吸時只接相容規格。
 * @property {Record<string, ParamSpec>} [params]   尺寸家族必須有 params.size（options = sizes 的 key）
 * @property {Record<string, Record<string, number|string>>} [sizes]
 *                                         規格表：{ M8: { s: 13, m: 6.5, d: 8, price: 2 }, ... }；
 *                                         price 為該規格參考單價（可省略，改用 priceTWD）
 * @property {{ name: string, spec?: string, unit: string }} bom  採購清單顯示模板（{param} 或 {規格表欄位} 會被替換）
 * @property {number} priceTWD             參考單價（新台幣；規格表沒有 price 時使用）
 * @property {string[]} [aliases]          給 AI 意圖比對用的俗名（台灣五金行用語）
 * @property {string} [note]
 * @property {JointDef[]} [joints]          可動關節（鉸鏈開合、腳輪轉向 / 滾動），見下方 JointDef
 *
 * @typedef {Object} JointDef  可動關節：讓零件的某個剛體群組繞軸旋轉
 *   幾何生成器會替每個網格標上 group（省略 = 'base' 固定），錨點也帶 group；
 *   關節把 moving 群組繞 axis 旋轉 (value − zero) 度，旋轉中心為 origin。
 * @property {string} id                   關節 ID，也是 AssemblyItem.joints 的 key（例 'angle'）
 * @property {string} label                顯示名稱（繁體中文）
 * @property {'revolute'} type             目前只支援旋轉關節
 * @property {(number|string)[]} axis      旋轉軸（局部座標，會正規化）；正方向 = 數值增加的方向（右手定則）
 * @property {(number|string)[]} [origin]  旋轉中心（mm，局部座標；預設原點）。可用 '$param'、'@規格表欄位'、
 *                                         或 '#geometryKey*k'（解析後 geometry 的值 × k，例 '#wheel_d*0.5'）
 * @property {[number, number]} range      可調範圍（度）
 * @property {number} default              新零件 / AI 未指定時的值
 * @property {number} [zero]               幾何原始姿態對應的值（預設 0；鉸鏈 = 180 攤平）
 * @property {string} [unit]               '°'
 * @property {string} moving               被帶動的剛體群組（網格 / 錨點的 group）
 * @property {string} [parent]             巢狀關節：parent 關節也會帶動本關節（腳輪 roll 在 swivel 之內）
 * @property {boolean} [wrap]              可連續旋轉：超出 range 時取模而非夾住
 * @property {'heading'|'roll'} [follow]   拖曳整個零件時自動跟隨：heading = 轉向移動方向、roll = 依距離 / radius 滾動
 * @property {number|string} [radius]      follow: 'roll' 用的滾動半徑（mm，可用 '#wheel_d*0.5'）
 *
 * @typedef {Object} HardwarePackage
 * @property {string} packageId            e.g. 'taiwan_hardware_store_v1'
 * @property {string} name
 * @property {string} region               ISO 3166 e.g. 'TW'
 * @property {string} version
 * @property {'mm'} units
 * @property {string[]} standards          e.g. ['JIS','CNS','ISO']
 * @property {{ type: 'builtin'|'api', provider?: string, url?: string }} source
 * @property {PartDef[]} parts
 * @property {Record<string, { partId: string, params?: Record<string, number|string> }>} [idAliases]
 *                                         舊版 / 別名 partId → 實際零件 + 預設參數，例：
 *                                         { hex_nut_m8: { partId: 'hex_nut', params: { size: 'M8' } } }
 *
 * ---------------------------------------------------------------------------
 * AI 輸出的「組合矩陣」(Assembly)
 *
 * @typedef {Object} AssemblyItem
 * @property {string} partId                         必須存在於 package.parts
 * @property {Record<string, number|string>} [params] 例如 { length: 300 }
 * @property {[number, number, number]} position     mm，Y 軸朝上，地面 y=0
 * @property {[number, number, number]} rotation     度，Euler XYZ
 * @property {Record<string, number|null> | null} [joints]  關節值（度），例 { angle: 90 }；超出範圍會被夾住
 * @property {string} [note]
 *
 * @typedef {Object} Assembly
 * @property {'buildm8.assembly/v1'} schema
 * @property {string} packageId
 * @property {string} title
 * @property {string} [summary]
 * @property {AssemblyItem[]} items
 * @property {string[]} [steps]                      給新手的組裝步驟
 */

export const ASSEMBLY_SCHEMA = 'buildm8.assembly/v1'

/** 給 LLM structured output 用的 JSON Schema（與上方 Assembly typedef 對應） */
export const ASSEMBLY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'items', 'steps'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['partId', 'params', 'position', 'rotation', 'joints'],
        properties: {
          partId: { type: 'string' },
          params: {
            type: 'object',
            additionalProperties: false,
            required: ['size', 'length', 'width', 'depth', 'thickness', 'pattern'],
            properties: {
              size: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              length: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              width: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              depth: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              thickness: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              pattern: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
          },
          position: { type: 'array', items: { type: 'number' } },
          rotation: { type: 'array', items: { type: 'number' } },
          // 可動零件的關節值（度）；沒有關節的零件填 null
          joints: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['angle', 'swivel', 'roll'],
                properties: {
                  angle: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  swivel: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  roll: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                },
              },
              { type: 'null' },
            ],
          },
        },
      },
    },
  },
}
