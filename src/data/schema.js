/**
 * BuildM8 — 輕量化五金 Package 與 AI 組合矩陣的格式定義（JSDoc 型別）
 * ---------------------------------------------------------------------------
 * 設計原則：
 *   1. 不存 3D 模型檔，只存「標準幾何參數」(mm)。前端用 Primitive 幾何即時生成。
 *   2. 一個零件 = 一個 geometry.type + 少量參數；可調參數（如長度）用 `$param` 引用。
 *   3. 單位一律 mm / 度(deg)，與工業標準文件一致；3D 場景內部再換算為 cm。
 *   4. Package 可以來自內建 JSON，也可以來自外部 API（TraceParts / PARTcommunity /
 *      McMaster-Carr），只要 Provider 轉成同一份 schema 即可（見 providers.js）。
 *
 * @typedef {'fastener'|'profile'|'bracket'|'rod'|'pipe'|'fitting'|'panel'} PartCategory
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
 * @property {string} [thread]             e.g. 'M8'
 * @property {string} material             'zinc' | 'steel' | 'galvanized' | 'plywood' | 'stainless'
 * @property {Object} geometry             { type, ...標準尺寸 }，數值可為 '$length' 引用參數
 * @property {Record<string, ParamSpec>} [params]
 * @property {{ name: string, spec?: string, unit: string }} bom  採購清單顯示模板（{param} 會被替換）
 * @property {number} priceTWD             參考單價（新台幣）
 * @property {string[]} [aliases]          給 AI 意圖比對用的俗名（台灣五金行用語）
 * @property {string} [note]
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
 *
 * ---------------------------------------------------------------------------
 * AI 輸出的「組合矩陣」(Assembly)
 *
 * @typedef {Object} AssemblyItem
 * @property {string} partId                         必須存在於 package.parts
 * @property {Record<string, number|string>} [params] 例如 { length: 300 }
 * @property {[number, number, number]} position     mm，Y 軸朝上，地面 y=0
 * @property {[number, number, number]} rotation     度，Euler XYZ
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
        required: ['partId', 'params', 'position', 'rotation'],
        properties: {
          partId: { type: 'string' },
          params: {
            type: 'object',
            additionalProperties: false,
            required: ['length', 'width', 'depth', 'thickness', 'pattern'],
            properties: {
              length: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              width: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              depth: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              thickness: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              pattern: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
          },
          position: { type: 'array', items: { type: 'number' } },
          rotation: { type: 'array', items: { type: 'number' } },
        },
      },
    },
  },
}
