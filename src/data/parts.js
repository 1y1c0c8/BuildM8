/**
 * 零件工具函式：參數解析、錨點（孔洞 / 軸 / 管口）、BOM 文字。
 * 所有數值皆為 mm，局部座標系 Y 軸朝上。
 */

export const defaultParams = (def) =>
  Object.fromEntries(Object.entries(def.params ?? {}).map(([k, p]) => [k, p.default]))

/** 把 AI / 使用者給的參數修正為合法值：不可裁切 → 貼齊最近的現貨規格 */
export function normalizeParams(def, raw = {}) {
  const out = defaultParams(def)
  for (const [key, spec] of Object.entries(def.params ?? {})) {
    const v = raw?.[key]
    if (v === undefined || v === null || v === '') continue
    if (typeof spec.default === 'string') {
      if (spec.options.includes(v)) out[key] = v
      continue
    }
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (spec.custom) out[key] = Math.min(spec.max ?? n, Math.max(spec.min ?? n, Math.round(n)))
    else out[key] = spec.options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))
  }
  return out
}

/** 將 geometry 中的 '$param' 換成實際值 */
export function resolveGeometry(def, params) {
  const g = {}
  for (const [k, v] of Object.entries(def.geometry)) {
    g[k] = typeof v === 'string' && v.startsWith('$') ? params[v.slice(1)] : v
  }
  return g
}

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

/**
 * 錨點定義（局部座標，mm）
 *  - hole : 本零件上的孔，螺條 / 螺栓 / 螺帽可吸附
 *  - pin  : 本零件是「軸」（螺條、螺栓）→ 會吸進孔；螺帽也可套在它上面
 *  - bore : 本零件是「套件」（螺帽、華司）→ 會套到孔或軸上
 *  - port : 管口（水管 / 管件），管口對管口接合
 * @returns {{kind:'hole'|'pin'|'bore'|'port', p:number[], dir:number[], half?:number, seat?:number}[]}
 */
export function getAnchors(def, params) {
  const g = resolveGeometry(def, params)
  switch (g.type) {
    case 'perforated_bar':
      return barHoles(g).map((x) => ({ kind: 'hole', p: [x, 0, 0], dir: [0, 1, 0], half: g.thickness / 2 }))
    case 'l_bracket':
      return [
        { kind: 'hole', p: [g.hole_offset, g.thickness / 2, 0], dir: [0, 1, 0], half: g.thickness / 2 },
        { kind: 'hole', p: [g.thickness / 2, g.hole_offset, 0], dir: [1, 0, 0], half: g.thickness / 2 },
      ]
    case 'panel':
      return panelHoles(g).map(([x, z]) => ({ kind: 'hole', p: [x, 0, z], dir: [0, 1, 0], half: g.thickness / 2 }))
    case 'threaded_rod':
      return [{ kind: 'pin', p: [0, 0, 0], dir: [0, 1, 0], half: g.length / 2 }]
    case 'hex_bolt':
      return [{ kind: 'pin', p: [0, -g.length / 2, 0], dir: [0, 1, 0], half: g.length / 2, seat: 0 }]
    case 'hex_nut':
      return [{ kind: 'bore', p: [0, 0, 0], dir: [0, 1, 0], half: g.m / 2, seat: g.m / 2 }]
    case 'cap_nut':
      return [{ kind: 'bore', p: [0, 0, 0], dir: [0, 1, 0], half: g.m / 2, seat: 0 }]
    case 'washer':
      return [{ kind: 'bore', p: [0, 0, 0], dir: [0, 1, 0], half: g.t / 2, seat: g.t / 2 }]
    case 'pipe':
      return [
        { kind: 'port', p: [0, g.length / 2, 0], dir: [0, 1, 0] },
        { kind: 'port', p: [0, -g.length / 2, 0], dir: [0, -1, 0] },
      ]
    case 'tee': {
      const r = g.a - g.engage
      return [
        { kind: 'port', p: [r, 0, 0], dir: [1, 0, 0] },
        { kind: 'port', p: [-r, 0, 0], dir: [-1, 0, 0] },
        { kind: 'port', p: [0, r, 0], dir: [0, 1, 0] },
      ]
    }
    case 'elbow': {
      const r = g.a - g.engage
      return [
        { kind: 'port', p: [r, 0, 0], dir: [1, 0, 0] },
        { kind: 'port', p: [0, r, 0], dir: [0, 1, 0] },
      ]
    }
    case 'flange': {
      const holes = [0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2
        return { kind: 'hole', p: [Math.cos(a) * g.pcd / 2, g.t / 2, Math.sin(a) * g.pcd / 2], dir: [0, 1, 0], half: g.t / 2 }
      })
      return [...holes, { kind: 'port', p: [0, g.t + g.neck_h - g.engage, 0], dir: [0, 1, 0] }]
    }
    default:
      return []
  }
}

/** 新增零件時讓它「放在地面上」的 Y 值（mm） */
export function restY(def, params) {
  const g = resolveGeometry(def, params)
  switch (g.type) {
    case 'perforated_bar': return g.thickness / 2
    case 'panel': return g.thickness / 2
    case 'threaded_rod': return g.length / 2
    case 'hex_bolt': return g.length
    case 'hex_nut': return g.m / 2
    case 'washer': return g.t / 2
    case 'pipe': return g.length / 2
    case 'tee': return g.od / 2
    case 'elbow': return g.od / 2
    default: return 0 // l_bracket / flange / cap_nut 原點在底面
  }
}

export function bomKey(item) {
  return `${item.partId}|${JSON.stringify(item.params ?? {})}`
}

const PATTERN_LABEL = { none: '無', corners: '四角', rack_2x8: '2×8 排孔' }

export function bomLabel(def, params) {
  const fill = (s) =>
    s?.replace(/\{(\w+)\}/g, (_, k) => (k === 'pattern' ? PATTERN_LABEL[params[k]] ?? params[k] : params[k]))
  return { name: fill(def.bom.name), spec: fill(def.bom.spec) ?? '', standard: def.standard, unit: def.bom.unit }
}
