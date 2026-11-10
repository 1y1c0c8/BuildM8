/**
 * Primitive 幾何生成器：把 Package 的標準參數（mm）轉成 Three.js 幾何（cm）。
 * 每種 geometry.type 只用 Box / Cylinder / Extrude（帶孔 Shape）/ Sphere 組合，
 * 完全不需要外部 3D 模型檔。
 */
import * as THREE from 'three'
import { resolveGeometry, barHoles, panelHoles } from '../data/parts'

export const S = 0.1 // mm → cm
const cache = new Map()

/** @returns {{ geometry: THREE.BufferGeometry, mat: string, position?: number[], rotation?: number[] }[]} */
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
      { geometry: shank, mat: 'thread', threadRepeat: g.length / 1.25 },
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
