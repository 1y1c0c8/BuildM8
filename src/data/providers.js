/**
 * Package Provider 介面：把任何來源（內建 JSON / TraceParts / PARTcommunity /
 * McMaster-Carr）轉成 BuildM8 的 HardwarePackage schema。
 *
 * 前端只認得 schema，不認得供應商——因此切換國家標準件只需要多寫一個 Provider。
 */
import { PACKAGES } from './packages'

/** @typedef {{ id: string, label: string, load: () => Promise<import('./schema').HardwarePackage> }} PackageProvider */

/** @type {PackageProvider} */
export const builtinProvider = {
  id: 'builtin',
  label: '內建',
  load: async () => PACKAGES.taiwan_hardware_store_v1,
}

/**
 * 【偽代碼】TraceParts Web API Provider
 * 只抓「標準參數」而不是 STEP/STL 模型，維持輕量。
 */
export const tracePartsProvider = {
  id: 'traceparts',
  label: 'TraceParts（規劃中）',
  async load({ token, catalog = 'ISO', region = 'TW' } = {}) {
    // const res = await fetch(`https://api.traceparts.com/v2/.../catalogs/${catalog}/parts`, {
    //   headers: { Authorization: `Bearer ${token}` },
    // })
    // const rows = await res.json()
    // return {
    //   packageId: `traceparts_${catalog.toLowerCase()}_${region.toLowerCase()}_v1`,
    //   name: `TraceParts ${catalog}`, region, version: '1.0.0', units: 'mm',
    //   standards: [catalog], source: { type: 'api', provider: 'traceparts' },
    //   parts: rows.map(mapTracePartsRow).filter(Boolean),
    // }
    throw new Error('TraceParts provider 尚未實作：需要 API 金鑰與欄位對應表。')
  },
}

/**
 * 【偽代碼】欄位對應：外部資料庫的標準件 → BuildM8 PartDef
 * 例如 ISO 4032 hex nut M8 → { geometry: { type: 'hex_nut', s: 13, m: 6.8, bore: 8 } }
 */
export function mapTracePartsRow(row) {
  switch (row.standardFamily) {
    case 'ISO 4032':
      return {
        id: `hex_nut_${row.size.toLowerCase()}`,
        category: 'fastener',
        name: { 'zh-TW': `六角螺帽 ${row.size}`, en: `Hex Nut ${row.size}` },
        standard: 'ISO 4032', thread: row.size, material: 'zinc',
        geometry: { type: 'hex_nut', s: row.s, m: row.m, bore: row.d },
        bom: { name: `${row.size} 六角螺帽`, unit: '顆' },
        priceTWD: row.price ?? 0,
      }
    default:
      return null // 不支援的幾何型別先略過
  }
}
