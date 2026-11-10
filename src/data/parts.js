/**
 * 零件工具函式：參數解析、錨點（孔洞 / 軸 / 管口）、BOM 文字。
 * 所有數值皆為 mm，局部座標系 Y 軸朝上。
 */

export const defaultParams = (def) =>
  Object.fromEntries(Object.entries(def.params ?? {}).map(([k, p]) => [k, p.default]))

/** 規格字串比對用：'m8' → 'M8'、'Ø4' → '4'、'2吋' → '2'（去掉空白、符號與單位文字） */
const normKey = (v) => String(v).toUpperCase().replace(/[^0-9A-Z.×]/g, '').replace(/MM$/, '')

/** 在現貨選項中找出與 v 相符的字串規格（大小寫 / 單位寫法寬鬆比對） */
function matchOption(options, v) {
  if (options.includes(v)) return v
  const k = normKey(v)
  return options.find((o) => normKey(o) === k) ?? options.find((o) => parseFloat(normKey(o)) === parseFloat(k) && /^[0-9.]+$/.test(k))
}

/** 把 AI / 使用者給的參數修正為合法值：不可裁切 → 貼齊最近的現貨規格 */
export function normalizeParams(def, raw = {}) {
  const out = defaultParams(def)
  for (const [key, spec] of Object.entries(def.params ?? {})) {
    const v = raw?.[key]
    if (v === undefined || v === null || v === '') continue
    if (typeof spec.default === 'string') {
      const hit = matchOption(spec.options, v)
      if (hit !== undefined) out[key] = hit
      continue
    }
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (spec.custom) out[key] = Math.min(spec.max ?? n, Math.max(spec.min ?? n, Math.round(n)))
    else out[key] = spec.options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))
  }
  return out
}

/**
 * 規格表（sizes）：一個零件定義涵蓋整個尺寸家族。
 * params.size 的值（例 'M8'、'15A'）對應 def.sizes 中的一列標準尺寸。
 * @returns {Record<string, any> | null}
 */
export function sizeRow(def, params) {
  if (!def.sizes) return null
  const fallback = def.params?.size?.default
  return def.sizes[params?.size] ?? def.sizes[fallback] ?? null
}

/**
 * 將 geometry 中的引用換成實際值：
 *   '$length' → params.length（使用者 / AI 可調參數）
 *   '@s'      → sizes[params.size].s（規格表中的標準尺寸）
 */
export function resolveGeometry(def, params = {}) {
  const p = { ...defaultParams(def), ...params }
  const row = sizeRow(def, p) ?? {}
  const g = {}
  for (const [k, v] of Object.entries(def.geometry)) {
    if (typeof v === 'string' && v.startsWith('$')) g[k] = p[v.slice(1)]
    else if (typeof v === 'string' && v.startsWith('@')) g[k] = row[v.slice(1)]
    else g[k] = v
  }
  return g
}

/** 舊版 / 別名 partId（例 'hex_nut_m8'）→ 實際零件與預設規格 */
export function resolvePartRef(pkg, partId, params = {}) {
  const direct = pkg.parts.find((p) => p.id === partId)
  if (direct) return { def: direct, params }
  const alias = pkg.idAliases?.[partId]
  const def = alias && pkg.parts.find((p) => p.id === alias.partId)
  if (!def) return null
  return { def, params: { ...alias.params, ...params } }
}

/** 參考單價：規格表有 price 就用該規格的價格 */
export const partPrice = (def, params) => sizeRow(def, params)?.price ?? def.priceTWD

/** 洞洞板 / 合板孔位 (x, z)，以零件中心為原點 */
export function panelHoles(g) {
  const hw = g.width / 2
  const hd = g.depth / 2
  if (g.pattern === 'corners') {
    const i = 15
    return [[-hw + i, -hd + i], [hw - i, -hd + i], [-hw + i, hd - i], [hw - i, hd - i]]
  }
  if (g.pattern === 'rack_2x8') {
    const cols = 8
    const ix = 25
    const iz = 30
    const out = []
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        out.push([-hw + ix + ((g.width - 2 * ix) * c) / (cols - 1), r === 0 ? -hd + iz : hd - iz])
      }
    }
    return out
  }
  return []
}

export function barHoles(g) {
  const n = Math.floor(g.length / g.pitch)
  const start = -((n - 1) * g.pitch) / 2
  return Array.from({ length: n }, (_, i) => start + i * g.pitch)
}

/** 一字片孔位（沿 X，置中） */
export function mendHoles(g) {
  const m = Math.max(g.hole_d * 1.3, g.length * 0.1)
  const span = g.length - 2 * m
  return Array.from({ length: g.n }, (_, i) => -g.length / 2 + m + (g.n === 1 ? span / 2 : (span * i) / (g.n - 1)))
}

/** T 型片孔位 [x, z]：原點在 T 字交會中心，橫桿沿 X，直桿往 +Z */
export function tPlateHoles(g) {
  const arm = g.length / 2
  const m = Math.max(g.hole_d * 1.2, g.width * 0.45)
  const inner = g.width / 2 + g.hole_d * 1.1
  const d1 = arm - m
  const d2 = Math.max(inner, d1 - Math.max(g.hole_d * 2.4, (d1 - inner) * 0.6))
  const ds1 = g.stem - m
  const ds2 = Math.max(inner, ds1 - Math.max(g.hole_d * 2.4, (ds1 - inner) * 0.6))
  return [[-d1, 0], [-d2, 0], [d2, 0], [d1, 0], [0, ds2], [0, ds1]]
}

/** 三角架孔位：水平腳的 x、垂直腳的 y（原點在外角） */
export function shelfBracketHoles(g) {
  return { h: [g.a * 0.42, g.a * 0.82], v: [g.b * 0.42, g.b * 0.82] }
}

/** 鉸鏈孔位 [x, z]（攤平，原點在軸心；左右各 n 孔） */
export function hingeHoles(g) {
  const x = g.kd / 2 + (g.leaf - g.kd / 2) * 0.55
  const m = g.length * 0.16
  const zs = Array.from({ length: g.n }, (_, i) => -g.length / 2 + m + (g.n === 1 ? 0 : ((g.length - 2 * m) * i) / (g.n - 1)))
  return zs.flatMap((z) => [[-x, z], [x, z]])
}

/** 腳輪頂板 4 孔 [x, z] */
export function casterHoles(g) {
  const o = g.plate / 2 - Math.max(6, g.hole_d * 1.3)
  return [[-o, -o], [o, -o], [-o, o], [o, o]]
}

/** 45° 彎頭第二口方向（XY 平面，往右上 45°） */
export const DIR45 = [Math.SQRT1_2, Math.SQRT1_2, 0]

/**
 * 錨點定義（局部座標，mm）
 *  - hole : 本零件上的孔，螺條 / 螺栓 / 螺帽可吸附（d = 孔徑）
 *  - pin  : 本零件是「軸」（螺條、螺栓）→ 會吸進孔；螺帽也可套在它上面（d = 公稱徑、thread = 牙規）
 *  - bore : 本零件是「套件」（螺帽、華司）→ 會套到孔或軸上（d = 內徑、thread = 牙規）
 *  - port : 管口（水管 / 管件），管口對管口接合（thread = 管徑規格，如 15A）
 * @returns {{kind:'hole'|'pin'|'bore'|'port', p:number[], dir:number[], half?:number, seat?:number, d?:number, thread?:string}[]}
 */
export function getAnchors(def, params) {
  const g = resolveGeometry(def, params)
  const th = g.thread
  const hole = (p, dir, half, d = g.hole_d) => ({ kind: 'hole', p, dir, half, d })
  const bore = (half, seat, d) => ({ kind: 'bore', p: [0, 0, 0], dir: [0, 1, 0], half, seat, d, thread: th })
  const port = (p, dir, thread = th) => ({ kind: 'port', p, dir, thread })
  switch (g.type) {
    case 'perforated_bar':
      return barHoles(g).map((x) => hole([x, 0, 0], [0, 1, 0], g.thickness / 2))
    case 'mending_plate':
      return mendHoles(g).map((x) => hole([x, 0, 0], [0, 1, 0], g.thickness / 2))
    case 't_plate':
      return tPlateHoles(g).map(([x, z]) => hole([x, 0, z], [0, 1, 0], g.thickness / 2))
    case 'l_bracket':
      return [
        hole([g.hole_offset, g.thickness / 2, 0], [0, 1, 0], g.thickness / 2),
        hole([g.thickness / 2, g.hole_offset, 0], [1, 0, 0], g.thickness / 2),
      ]
    case 'shelf_bracket': {
      const { h, v } = shelfBracketHoles(g)
      return [
        ...h.map((x) => hole([x, g.thickness / 2, 0], [0, 1, 0], g.thickness / 2)),
        ...v.map((y) => hole([g.thickness / 2, y, 0], [1, 0, 0], g.thickness / 2)),
      ]
    }
    case 'panel':
      return panelHoles(g).map(([x, z]) => hole([x, 0, z], [0, 1, 0], g.thickness / 2))
    case 'hinge':
      return hingeHoles(g).map(([x, z]) => hole([x, -g.kd / 2 + g.thickness / 2, z], [0, 1, 0], g.thickness / 2))
    case 'caster':
      return casterHoles(g).map(([x, z]) => hole([x, g.height - g.plate_t / 2, z], [0, 1, 0], g.plate_t / 2))
    case 'threaded_rod':
      return [{ kind: 'pin', p: [0, 0, 0], dir: [0, 1, 0], half: g.length / 2, d: g.d, thread: th }]
    case 'hex_bolt':
    case 'carriage_bolt':
    case 'eye_bolt':
    case 'wood_screw':
      return [{ kind: 'pin', p: [0, -g.length / 2, 0], dir: [0, 1, 0], half: g.length / 2, seat: 0, d: g.d, thread: th }]
    case 'u_bolt': {
      const x = g.inner / 2 + g.d / 2
      return [-x, x].map((px) => ({ kind: 'pin', p: [px, -g.leg / 2, 0], dir: [0, 1, 0], half: g.leg / 2, d: g.d }))
    }
    case 'hex_nut':
      return [bore(g.m / 2, g.m / 2, g.bore)]
    case 'nylon_nut':
      return [bore(g.h / 2, g.h / 2, g.bore)]
    case 'coupling_nut':
      return [bore(g.length / 2, g.length / 2, g.bore)]
    case 'cap_nut':
      return [bore(g.m / 2, 0, g.bore)]
    case 'wing_nut':
      return [bore(g.m / 2, 0, g.bore)]
    case 'washer':
      return [bore(g.t / 2, g.t / 2, g.d1)]
    case 'spring_washer':
      return [bore(g.t / 2, g.t / 2, g.d1)]
    case 'pipe':
      return [port([0, g.length / 2, 0], [0, 1, 0]), port([0, -g.length / 2, 0], [0, -1, 0])]
    case 'tee': {
      const r = g.a - g.engage
      return [port([r, 0, 0], [1, 0, 0]), port([-r, 0, 0], [-1, 0, 0]), port([0, r, 0], [0, 1, 0])]
    }
    case 'cross': {
      const r = g.a - g.engage
      return [port([r, 0, 0], [1, 0, 0]), port([-r, 0, 0], [-1, 0, 0]), port([0, r, 0], [0, 1, 0]), port([0, -r, 0], [0, -1, 0])]
    }
    case 'elbow': {
      const r = g.a - g.engage
      return [port([r, 0, 0], [1, 0, 0]), port([0, r, 0], [0, 1, 0])]
    }
    case 'elbow45': {
      const r = g.a - g.engage
      return [port([0, -r, 0], [0, -1, 0]), port(DIR45.map((v) => v * r), DIR45)]
    }
    case 'pipe_cap':
      return [port([0, g.engage, 0], [0, -1, 0])]
    case 'reducer':
      return [
        port([0, g.length / 2 - g.engage_big, 0], [0, 1, 0], g.thread_big),
        port([0, -(g.length / 2 - g.engage_small), 0], [0, -1, 0], g.thread_small),
      ]
    case 'flange': {
      const holes = [0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2
        return hole([Math.cos(a) * g.pcd / 2, g.t / 2, Math.sin(a) * g.pcd / 2], [0, 1, 0], g.t / 2)
      })
      return [...holes, port([0, g.t + g.neck_h - g.engage, 0], [0, 1, 0])]
    }
    default:
      return []
  }
}

/** 新增零件時讓它「放在地面上」的 Y 值（mm） */
export function restY(def, params) {
  const g = resolveGeometry(def, params)
  switch (g.type) {
    case 'perforated_bar':
    case 'mending_plate':
    case 't_plate':
    case 'panel':
      return g.thickness / 2
    case 'threaded_rod': return g.length / 2
    case 'hex_bolt':
    case 'carriage_bolt':
    case 'eye_bolt':
    case 'wood_screw':
      return g.length
    case 'u_bolt': return g.leg
    case 'hex_nut': return g.m / 2
    case 'nylon_nut': return g.h / 2
    case 'coupling_nut': return g.length / 2
    case 'washer':
    case 'spring_washer':
      return g.t / 2
    case 'pipe': return g.length / 2
    case 'tee':
    case 'elbow':
      return g.od / 2
    case 'cross':
    case 'elbow45':
      return g.a
    case 'reducer': return g.length / 2
    case 'hinge': return g.kd / 2
    default: return 0 // l_bracket / shelf_bracket / flange / cap_nut / wing_nut / pipe_cap / caster 原點在底面
  }
}

export function bomKey(item) {
  return `${item.partId}|${JSON.stringify(item.params ?? {})}`
}

const PATTERN_LABEL = { none: '無', corners: '四角', rack_2x8: '2×8 排孔' }

/** 採購清單文字：模板中的 {param} 先找參數，再找規格表欄位 */
export function bomLabel(def, params = {}) {
  const p = { ...defaultParams(def), ...params }
  const row = sizeRow(def, p) ?? {}
  const fill = (s) =>
    s?.replace(/\{(\w+)\}/g, (_, k) => (k === 'pattern' ? PATTERN_LABEL[p[k]] ?? p[k] : p[k] ?? row[k] ?? ''))
  return {
    name: fill(def.bom.name),
    spec: fill(def.bom.spec) ?? '',
    standard: def.standard,
    unit: def.bom.unit,
    price: partPrice(def, p),
  }
}
