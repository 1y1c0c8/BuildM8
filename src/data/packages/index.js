import { taiwan_hardware_store_v1 } from './taiwan_hardware_store_v1'

/** 已載入的 Package。未來可由 providers.js 從 API 動態加入。 */
export const PACKAGES = {
  [taiwan_hardware_store_v1.packageId]: taiwan_hardware_store_v1,
}

/** Package 切換選單：available=false 代表規劃中的在地包 / API 來源 */
export const PACKAGE_CATALOG = [
  { packageId: 'taiwan_hardware_store_v1', label: '🇹🇼 台灣五金行 v1', available: true },
  { packageId: 'japan_homecenter_v1', label: '🇯🇵 日本 Home Center（JIS）', available: false },
  { packageId: 'eu_din_hardware_v1', label: '🇪🇺 歐規 DIN / ISO', available: false },
  { packageId: 'us_mcmaster_imperial_v1', label: '🇺🇸 McMaster-Carr（英制，API）', available: false },
]

export const getPackage = (id) => PACKAGES[id] ?? taiwan_hardware_store_v1
