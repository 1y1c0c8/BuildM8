/**
 * Primitive 幾何生成器：把 Package 的標準參數（mm）轉成 Three.js 幾何（cm）。
 * 每種 geometry.type 只用 Box / Cylinder / Extrude（帶孔 Shape）/ Sphere 組合，
 * 完全不需要外部 3D 模型檔。
 */
import * as THREE from 'three'
import {
  resolveGeometry,
  barHoles,
  panelHoles,
  mendHoles,
  tPlateHoles,
  shelfBracketHoles,
  hingeHoles,
  casterHoles,
  DIR45,
  uPlateHoles,
  CLOCK_DISPLAY_ANGLES,
} from '../data/parts'

export const S = 0.1 // mm → cm
const cache = new Map()

/**
 * group：可動零件的剛體群組（對應 PartDef.joints[].moving，例 'leafB' / 'fork' / 'wheel'）；省略 = 'base'（固定）。
 * @returns {{ geometry: THREE.BufferGeometry, mat: string, group?: string, position?: number[], rotation?: number[] }[]}
 */
export function buildPartMeshes(def, params) {
  const key = `${def.id}|${JSON.stringify(params)}`
  if (cache.has(key)) return cache.get(key)
  const g = resolveGeometry(def, params)
  const out = BUILDERS[g.type]?.(g, def) ?? [{ geometry: new THREE.BoxGeometry(1, 1, 1), mat: 'steel' }]
  cache.set(key, out)
  return out
}

// ---------- helpers ----------
const circle = (r, x = 0, y = 0) => {
  const p = new THREE.Path()
  p.absarc(x, y, r, 0, Math.PI * 2, true)
  return p
}
const hexShape = (s) => {
  const R = s / Math.sqrt(3)
  const sh = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6
    const fn = i === 0 ? 'moveTo' : 'lineTo'
    sh[fn](Math.cos(a) * R, Math.sin(a) * R)
  }
  sh.closePath()
  return sh
}
const roundedRect = (w, h, r) => {
  const sh = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  sh.moveTo(x + r, y)
  sh.lineTo(x + w - r, y)
  sh.quadraticCurveTo(x + w, y, x + w, y + r)
  sh.lineTo(x + w, y + h - r)
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  sh.lineTo(x + r, y + h)
  sh.quadraticCurveTo(x, y + h, x, y + h - r)
  sh.lineTo(x, y + r)
  sh.quadraticCurveTo(x, y, x + r, y)
  return sh
}
/** Shape (XY 平面) 沿 +Y 擠出 depth，並置中於 Y */
const extrudeY = (shape, depth, { bevel = 0, center = true, segments = 24 } = {}) => {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: segments,
  })
  geo.rotateX(-Math.PI / 2) // shape y → -z，擠出方向 → +y
  if (center) geo.translate(0, -depth / 2, 0)
  geo.computeVertexNormals()
  return geo
}
const cyl = (r, h, seg = 32, open = false) => new THREE.CylinderGeometry(r, r, h, seg, 1, open)
const _up = new THREE.Vector3(0, 1, 0)
/** 把沿 +Y 的幾何轉到 dir 方向 */
const orient = (geo, dir) => {
  const q = new THREE.Quaternion().setFromUnitVectors(_up, new THREE.Vector3(...dir).normalize())
  return geo.applyQuaternion(q)
}
/** 從原點沿 dir 伸出長度 len 的圓柱（管件分支） */
const arm = (r, len, dir) => {
  const c = cyl(r, len, 32)
  c.translate(0, len / 2, 0)
  return orient(c, dir)
}
/** 管件端口的補強環（距原點 at） */
const bead = (r, at, dir) => {
  const b = cyl(r * 1.1, 0.35, 32)
  b.translate(0, at - 0.175, 0)
  return orient(b, dir)
}
/** 圓環（外徑 ro、內徑 ri）Shape */
const ringShape = (ro, ri) => {
  const sh = new THREE.Shape()
  sh.absarc(0, 0, ro, 0, Math.PI * 2, false)
  sh.holes.push(circle(ri))
  return sh
}
/** 平放（厚度沿 Y）的板件：shape 的 y 對應世界 −z */
const plateY = (shape, t, opts) => extrudeY(shape, t, { segments: 16, ...opts })

// ---------- builders（輸入 mm，輸出 cm） ----------
const BUILDERS = {
  perforated_bar(g) {
    const L = g.length * S
    const W = g.width * S
    const sh = roundedRect(L, W, W * 0.18)
    barHoles(g).forEach((x) => sh.holes.push(circle((g.hole_d * S) / 2, x * S, 0)))
    return [{ geometry: extrudeY(sh, g.thickness * S, { segments: 16 }), mat: 'zinc' }]
  },

  l_bracket(g) {
    const t = g.thickness * S
    const leg = g.leg * S
    const w = g.width * S
    const hr = (g.hole_d * S) / 2
    const ho = g.hole_offset * S
    // 水平腳：X 方向，佔 y∈[0,t]
    const a = roundedRect(leg, w, w * 0.12)
    a.holes.push(circle(hr, ho - leg / 2, 0))
    const ga = extrudeY(a, t, { center: false, segments: 16 })
    ga.translate(leg / 2, 0, 0)
    // 垂直腳：Y 方向，佔 x∈[0,t]
    const b = roundedRect(leg, w, w * 0.12)
    b.holes.push(circle(hr, ho - leg / 2, 0))
    const gb = extrudeY(b, t, { center: false, segments: 16 })
    gb.translate(leg / 2, 0, 0)
    gb.rotateZ(Math.PI / 2) // (x,y)→(-y,x)：長邊轉為 +Y
    gb.translate(t, 0, 0)
    return [
      { geometry: ga, mat: 'zinc' },
      { geometry: gb, mat: 'zinc' },
    ]
  },

  threaded_rod(g) {
    const geo = cyl((g.d * S) / 2, g.length * S, 24)
    return [{ geometry: geo, mat: 'thread', threadRepeat: g.length / g.pitch }]
  },

  hex_bolt(g) {
    const head = extrudeY(hexShape(g.head_s * S), g.head_k * S, { center: false, bevel: 0.03 })
    const shank = cyl((g.d * S) / 2, g.length * S, 24)
    shank.translate(0, (-g.length * S) / 2, 0)
    return [
      { geometry: head, mat: 'zinc' },
      { geometry: shank, mat: 'thread', threadRepeat: g.length / (g.pitch ?? 1.25) },
    ]
  },

  hex_nut(g) {
    const sh = hexShape(g.s * S)
    sh.holes.push(circle((g.bore * S) / 2))
    return [{ geometry: extrudeY(sh, g.m * S - 0.06, { bevel: 0.03 }), mat: 'zinc' }]
  },

  cap_nut(g) {
    const sh = hexShape(g.s * S)
    sh.holes.push(circle((g.bore * S) / 2))
    const hex = extrudeY(sh, g.m * S, { center: false, bevel: 0.02 })
    const R = (g.s * S) / 2 * 0.92
    const domeH = (g.h - g.m) * S
    const dome = new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    dome.scale(1, domeH / R, 1)
    dome.translate(0, g.m * S, 0)
    return [
      { geometry: hex, mat: 'stainless' },
      { geometry: dome, mat: 'stainless' },
    ]
  },

  washer(g) {
    const sh = new THREE.Shape()
    sh.absarc(0, 0, (g.d2 * S) / 2, 0, Math.PI * 2, false)
    sh.holes.push(circle((g.d1 * S) / 2))
    return [{ geometry: extrudeY(sh, g.t * S, { segments: 32 }), mat: 'zinc' }]
  },

  pipe(g) {
    const sh = new THREE.Shape()
    sh.absarc(0, 0, (g.od * S) / 2, 0, Math.PI * 2, false)
    sh.holes.push(circle(((g.od - 2 * g.wall) * S) / 2))
    const geo = extrudeY(sh, g.length * S, { segments: 32 })
    return [{ geometry: geo, mat: 'galvanized' }]
  },

  tee(g) {
    const r = (g.od * S) / 2
    const a = g.a * S
    const run = cyl(r, a * 2, 32)
    run.rotateZ(Math.PI / 2)
    const branch = cyl(r, a, 32)
    branch.translate(0, a / 2, 0)
    return [
      { geometry: run, mat: 'galvanized' },
      { geometry: branch, mat: 'galvanized' },
      ...beads(r, [
        [a, 0, 0, 'x'],
        [-a, 0, 0, 'x'],
        [0, a, 0, 'y'],
      ]),
    ]
  },

  elbow(g) {
    const r = (g.od * S) / 2
    const a = g.a * S
    const x = cyl(r, a, 32)
    x.rotateZ(Math.PI / 2)
    x.translate(a / 2, 0, 0)
    const y = cyl(r, a, 32)
    y.translate(0, a / 2, 0)
    const joint = new THREE.SphereGeometry(r, 32, 16)
    return [
      { geometry: x, mat: 'galvanized' },
      { geometry: y, mat: 'galvanized' },
      { geometry: joint, mat: 'galvanized' },
      ...beads(r, [
        [a, 0, 0, 'x'],
        [0, a, 0, 'y'],
      ]),
    ]
  },

  flange(g) {
    const sh = new THREE.Shape()
    sh.absarc(0, 0, (g.d * S) / 2, 0, Math.PI * 2, false)
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i * Math.PI) / 2
      // shape y → -z，所以這裡用 -sin 讓孔位與錨點一致
      sh.holes.push(circle((g.hole_d * S) / 2, (Math.cos(ang) * g.pcd * S) / 2, (-Math.sin(ang) * g.pcd * S) / 2))
    }
    const disc = extrudeY(sh, g.t * S, { center: false, bevel: 0.05, segments: 40 })
    const neck = cyl((g.neck_d * S) / 2, g.neck_h * S, 32)
    neck.translate(0, (g.t + g.neck_h / 2) * S, 0)
    const socket = cyl((g.neck_d * S) / 2 * 0.72, 0.02, 32)
    socket.translate(0, (g.t + g.neck_h) * S + 0.011, 0)
    return [
      { geometry: disc, mat: 'galvanized' },
      { geometry: neck, mat: 'galvanized' },
      { geometry: socket, mat: 'hole' },
    ]
  },

  panel(g) {
    const sh = roundedRect(g.width * S, g.depth * S, 0.3)
    // shape y → 世界 -z，因此孔的 z 取負號
    panelHoles(g).forEach(([x, z]) => sh.holes.push(circle((g.hole_d * S) / 2, x * S, -z * S)))
    return [{ geometry: extrudeY(sh, g.thickness * S, { segments: 20 }), mat: 'plywood' }]
  },

  // ───────────── v1.2 新增零件 ─────────────
  /** U 型折板：原點在底板外面中心；底板 y∈[0,t]，兩腳在 ±X 往 +Y 立起（外緣高 length+t），板條寬 depth 沿 Z */
  u_folded_plate(g) {
    const W = g.width * S
    const H = g.length * S
    const D = g.depth * S
    const t = g.thickness * S
    const { base, leg } = uPlateHoles(g)
    const bs = new THREE.Shape()
    bs.moveTo(-W / 2 - t, -D / 2)
    bs.lineTo(W / 2 + t, -D / 2)
    bs.lineTo(W / 2 + t, D / 2)
    bs.lineTo(-W / 2 - t, D / 2)
    bs.closePath()
    // shape y → 世界 −z
    base.forEach(([x, z], i) => bs.holes.push(circle(((i === 0 ? g.hole_center : g.hole_d) * S) / 2, x * S, -z * S)))
    const plate = extrudeY(bs, t, { center: false, segments: 24 })
    const legGeo = (sx) => {
      // 先在 XY 平面畫腳（shape x = 世界高度 y，shape y = −z），擠出厚度後繞 Z 轉 90° 立起
      const ls = new THREE.Shape()
      ls.moveTo(t, -D / 2)
      ls.lineTo(H + t, -D / 2)
      ls.lineTo(H + t, D / 2)
      ls.lineTo(t, D / 2)
      ls.closePath()
      leg.forEach(([y, z]) => ls.holes.push(circle((g.hole_d * S) / 2, y * S, -z * S)))
      const geo = extrudeY(ls, t, { center: false, segments: 16 })
      geo.rotateZ(Math.PI / 2) // (x,y)→(−y,x)：厚度落在 x∈[−t,0]，高度沿 +Y
      geo.translate(sx > 0 ? W / 2 + t : -W / 2, 0, 0)
      return geo
    }
    return [
      { geometry: plate, mat: 'zinc' },
      { geometry: legGeo(1), mat: 'zinc' },
      { geometry: legGeo(-1), mat: 'zinc' },
    ]
  },

  /**
   * 時鐘機芯：原點在機身正面中心（貼面板背面處），螺牙軸 / 指針朝 +Y，機身在 y∈[−box_h, 0]。
   * 12 點方向 = 局部 −Z、3 點 = +X。華司 + 黃銅螺帽鎖在 y = thickness（面板厚）處，指針顯示 10:09:30。
   */
  clock_movement(g) {
    const B = g.box * S
    const bh = g.box_h * S
    const L = g.length * S
    const thk = g.thickness * S
    const body = extrudeY(roundedRect(B, B, 0.3), bh, { center: false, segments: 8 })
    body.translate(0, -bh, 0)
    const battery = cyl(0.72, 5.05, 24)
    battery.rotateZ(Math.PI / 2)
    battery.translate(0, -bh + 0.52, B * 0.12) // 3 號電池半埋在背面，凸出約 2mm
    const bay = new THREE.BoxGeometry(5.3, 0.04, 1.6)
    bay.translate(0, -bh - 0.02, B * 0.12)
    const knob = cyl(0.6, 0.2, 24)
    knob.translate(B * 0.22, -bh - 0.1, -B * 0.22)
    const hook = new THREE.BoxGeometry(1.2, 0.08, 0.8)
    hook.translate(0, -bh - 0.04, -B * 0.4)
    const shaft = cyl((g.shaft_d * S) / 2, L, 24)
    shaft.translate(0, L / 2, 0)
    const washer = extrudeY(ringShape(0.6, 0.385), 0.06, { center: false, segments: 32 })
    washer.translate(0, thk, 0)
    const nutShape = hexShape(1.0)
    nutShape.holes.push(circle((g.shaft_d * S) / 2))
    const nut = extrudeY(nutShape, 0.22, { center: false, bevel: 0.015 })
    nut.translate(0, thk + 0.06 + 0.015, 0)
    const top = Math.max(L, thk + 0.3)
    const yH = top + 0.1
    const yM = top + 0.24
    const yS = top + 0.38
    const tube = (r, y0, y1) => {
      const c = cyl(r, y1 - y0, 20)
      c.translate(0, (y0 + y1) / 2, 0)
      return c
    }
    // 指針：梯形板，shape y = 長度方向（→ 局部 −Z = 12 點），再繞 Y 轉到該時刻角度
    const hand = (len, w, tail, y, ang, th = 0.05) => {
      const sh = new THREE.Shape()
      sh.moveTo(-w / 2, -tail)
      sh.lineTo(w / 2, -tail)
      sh.lineTo(w * 0.22, len)
      sh.lineTo(-w * 0.22, len)
      sh.closePath()
      const geo = extrudeY(sh, th, { center: false, segments: 4 })
      geo.rotateY(-ang)
      geo.translate(0, y, 0)
      return geo
    }
    const hub = (r, y, th = 0.05) => {
      const c = cyl(r, th, 24)
      c.translate(0, y + th / 2, 0)
      return c
    }
    const A = CLOCK_DISPLAY_ANGLES
    return [
      { geometry: body, mat: 'plastic' },
      { geometry: bay, mat: 'hole' },
      { geometry: battery, mat: 'stainless' },
      { geometry: knob, mat: 'plastic' },
      { geometry: hook, mat: 'steel' },
      { geometry: shaft, mat: 'thread', threadRepeat: g.length / 0.5 },
      { geometry: washer, mat: 'brass' },
      { geometry: nut, mat: 'brass' },
      { geometry: tube(0.26, L - 0.01, yH), mat: 'brass' },
      { geometry: tube(0.18, yH, yM), mat: 'brass' },
      { geometry: tube(0.06, yM, yS + 0.1), mat: 'brass' },
      { geometry: hand(g.hand_h * S, 0.5, 0.3, yH, A.hour), mat: 'hand' },
      { geometry: hub(0.42, yH), mat: 'hand' },
      { geometry: hand(g.hand_m * S, 0.38, 0.3, yM, A.minute), mat: 'hand' },
      { geometry: hub(0.34, yM), mat: 'hand' },
      { geometry: hand(g.hand_s * S, 0.12, g.hand_s * S * 0.22, yS, A.second, 0.03), mat: 'red' },
      { geometry: hub(0.2, yS, 0.08), mat: 'red' },
    ]
  },

  // ───────────── v1.1 新增零件 ─────────────
  mending_plate(g) {
    const sh = roundedRect(g.length * S, g.width * S, g.width * S * 0.25)
    mendHoles(g).forEach((x) => sh.holes.push(circle((g.hole_d * S) / 2, x * S, 0)))
    return [{ geometry: plateY(sh, g.thickness * S), mat: 'zinc' }]
  },

  t_plate(g) {
    const L = (g.length * S) / 2
    const w = (g.width * S) / 2
    const st = g.stem * S
    const sh = new THREE.Shape()
    // 直桿往世界 +Z → shape 的 −y
    sh.moveTo(-L, w)
    sh.lineTo(L, w)
    sh.lineTo(L, -w)
    sh.lineTo(w, -w)
    sh.lineTo(w, -st)
    sh.lineTo(-w, -st)
    sh.lineTo(-w, -w)
    sh.lineTo(-L, -w)
    sh.closePath()
    tPlateHoles(g).forEach(([x, z]) => sh.holes.push(circle((g.hole_d * S) / 2, x * S, -z * S)))
    return [{ geometry: plateY(sh, g.thickness * S), mat: 'zinc' }]
  },

  shelf_bracket(g) {
    const t = g.thickness * S
    const w = g.width * S
    const a = g.a * S
    const b = g.b * S
    const hr = (g.hole_d * S) / 2
    const { h, v } = shelfBracketHoles(g)
    const ha = roundedRect(a, w, w * 0.15)
    h.forEach((x) => ha.holes.push(circle(hr, x * S - a / 2, 0)))
    const ga = extrudeY(ha, t, { center: false, segments: 16 })
    ga.translate(a / 2, 0, 0)
    const hb = roundedRect(b, w, w * 0.15)
    v.forEach((y) => hb.holes.push(circle(hr, y * S - b / 2, 0)))
    const gb = extrudeY(hb, t, { center: false, segments: 16 })
    gb.translate(b / 2, 0, 0)
    gb.rotateZ(Math.PI / 2)
    gb.translate(t, 0, 0)
    // 斜撐：兩端貼在兩腳內側
    const p1 = new THREE.Vector2(a * 0.64, t)
    const p2 = new THREE.Vector2(t, b * 0.64)
    const len = p1.distanceTo(p2)
    const strut = new THREE.BoxGeometry(len, t, w * 0.55)
    strut.rotateZ(Math.atan2(p2.y - p1.y, p2.x - p1.x))
    strut.translate((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 0)
    return [
      { geometry: ga, mat: 'zinc' },
      { geometry: gb, mat: 'zinc' },
      { geometry: strut, mat: 'zinc' },
    ]
  },

  wing_nut(g) {
    const m = g.m * S
    const h = g.h * S
    const rb = (g.dk * S) / 2
    const rt = rb * 0.82
    const e = (g.e * S) / 2
    const wt = g.wt * S
    const boss = new THREE.CylinderGeometry(rt, rb, m, 32)
    boss.translate(0, m / 2, 0)
    const hole = cyl((g.bore * S) / 2, 0.01, 24)
    hole.translate(0, m + 0.006, 0)
    const wing = (sx) => {
      const r0 = rt * 0.55
      const sh = new THREE.Shape()
      sh.moveTo(sx * r0, m * 0.1)
      sh.lineTo(sx * r0, m * 0.95)
      sh.quadraticCurveTo(sx * e * 0.5, h * 1.02, sx * e * 0.9, h)
      sh.quadraticCurveTo(sx * e * 1.05, h * 0.97, sx * e, h * 0.78)
      sh.quadraticCurveTo(sx * e * 0.8, m * 0.3, sx * r0, m * 0.1)
      const geo = new THREE.ExtrudeGeometry(sh, { depth: wt, bevelEnabled: false, curveSegments: 16 })
      geo.translate(0, 0, -wt / 2)
      geo.computeVertexNormals()
      return geo
    }
    return [
      { geometry: boss, mat: 'zinc' },
      { geometry: wing(1), mat: 'zinc' },
      { geometry: wing(-1), mat: 'zinc' },
      { geometry: hole, mat: 'hole' },
    ]
  },

  nylon_nut(g) {
    const h = g.h * S
    const m = g.m * S
    const sh = hexShape(g.s * S)
    sh.holes.push(circle((g.bore * S) / 2))
    const hex = extrudeY(sh, m - 0.04, { center: false, bevel: 0.02 })
    hex.translate(0, -h / 2 + 0.02, 0)
    const rc = ((g.s * S) / 2) * 0.9
    const collar = new THREE.CylinderGeometry(rc * 0.94, rc, h - m, 32)
    collar.translate(0, -h / 2 + m + (h - m) / 2, 0)
    const ring = extrudeY(ringShape(rc * 0.78, (g.bore * S) / 2), 0.01, { center: false, segments: 32 })
    ring.translate(0, h / 2, 0)
    const hole = cyl((g.bore * S) / 2, 0.01, 24)
    hole.translate(0, h / 2 + 0.004, 0)
    return [
      { geometry: hex, mat: 'zinc' },
      { geometry: collar, mat: 'zinc' },
      { geometry: ring, mat: 'nylon' },
      { geometry: hole, mat: 'hole' },
    ]
  },

  coupling_nut(g) {
    const sh = hexShape(g.s * S)
    sh.holes.push(circle((g.bore * S) / 2))
    return [{ geometry: extrudeY(sh, g.length * S - 0.06, { bevel: 0.03 }), mat: 'zinc' }]
  },

  spring_washer(g) {
    const ro = (g.d2 * S) / 2
    const ri = (g.d1 * S) / 2
    const t = g.t * S
    const gap = Math.min(0.5, (t / ro) * 0.9) // 開口角度（rad）
    const sh = new THREE.Shape()
    sh.absarc(0, 0, ro, gap / 2, Math.PI * 2 - gap / 2, false)
    sh.absarc(0, 0, ri, Math.PI * 2 - gap / 2, gap / 2, true)
    sh.closePath()
    const geo = extrudeY(sh, t, { segments: 48 })
    // 螺旋錯位：沿圓周把 y 抬高，開口兩端上下錯開
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      let ang = Math.atan2(-pos.getZ(i), pos.getX(i))
      if (ang < 0) ang += Math.PI * 2
      pos.setY(i, pos.getY(i) + (ang / (Math.PI * 2) - 0.5) * t * 0.7)
    }
    geo.computeVertexNormals()
    return [{ geometry: geo, mat: 'zinc' }]
  },

  eye_bolt(g) {
    const R = ((g.ring_id + g.wire) / 2) * S
    const tube = (g.wire * S) / 2
    const ch = g.collar_h * S
    const ring = new THREE.TorusGeometry(R, tube, 16, 48)
    ring.translate(0, ch + R + tube * 0.4, 0)
    const collar = new THREE.CylinderGeometry(((g.collar_d * S) / 2) * 0.8, (g.collar_d * S) / 2, ch, 32)
    collar.translate(0, ch / 2, 0)
    const shank = cyl((g.d * S) / 2, g.length * S, 24)
    shank.translate(0, (-g.length * S) / 2, 0)
    return [
      { geometry: ring, mat: 'zinc' },
      { geometry: collar, mat: 'zinc' },
      { geometry: shank, mat: 'thread', threadRepeat: g.length / 1.25 },
    ]
  },

  wood_screw(g) {
    const d = g.d * S
    const dk = g.dk * S
    const k = (dk - d) / 2 // 90° 沉頭
    const L = g.length * S
    const tip = Math.min(d * 1.6, L * 0.3)
    const head = new THREE.CylinderGeometry(dk / 2, d / 2, k, 32)
    head.translate(0, -k / 2, 0)
    const c1 = new THREE.BoxGeometry(dk * 0.6, 0.012, d * 0.22)
    const c2 = new THREE.BoxGeometry(d * 0.22, 0.012, dk * 0.6)
    c1.translate(0, 0.004, 0)
    c2.translate(0, 0.004, 0)
    const shankLen = L - k - tip
    const shank = cyl(d / 2, shankLen, 20)
    shank.translate(0, -k - shankLen / 2, 0)
    const point = new THREE.CylinderGeometry(d / 2, 0.01, tip, 20)
    point.translate(0, -L + tip / 2, 0)
    return [
      { geometry: head, mat: 'zinc' },
      { geometry: c1, mat: 'hole' },
      { geometry: c2, mat: 'hole' },
      { geometry: shank, mat: 'thread', threadRepeat: g.length / (g.d * 0.45) },
      { geometry: point, mat: 'thread', threadRepeat: tip / S / (g.d * 0.45) },
    ]
  },

  carriage_bolt(g) {
    const r = (g.dk * S) / 2
    const k = g.k * S
    const Rs = (r * r + k * k) / (2 * k)
    const dome = new THREE.SphereGeometry(Rs, 40, 12, 0, Math.PI * 2, 0, Math.asin(Math.min(1, r / Rs)))
    dome.translate(0, k - Rs, 0)
    const under = cyl(r, 0.01, 40)
    under.translate(0, 0.005, 0)
    const f = g.f * S
    const fh = g.fh * S
    const neck = new THREE.BoxGeometry(f, fh, f)
    neck.translate(0, -fh / 2, 0)
    const sl = (g.length - g.fh) * S
    const shank = cyl((g.d * S) / 2, sl, 24)
    shank.translate(0, -fh - sl / 2, 0)
    return [
      { geometry: dome, mat: 'zinc' },
      { geometry: under, mat: 'zinc' },
      { geometry: neck, mat: 'zinc' },
      { geometry: shank, mat: 'thread', threadRepeat: (g.length - g.fh) / (g.pitch ?? 1.25) },
    ]
  },

  u_bolt(g) {
    const rr = (g.d * S) / 2
    const R = (g.inner * S) / 2 + rr
    const leg = g.leg * S
    const arch = new THREE.TorusGeometry(R, rr, 12, 40, Math.PI)
    const legs = [-R, R].map((x) => {
      const c = cyl(rr, leg, 20)
      c.translate(x, -leg / 2, 0)
      return { geometry: c, mat: 'thread', threadRepeat: g.leg }
    })
    return [{ geometry: arch, mat: 'zinc' }, ...legs]
  },

  cross(g) {
    const r = (g.od * S) / 2
    const a = g.a * S
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]
    return [
      ...dirs.map((d) => ({ geometry: arm(r, a, d), mat: 'galvanized' })),
      ...dirs.map((d) => ({ geometry: bead(r, a, d), mat: 'galvanized' })),
    ]
  },

  elbow45(g) {
    const r = (g.od * S) / 2
    const a = g.a * S
    const dirs = [[0, -1, 0], DIR45]
    return [
      ...dirs.map((d) => ({ geometry: arm(r, a, d), mat: 'galvanized' })),
      { geometry: new THREE.SphereGeometry(r, 32, 16), mat: 'galvanized' },
      ...dirs.map((d) => ({ geometry: bead(r, a, d), mat: 'galvanized' })),
    ]
  },

  pipe_cap(g) {
    const r = (g.od * S) / 2
    const h = g.h * S
    const top = Math.min(r * 0.35, h * 0.25)
    const body = cyl(r, h - top, 32)
    body.translate(0, (h - top) / 2, 0)
    const dome = new THREE.SphereGeometry(r, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    dome.scale(1, top / r, 1)
    dome.translate(0, h - top, 0)
    const ring = cyl(r * 1.1, 0.35, 32)
    ring.translate(0, 0.175, 0)
    const mouth = cyl(r * 0.78, 0.01, 32)
    mouth.translate(0, -0.006, 0)
    return [
      { geometry: body, mat: 'galvanized' },
      { geometry: dome, mat: 'galvanized' },
      { geometry: ring, mat: 'galvanized' },
      { geometry: mouth, mat: 'hole' },
    ]
  },

  reducer(g) {
    const rb = (g.od_big * S) / 2
    const rs = (g.od_small * S) / 2
    const L = g.length * S
    const lb = (g.engage_big + 3) * S
    const ls = (g.engage_small + 3) * S
    const mid = Math.max(0.1, L - lb - ls)
    const big = cyl(rb, lb, 32)
    big.translate(0, L / 2 - lb / 2, 0)
    const small = cyl(rs, ls, 32)
    small.translate(0, -L / 2 + ls / 2, 0)
    const cone = new THREE.CylinderGeometry(rb, rs, mid, 32)
    cone.translate(0, L / 2 - lb - mid / 2, 0)
    return [
      { geometry: big, mat: 'galvanized' },
      { geometry: cone, mat: 'galvanized' },
      { geometry: small, mat: 'galvanized' },
      { geometry: bead(rb, L / 2, [0, 1, 0]), mat: 'galvanized' },
      { geometry: bead(rs, L / 2, [0, -1, 0]), mat: 'galvanized' },
    ]
  },

  hinge(g) {
    const L = g.length * S
    const t = g.thickness * S
    const kr = (g.kd * S) / 2
    const x0 = kr * 0.5
    const x1 = g.leaf * S
    const wl = x1 - x0
    const holes = hingeHoles(g)
    const leaf = (sx) => {
      const cx = (sx * (x0 + x1)) / 2
      const sh = roundedRect(wl, L, Math.min(0.15, wl * 0.15))
      holes
        .filter(([x]) => Math.sign(x) === sx)
        .forEach(([x, z]) => sh.holes.push(circle((g.hole_d * S) / 2, x * S - cx, -z * S)))
      const geo = extrudeY(sh, t, { center: false, segments: 16 })
      geo.translate(cx, -kr, 0)
      return { geometry: geo, mat: 'stainless', ...(sx > 0 ? { group: 'leafB' } : {}) }
    }
    const nK = 5
    const gap = 0.03
    const kl = (L - gap * (nK - 1)) / nK
    const knuckles = Array.from({ length: nK }, (_, i) => {
      const c = cyl(kr, kl, 24)
      c.rotateX(Math.PI / 2)
      c.translate(0, 0, -L / 2 + kl / 2 + i * (kl + gap))
      return { geometry: c, mat: 'stainless', ...(i % 2 ? { group: 'leafB' } : {}) } // 指節交錯屬於兩片葉片
    })
    const pins = [-1, 1].map((s) => {
      const p = cyl(kr * 0.55, 0.08, 16)
      p.rotateX(Math.PI / 2)
      p.translate(0, 0, s * (L / 2 + 0.04))
      return { geometry: p, mat: 'steel' }
    })
    return [leaf(1), leaf(-1), ...knuckles, ...pins]
  },

  caster(g) {
    const D = g.wheel_d * S
    const W = g.wheel_w * S
    const P = g.plate * S
    const pt = g.plate_t * S
    const H = g.height * S
    const lead = D * 0.22 // 輪軸偏心（自動轉向）
    const tf = 0.2
    const sh = Math.max(0.4, H * 0.08)
    const yb = H - pt - sh - tf // 叉架橫樑底
    const wheel = new THREE.CylinderGeometry(D / 2, D / 2, W, 40)
    wheel.rotateZ(Math.PI / 2)
    wheel.translate(0, D / 2, -lead)
    const hub = cyl(D * 0.3, W + 0.1, 32)
    hub.rotateZ(Math.PI / 2)
    hub.translate(0, D / 2, -lead)
    const axle = cyl(D * 0.06, W + 2 * tf + 0.5, 16)
    axle.rotateZ(Math.PI / 2)
    axle.translate(0, D / 2, -lead)
    // 輪轂兩側的肋條：讓輪子滾動時看得出轉動
    const ribs = [-1, 1].flatMap((s) =>
      [0, 1, 2].map((k) => {
        const r = new THREE.BoxGeometry(0.04, D * 0.56, Math.max(0.12, D * 0.07))
        r.rotateX((k * Math.PI) / 3)
        r.translate(s * (W / 2 + 0.07), D / 2, -lead)
        return { geometry: r, mat: 'steel', group: 'wheel' }
      }),
    )
    const fy0 = D / 2 - D * 0.12
    const fz0 = -lead - D * 0.18
    const fz1 = D * 0.18
    const forks = [-1, 1].map((s) => {
      const b = new THREE.BoxGeometry(tf, yb + tf - fy0, fz1 - fz0)
      b.translate(s * (W / 2 + 0.1 + tf / 2), (fy0 + yb + tf) / 2, (fz0 + fz1) / 2)
      return { geometry: b, mat: 'zinc', group: 'fork' }
    })
    const bridge = new THREE.BoxGeometry(W + 0.2 + 2 * tf, tf, fz1 - fz0)
    bridge.translate(0, yb + tf / 2, (fz0 + fz1) / 2)
    const swivel = new THREE.CylinderGeometry(P * 0.3, P * 0.36, sh, 32)
    swivel.translate(0, yb + tf + sh / 2, 0)
    const ps = roundedRect(P, P, 0.3)
    casterHoles(g).forEach(([x, z]) => ps.holes.push(circle((g.hole_d * S) / 2, x * S, -z * S)))
    const plate = extrudeY(ps, pt, { center: false, segments: 16 })
    plate.translate(0, H - pt, 0)
    return [
      { geometry: wheel, mat: 'rubber', group: 'wheel' },
      { geometry: hub, mat: 'zinc', group: 'wheel' },
      ...ribs,
      { geometry: axle, mat: 'steel', group: 'fork' },
      ...forks,
      { geometry: bridge, mat: 'zinc', group: 'fork' },
      { geometry: swivel, mat: 'zinc' },
      { geometry: plate, mat: 'zinc' },
    ]
  },
}

function beads(r, list) {
  return list.map(([x, y, z, axis]) => {
    const b = cyl(r * 1.1, 0.35, 32)
    if (axis === 'x') b.rotateZ(Math.PI / 2)
    const off = 0.175
    b.translate(x - (axis === 'x' ? Math.sign(x) * off : 0), y - (axis === 'y' ? off : 0), z)
    return { geometry: b, mat: 'galvanized' }
  })
}
