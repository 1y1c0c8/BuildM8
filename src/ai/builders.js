/**
 * Mock 設計產生器：模擬 LLM 依 Package 標準尺寸「算出」的組合矩陣。
 * 所有座標 mm、角度 deg，與 buildm8.assembly/v1 一致。
 * 真正接上 LLM 時，這些函式可當成 few-shot 範例或驗證基準。
 */
import { ASSEMBLY_SCHEMA } from '../data/schema'
import { resolveGeometry, barHoles, panelHoles } from '../data/parts'

const geo = (pkg, id, params = {}) => {
  const def = pkg.parts.find((p) => p.id === id)
  return resolveGeometry(def, { ...Object.fromEntries(Object.entries(def.params ?? {}).map(([k, v]) => [k, v.default])), ...params })
}
const r1 = (v) => Math.round(v * 10) / 10
const P = (partId, position, rotation = [0, 0, 0], params) => ({
  partId,
  ...(params ? { params } : {}),
  position: position.map(r1),
  rotation,
})

/** ① 簡易方形框架：4 支 M8 螺條 + 上下兩圈洞洞鐵 + L 角鐵立耳 */
export function buildSquareFrame(pkg, { size = 300, height = 300 } = {}) {
  const bar = geo(pkg, 'perforated_bar', { length: size })
  const nut = geo(pkg, 'hex_nut_m8')
  const wsh = geo(pkg, 'washer_m8')
  const cap = geo(pkg, 'cap_nut_m8')
  const br = geo(pkg, 'l_bracket')
  const holes = barHoles(bar)
  const c = holes[holes.length - 1] // 最外側孔中心
  const corners = [[-c, -c], [c, -c], [-c, c], [c, c]]
  const items = []

  // 下層疊放順序（由下往上）：螺帽 → 角鐵 → X 洞洞鐵 → Z 洞洞鐵 → 華司 → 螺帽
  let y = 0
  const yNutB = y + nut.m / 2; y += nut.m
  const yBr = y; y += br.thickness
  const yBarX = y + bar.thickness / 2; y += bar.thickness
  const yBarZ = y + bar.thickness / 2; y += bar.thickness
  const yW = y + wsh.t / 2; y += wsh.t
  const yNutT = y + nut.m / 2

  // 上層：螺帽 → 華司 → X → Z → 華司 → 螺帽 → 蓋帽
  const top = height - 35
  let u = top
  const uNut1 = u + nut.m / 2; u += nut.m
  const uW1 = u + wsh.t / 2; u += wsh.t
  const uBarX = u + bar.thickness / 2; u += bar.thickness
  const uBarZ = u + bar.thickness / 2; u += bar.thickness
  const uW2 = u + wsh.t / 2; u += wsh.t
  const uNut2 = u + nut.m / 2; u += nut.m
  const capBase = height - (cap.h - 2)

  for (const yy of [[yBarX, yBarZ], [uBarX, uBarZ]]) {
    items.push(P('perforated_bar', [0, yy[0], -c], [0, 0, 0], { length: size }))
    items.push(P('perforated_bar', [0, yy[0], c], [0, 0, 0], { length: size }))
    items.push(P('perforated_bar', [-c, yy[1], 0], [0, 90, 0], { length: size }))
    items.push(P('perforated_bar', [c, yy[1], 0], [0, 90, 0], { length: size }))
  }
  for (const [x, z] of corners) {
    const sx = Math.sign(x)
    items.push(P('threaded_rod_m8', [x, height / 2, z], [0, 0, 0], { length: height }))
    items.push(P('l_bracket', [x + sx * br.hole_offset, yBr, z], [0, sx > 0 ? 180 : 0, 0]))
    items.push(P('hex_nut_m8', [x, yNutB, z]))
    items.push(P('washer_m8', [x, yW, z]))
    items.push(P('hex_nut_m8', [x, yNutT, z]))
    items.push(P('hex_nut_m8', [x, uNut1, z]))
    items.push(P('washer_m8', [x, uW1, z]))
    items.push(P('washer_m8', [x, uW2, z]))
    items.push(P('hex_nut_m8', [x, uNut2, z]))
    items.push(P('cap_nut_m8', [x, Math.max(capBase, u), z]))
  }

  return {
    schema: ASSEMBLY_SCHEMA,
    packageId: pkg.packageId,
    title: `簡易方形框架 ${size / 10}×${size / 10}×${height / 10} cm`,
    summary: '四角 M8 全牙螺條當立柱，上下各用 4 支洞洞鐵以「孔對孔」交疊成方框，螺帽上下夾緊；底部 L 角鐵可再鎖上側板或固定在牆面。',
    items,
    steps: [
      `在 4 支 ${size}mm 洞洞鐵的最外側孔，兩兩交疊成方框（下層 X 向、上層 Z 向）。`,
      '每支螺條先旋入一顆螺帽到底部，再套入 L 角鐵與方框。',
      '加華司後鎖上第二顆螺帽，把下框夾緊。',
      `在約 ${top / 10}cm 高處重複一次，做出上框。`,
      '最後在螺條頂端鎖上蓋型螺帽，安全又美觀。',
    ],
  }
}

/** ② 有厚度的方形時鐘外殼：前後兩片合板 + 4 支螺條當間隔柱 */
export function buildClockCase(pkg, { size = 200, depth = 40 } = {}) {
  const front = geo(pkg, 'plywood_panel', { width: size, depth: size, thickness: 6, pattern: 'corners' })
  const nut = geo(pkg, 'hex_nut_m8')
  const wsh = geo(pkg, 'washer_m8')
  const cap = geo(pkg, 'cap_nut_m8')
  const t = front.thickness
  const half = depth / 2
  const rodLen = depth + 2 * t + 2 * (wsh.t + cap.m) + 2
  const cy = size / 2 // 立在桌上
  const items = []
  const panelParams = { width: size, depth: size, thickness: t, pattern: 'corners' }
  items.push(P('plywood_panel', [0, cy, half + t / 2], [90, 0, 0], panelParams))
  items.push(P('plywood_panel', [0, cy, -half - t / 2], [90, 0, 0], panelParams))

  for (const [hx, hz] of panelHoles(front)) {
    // 板子繞 X 轉 90°：局部 z → 世界 -y
    const x = hx
    const y = cy - hz
    items.push(P('threaded_rod_m8', [x, y, 0], [90, 0, 0], { length: Math.round(rodLen) }))
    for (const s of [1, -1]) {
      items.push(P('hex_nut_m8', [x, y, s * (half - nut.m / 2)], [90, 0, 0]))
      items.push(P('washer_m8', [x, y, s * (half + t + wsh.t / 2)], [90, 0, 0]))
      items.push(P('cap_nut_m8', [x, y, s * (half + t + wsh.t)], [s * 90, 0, 0]))
    }
  }

  return {
    schema: ASSEMBLY_SCHEMA,
    packageId: pkg.packageId,
    title: `方形時鐘外殼 ${size / 10}×${size / 10} cm（厚 ${(depth + 2 * t) / 10} cm）`,
    summary: `前後兩片 ${t}mm 椴木合板，四角以 M8 螺條當間隔柱，內側用螺帽定位出 ${depth}mm 的厚度空間，可放入時鐘機芯與電池。外側用蓋型螺帽收邊，看起來像工業風框體。`,
    items,
    steps: [
      `請木材行裁兩片 ${size}×${size}mm 合板，四角距邊 15mm 鑽 Ø8.5 孔；前板中心另鑽 Ø8 機芯孔。`,
      `螺條裁成 ${Math.round(rodLen)}mm 共 4 支。`,
      `每支螺條中段鎖兩顆螺帽，間距 ${depth}mm（這就是外殼厚度）。`,
      '把螺條穿過前後板，外側加華司、鎖蓋型螺帽夾緊。',
      '裝上時鐘機芯與指針即完成。',
    ],
  }
}

/** ③ CD 收納展示架：合板底座 + 16 支螺條當隔柱 */
export function buildCdRack(pkg, { width = 360, rodHeight = 150 } = {}) {
  const base = geo(pkg, 'plywood_panel', { width, depth: 160, thickness: 12, pattern: 'rack_2x8' })
  const nut = geo(pkg, 'hex_nut_m8')
  const wsh = geo(pkg, 'washer_m8')
  const cap = geo(pkg, 'cap_nut_m8')
  const items = []
  let y = 0
  const yNut1 = y + nut.m / 2; y += nut.m
  const yW1 = y + wsh.t / 2; y += wsh.t
  const yBase = y + base.thickness / 2; y += base.thickness
  const yW2 = y + wsh.t / 2; y += wsh.t
  const yNut2 = y + nut.m / 2

  items.push(P('plywood_panel', [0, yBase, 0], [0, 0, 0], { width, depth: 160, thickness: 12, pattern: 'rack_2x8' }))
  for (const [x, z] of panelHoles(base)) {
    items.push(P('threaded_rod_m8', [x, rodHeight / 2, z], [0, 0, 0], { length: rodHeight }))
    items.push(P('hex_nut_m8', [x, yNut1, z]))
    items.push(P('washer_m8', [x, yW1, z]))
    items.push(P('washer_m8', [x, yW2, z]))
    items.push(P('hex_nut_m8', [x, yNut2, z]))
    items.push(P('cap_nut_m8', [x, rodHeight - (cap.h - 3), z]))
  }
  const slot = (width - 50) / 7
  return {
    schema: ASSEMBLY_SCHEMA,
    packageId: pkg.packageId,
    title: `CD 收納展示架（${width / 10} cm 寬，8 格）`,
    summary: `12mm 合板底座鑽 2×8 排孔，立 16 支 ${rodHeight}mm M8 螺條當隔柱；每格寬約 ${Math.round(slot)}mm，可直立約 4 片 CD 盒（10mm 厚）。底部螺帽兼當腳墊。`,
    items,
    steps: [
      `請木材行裁 ${width}×160mm、12mm 厚合板，依 2 排 × 8 孔鑽 Ø8.5（前後排距 100mm）。`,
      `螺條裁成 ${rodHeight}mm 共 16 支。`,
      '每支螺條底部：螺帽 → 華司 → 穿過底板 → 華司 → 螺帽 夾緊。',
      '螺條頂端鎖上蓋型螺帽，避免刮手。',
    ],
  }
}

/** ④ 工業風水管層架：4 分鍍鋅管 + 三通 + 彎頭 + 地板法蘭 + 兩片層板 */
export function buildPipeShelf(pkg, { span = 200, rise = 300 } = {}) {
  const pipe = geo(pkg, 'gi_pipe_15a', { length: span })
  const tee = geo(pkg, 'gi_tee_15a')
  const elbow = geo(pkg, 'gi_elbow_15a')
  const fl = geo(pkg, 'gi_flange_15a')
  const rT = tee.a - tee.engage
  const rE = elbow.a - elbow.engage
  const zLeg = span / 2 + rT // 前後腳中心 z
  const xSide = 220
  const flTop = fl.t + fl.neck_h - fl.engage
  const items = []
  const yPipe1 = flTop + rise / 2
  const yTee = flTop + rise + rT
  const yPipe2 = yTee + rT + rise / 2
  const yElbow = yTee + rT + rise + rE

  for (const x of [-xSide, xSide]) {
    for (const s of [-1, 1]) {
      const z = s * zLeg
      items.push(P('gi_flange_15a', [x, 0, z]))
      items.push(P('gi_pipe_15a', [x, yPipe1, z], [0, 0, 0], { length: rise }))
      items.push(P('gi_tee_15a', [x, yTee, z], s < 0 ? [0, 90, 90] : [0, -90, 90]))
      items.push(P('gi_pipe_15a', [x, yPipe2, z], [0, 0, 0], { length: rise }))
      items.push(P('gi_elbow_15a', [x, yElbow, z], s < 0 ? [180, 90, 0] : [180, -90, 0]))
    }
    items.push(P('gi_pipe_15a', [x, yTee, 0], [90, 0, 0], { length: span }))
    items.push(P('gi_pipe_15a', [x, yElbow, 0], [90, 0, 0], { length: span }))
  }
  const shelfW = xSide * 2 + 80
  const shelfD = Math.round(zLeg * 2 + 60)
  for (const yy of [yTee, yElbow]) {
    items.push(P('plywood_panel', [0, yy + pipe.od / 2 + 9, 0], [0, 0, 0], { width: shelfW, depth: shelfD, thickness: 18, pattern: 'none' }))
  }
  return {
    schema: ASSEMBLY_SCHEMA,
    packageId: pkg.packageId,
    title: '工業風水管層架（2 層）',
    summary: `4 分鍍鋅水管搭配三通、90° 彎頭與地板法蘭做出兩組 ㄇ 字側架，上面放 ${shelfW}×${shelfD}mm、18mm 厚層板。所有管長只用 ${rise}mm 與 ${span}mm 兩種，好採購。`,
    items,
    steps: [
      '地板法蘭鎖上 300mm 直管，再接三通（側口朝內）。',
      '三通上方再接一支 300mm 直管，頂端接 90° 彎頭（朝內）。',
      `前後兩腳之間用 ${span}mm 橫管連接三通與彎頭，完成一組側架；做兩組。`,
      '把兩片層板放上橫管，可用 U 型管夾從下方固定。',
    ],
  }
}
