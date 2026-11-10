/**
 * 設計小工具：給 Claude Code 的 design-engineer 代理人（或你自己）寫「計算座標的一次性腳本」用。
 * 所有尺寸都直接取自零件包，避免手算出錯。
 *
 *   // designs/.work/my-clock.mjs
 *   import { geo, item, assembly, holes, save } from '../../scripts/lib/design-kit.mjs'
 *   const nut = geo('hex_nut', { size: 'M8' })        // → { type, s, m, bore, thread, ... }（mm）
 *   const items = [item('threaded_rod', { size: 'M8', length: 120 }, [0, 60, 0])]
 *   await save('designs/my-clock.json', assembly({ title, summary, steps, items }))
 *
 * save() 會寫檔並立刻跑驗證，印出錯誤 / 警告；回傳完整報告物件。
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { loadSrc } from './load-src.mjs'
import { analyzeAssembly } from './analyze.mjs'

export const ctx = await loadSrc()
export const { parts } = ctx
export const pkg = ctx.packages.getPackage('taiwan_hardware_store_v1')

/** 零件定義（含 sizes 規格表、params 可選值） */
export const def = (id) => {
  const d = pkg.parts.find((p) => p.id === id)
  if (!d) throw new Error(`零件包中沒有 ${id}`)
  return d
}

/** 零件的實際幾何尺寸（mm），已套用規格表與參數 */
export const geo = (id, params = {}) => {
  const d = def(id)
  return parts.resolveGeometry(d, parts.normalizeParams(d, params))
}

/** 零件的錨點（孔 / 軸 / 管口），局部座標 mm */
export const anchors = (id, params = {}) => {
  const d = def(id)
  return parts.getAnchors(d, parts.normalizeParams(d, params))
}

/** 常用孔位：合板 [x,z]、洞洞鐵 x、一字片 x */
export const holes = {
  panel: (params) => parts.panelHoles(geo('plywood_panel', params)),
  bar: (length) => parts.barHoles(geo('perforated_bar', { length })),
  mend: (size) => parts.mendHoles(geo('mending_plate', { size })),
}

/** 新增零件時「平放在地面上」的中心 y */
export const restY = (id, params = {}) => {
  const d = def(id)
  return parts.restY(d, parts.normalizeParams(d, params))
}

const r1 = (v) => Math.round(v * 10) / 10

/** 一個組合矩陣項目（座標四捨五入到 0.1 mm） */
export const item = (partId, params, position, rotation = [0, 0, 0]) => ({
  partId,
  ...(params && Object.keys(params).length ? { params } : {}),
  position: position.map(r1),
  rotation: rotation.map(r1),
})

/** 沿著軸由下往上疊零件：stack(起點 y, [['hex_nut', 6.5], ['washer', 1.6], ...]) → 每個零件的中心 y */
export function stack(start, thicknesses) {
  let y = start
  return thicknesses.map((t) => {
    const c = y + t / 2
    y += t
    return c
  })
}

export const assembly = ({ title, summary = '', steps = [], items }) => ({
  schema: ctx.schema.ASSEMBLY_SCHEMA,
  packageId: pkg.packageId,
  title,
  summary,
  steps,
  items,
})

/** 寫檔 + 驗證；quiet=false 時印出錯誤與警告摘要 */
export async function save(file, a, { quiet = false } = {}) {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true })
  await writeFile(file, JSON.stringify(a, null, 2) + '\n')
  const report = analyzeAssembly(a, ctx)
  if (!quiet) {
    const d = report.dimensions
    console.log(`${file}：${report.ok ? '通過' : '未通過'}，${report.counts.errors} 錯誤 / ${report.counts.warnings} 警告，${report.partCount} 件${d ? `，${d.width}×${d.height}×${d.depth} mm` : ''}，約 NT$ ${report.totalPrice}`)
    for (const x of report.issues.filter((i) => i.level !== 'info')) console.log(`  ${x.level === 'error' ? '✗' : '!'} ${x.message}`)
  }
  return report
}
