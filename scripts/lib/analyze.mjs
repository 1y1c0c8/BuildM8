/**
 * BuildM8 設計檢查核心：組合矩陣（buildm8.assembly/v1）→ 規格驗證 + 幾何 / 結構檢查 + BOM。
 *
 * 用法：
 *   const ctx = await loadSrc()
 *   const report = analyzeAssembly(rawAssembly, ctx)
 *
 * 幾何方法：
 *   - 每個零件用網站同一套 buildPartMeshes() 產生幾何，每個子網格取局部包圍盒 → 轉成世界座標的
 *     有向包圍盒（OBB，mm）。L 角鐵、三通、彎頭等由多個子網格組成，所以不會被一個大盒子誤判。
 *   - 兩個 OBB 用分離軸定理（SAT）算「最小重疊量」：> 0 代表互相穿透多少 mm，< 0 代表至少分開多少 mm。
 *   - 「預期的穿插」用錨點（getAnchors）判斷後排除：螺條 / 螺栓穿過孔、螺帽 / 華司套在螺條上、
 *     水管旋入管件、U 型管束夾住水管。
 */
import * as THREE from 'three'

/** 容許誤差（mm）。參考設計（builders.js / mock）都以這組數值通過。 */
export const TOL = {
  contact: 0.8, // 兩零件間隙 ≤ 此值視為接觸
  ground: 1.0, // 零件最低點 ≤ 此值視為落地
  belowGround: 1.0, // 零件最低點 < -此值視為陷入地面
  penetration: 0.5, // 互相穿透 > 此值才報錯
  axisLateral: 0.8, // 孔 / 螺帽中心距螺條軸線 ≤ 此值視為「同軸」
  axisAlign: 0.95, // 兩軸方向 |cos| ≥ 此值視為平行
  portDist: 2.0, // 兩管口中心距 ≤ 此值視為接合
  holeFit: 0.6, // 螺條直徑可比孔徑大多少（與網站磁吸相同）
  drillFootprint: 1.6, // 穿過合板的零件，在板面上的投影 ≤ 直徑 × 此倍數 → 視為「鑽孔穿過」
}

const DEG = Math.PI / 180
const PIN_TYPES = new Set(['threaded_rod', 'hex_bolt', 'carriage_bolt', 'eye_bolt', 'wood_screw', 'u_bolt'])
const NUT_TYPES = new Set(['hex_nut', 'nylon_nut', 'wing_nut', 'cap_nut', 'coupling_nut'])
const CLAMP_TYPES = new Set(['hex_nut', 'nylon_nut', 'wing_nut', 'washer', 'spring_washer'])
const WASHER_TYPES = new Set(['washer', 'spring_washer'])
const DRILLABLE_TYPES = new Set(['panel'])

const r1 = (v) => Math.round(v * 10) / 10
const cleanNulls = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ''))
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

// ---------------------------------------------------------------------------
// OBB + SAT
// ---------------------------------------------------------------------------

function makeObb(box, matrix) {
  const c = box.getCenter(new THREE.Vector3()).applyMatrix4(matrix)
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(0.5)
  const ax = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  matrix.extractBasis(ax[0], ax[1], ax[2])
  const half = [size.x * ax[0].length(), size.y * ax[1].length(), size.z * ax[2].length()]
  ax.forEach((a) => a.normalize())
  return { c, ax, half }
}

const projRadius = (o, L) => o.half[0] * Math.abs(o.ax[0].dot(L)) + o.half[1] * Math.abs(o.ax[1].dot(L)) + o.half[2] * Math.abs(o.ax[2].dot(L))

/** SAT：回傳最小重疊量（mm）。> 0 = 穿透深度；< 0 = 分開距離（下界） */
function obbOverlap(A, B) {
  const d = new THREE.Vector3().subVectors(B.c, A.c)
  const axes = [...A.ax, ...B.ax]
  for (const a of A.ax) {
    for (const b of B.ax) {
      const x = new THREE.Vector3().crossVectors(a, b)
      if (x.lengthSq() > 1e-6) axes.push(x.normalize())
    }
  }
  let min = Infinity
  for (const L of axes) {
    const o = projRadius(A, L) + projRadius(B, L) - Math.abs(d.dot(L))
    if (o < min) min = o
  }
  return min
}

function obbCorners(o) {
  const out = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(
      o.c.clone()
        .addScaledVector(o.ax[0], sx * o.half[0])
        .addScaledVector(o.ax[1], sy * o.half[1])
        .addScaledVector(o.ax[2], sz * o.half[2]),
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// 錨點幾何
// ---------------------------------------------------------------------------

/** 點相對於軸（中心 c、方向 dir）的 側向距離 與 軸向位置 */
function axisRel(p, c, dir) {
  const v = new THREE.Vector3().subVectors(p, c)
  const t = v.dot(dir)
  const lateral = v.addScaledVector(dir, -t).length()
  return { t, lateral }
}

const parallel = (a, b) => Math.abs(a.dot(b)) >= TOL.axisAlign

// ---------------------------------------------------------------------------
// 主程式
// ---------------------------------------------------------------------------

/**
 * @param {object} raw  組合矩陣（可來自檔案、parseAssemblyText 或 builders）
 * @param {Awaited<ReturnType<import('./load-src.mjs').loadSrc>>} ctx
 */
export function analyzeAssembly(raw, ctx) {
  const { parts, copilot, packages, geometry, schema } = ctx
  const issues = []
  const add = (level, code, message, items = []) => issues.push({ level, code, message, items })

  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) {
    add('error', 'no_items', '檔案裡沒有 items 零件陣列。')
    return finish({ raw, issues, items: [], pkg: null, parts })
  }
  const pkg = packages.getPackage(raw.packageId)
  if (raw.packageId && !packages.PACKAGES[raw.packageId]) {
    add('warning', 'unknown_package', `找不到零件包「${raw.packageId}」，改用 ${pkg.packageId} 檢查。`)
  }
  if (raw.schema && raw.schema !== schema.ASSEMBLY_SCHEMA) {
    add('warning', 'schema', `schema 應為「${schema.ASSEMBLY_SCHEMA}」，目前是「${raw.schema}」。`)
  }
  if (!raw.title) add('warning', 'no_title', '缺少 title（設計名稱）。')
  if (!Array.isArray(raw.steps) || !raw.steps.length) add('warning', 'no_steps', '缺少 steps（給新手的組裝步驟）。')
  if (!raw.items.length) add('error', 'no_items', 'items 是空的，沒有任何零件。')

  // ---------- ① 規格驗證（逐件呼叫網站同一個 validateAssembly，保留原始索引） ----------
  const items = []
  const aliases = new Map()
  raw.items.forEach((it, i) => {
    const tag = `items[${i}]`
    if (!it || typeof it !== 'object') {
      add('error', 'bad_item', `${tag} 不是物件。`, [i])
      return
    }
    const ref = parts.resolvePartRef(pkg, it.partId, cleanNulls(it.params ?? (it.length ? { length: it.length } : {})))
    if (!ref) {
      add('error', 'unknown_part', `${tag} 零件包中沒有「${it.partId}」（網站匯入時會略過這個零件）。`, [i])
      return
    }
    const [out] = copilot.validateAssembly({ items: [it] }, pkg).items
    const def = ref.def
    const params = out.params ?? {}
    if (out.partId !== it.partId) {
      const k = `${it.partId}→${out.partId}${ref.params.size ? `（size: ${ref.params.size}）` : ''}`
      aliases.set(k, [...(aliases.get(k) ?? []), i])
    }
    const given = cleanNulls(ref.params)
    for (const [k, v] of Object.entries(given)) {
      if (!def.params?.[k]) {
        add('info', 'unused_param', `${tag} ${def.id} 沒有參數「${k}」，已忽略。`, [i])
        continue
      }
      if (String(v) === String(params[k])) continue
      const spec = def.params[k]
      const norm = (s) => String(s).toUpperCase().replace(/[^0-9A-Z.]/g, '').replace(/MM$/, '')
      if (typeof spec.default === 'string') {
        if (norm(v) === norm(params[k])) add('info', 'param_normalized', `${tag} ${def.id}.${k}: ${JSON.stringify(v)} → ${JSON.stringify(params[k])}（寫法統一）。`, [i])
        else add('warning', 'param_normalized', `${tag} ${def.id}.${k}: ${JSON.stringify(v)} 不是可用規格（${spec.options.join(' / ')}），網站會改用 ${JSON.stringify(params[k])}。`, [i])
      } else {
        const why = spec.custom ? `可裁切範圍 ${spec.min}–${spec.max} mm、取整數` : `現貨規格只有 ${spec.options.join(' / ')}`
        add('warning', 'param_normalized', `${tag} ${def.id}.${k}: ${JSON.stringify(v)} → ${JSON.stringify(params[k])}（${why}）。座標若依原值計算，請重算。`, [i])
      }
    }
    for (const k of Object.keys(def.params ?? {})) {
      if (given[k] === undefined && k === 'size') add('info', 'param_default', `${tag} ${def.id} 未指定 size，使用預設 ${params.size}。`, [i])
    }
    if (!isVec3(it.position)) add('error', 'bad_position', `${tag} position 必須是 3 個數字 [x, y, z]（mm）。`, [i])
    if (it.rotation !== undefined && !isVec3(it.rotation)) add('error', 'bad_rotation', `${tag} rotation 必須是 3 個數字 [rx, ry, rz]（度）。`, [i])
    if (!isVec3(it.position) || (it.rotation !== undefined && !isVec3(it.rotation))) return
    items.push({ index: i, def, params, position: out.position, rotation: out.rotation, g: parts.resolveGeometry(def, params) })
  })
  for (const [k, idx] of aliases) {
    add('info', 'alias', `舊版 partId ${k}：${idx.length} 處（${fmtIdx(idx)}）。建議改寫成新 partId + size。`, idx)
  }

  // ---------- ② 幾何：世界座標 OBB 與錨點 ----------
  for (const it of items) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.rotation.map((d) => d * DEG), 'XYZ'))
    const pos = new THREE.Vector3(...it.position)
    it.matrix = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1))
    const toMm = new THREE.Matrix4().makeScale(1 / geometry.S, 1 / geometry.S, 1 / geometry.S)
    it.obbs = geometry.buildPartMeshes(it.def, it.params).map((m) => {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      const local = new THREE.Matrix4()
      if (m.position || m.rotation) {
        local.compose(
          new THREE.Vector3(...(m.position ?? [0, 0, 0])),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...(m.rotation ?? [0, 0, 0]))),
          new THREE.Vector3(1, 1, 1),
        )
      }
      const M = it.matrix.clone().multiply(toMm).multiply(local)
      return makeObb(m.geometry.boundingBox, M)
    })
    it.box = new THREE.Box3()
    for (const o of it.obbs) for (const p of obbCorners(o)) it.box.expandByPoint(p)
    it.anchors = parts.getAnchors(it.def, it.params).map((a) => ({
      ...a,
      wp: new THREE.Vector3(...a.p).applyMatrix4(it.matrix),
      wdir: new THREE.Vector3(...a.dir).applyQuaternion(q).normalize(),
    }))
    it.label = itemLabel(it)
    it.diameter = it.g.od ?? it.g.d ?? null
    it.q = q
  }

  // ---------- ③ 預期的連接（錨點白名單）與規格相容性 ----------
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const joints = new Map() // pairKey → kind
  const onPin = new Map() // bore item index → [pin item index]
  const onHole = new Set()
  const byIndex = new Map(items.map((it) => [it.index, it]))

  for (const A of items) {
    const pins = A.anchors.filter((a) => a.kind === 'pin')
    if (!pins.length) continue
    for (const B of items) {
      if (B === A) continue
      for (const pin of pins) {
        // 套在螺條 / 螺栓上的螺帽、華司
        for (const bore of B.anchors.filter((a) => a.kind === 'bore')) {
          if (!parallel(pin.wdir, bore.wdir)) continue
          const { t, lateral } = axisRel(bore.wp, pin.wp, pin.wdir)
          if (lateral > Math.max(TOL.axisLateral, 0.15 * (pin.d ?? 0)) || Math.abs(t) > pin.half + (bore.half ?? 0) + TOL.contact) continue
          joints.set(key(A.index, B.index), 'pin-bore')
          onPin.set(B.index, [...(onPin.get(B.index) ?? []), A.index])
          if (pin.thread && bore.thread && pin.thread !== bore.thread) {
            const washer = WASHER_TYPES.has(B.g.type)
            if (!washer || (bore.d ?? 99) < (pin.d ?? 0)) {
              add('error', 'thread_mismatch', `${B.label} 套在 ${A.label} 上，但牙規不符（${bore.thread} ≠ ${pin.thread}）。請改成同一個 size。`, [B.index, A.index])
            } else {
              add('warning', 'loose_washer', `${B.label} 比 ${A.label} 大一號（${bore.thread} 套 ${pin.thread}），會晃動；建議改用 ${pin.thread} 華司。`, [B.index, A.index])
            }
          } else if (bore.d && pin.d && bore.d + 0.2 < pin.d) {
            add('error', 'bore_too_small', `${B.label} 內徑 Ø${bore.d} 小於 ${A.label} 的 Ø${pin.d}，套不進去。`, [B.index, A.index])
          }
        }
        // 穿過孔
        for (const hole of B.anchors.filter((a) => a.kind === 'hole')) {
          if (!parallel(pin.wdir, hole.wdir)) continue
          const { t, lateral } = axisRel(hole.wp, pin.wp, pin.wdir)
          if (lateral > Math.max(TOL.axisLateral, 0.1 * (hole.d ?? 0)) || Math.abs(t) > pin.half + (hole.half ?? 0) + TOL.contact) continue
          joints.set(key(A.index, B.index), 'pin-hole')
          if (pin.d && hole.d && pin.d > hole.d + TOL.holeFit) {
            add('error', 'hole_too_small', `${A.label}（Ø${pin.d}）穿過 ${B.label} 的孔，但孔只有 Ø${hole.d}。請換細一號的螺條 / 螺栓，或換孔徑較大的零件。`, [A.index, B.index])
          }
        }
      }
    }
  }
  // 螺帽 / 華司直接貼在孔上（沒有螺條時，至少記錄它對準了孔）
  for (const A of items) {
    for (const bore of A.anchors.filter((a) => a.kind === 'bore')) {
      for (const B of items) {
        if (B === A) continue
        for (const hole of B.anchors.filter((a) => a.kind === 'hole')) {
          if (!parallel(bore.wdir, hole.wdir)) continue
          const { t, lateral } = axisRel(bore.wp, hole.wp, hole.wdir)
          if (lateral <= TOL.axisLateral && Math.abs(t) <= (hole.half ?? 0) + (bore.half ?? 0) + (bore.seat ?? 0) + TOL.contact) onHole.add(A.index)
        }
      }
    }
  }
  // 管口接合
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i]
      const B = items[j]
      for (const pa of A.anchors.filter((a) => a.kind === 'port')) {
        for (const pb of B.anchors.filter((a) => a.kind === 'port')) {
          if (pa.wp.distanceTo(pb.wp) > TOL.portDist || pa.wdir.dot(pb.wdir) > -TOL.axisAlign) continue
          joints.set(key(A.index, B.index), 'port')
          if (pa.thread && pb.thread && pa.thread !== pb.thread) {
            add('error', 'pipe_size_mismatch', `${A.label} 與 ${B.label} 管徑不同（${pa.thread} ≠ ${pb.thread}），接不起來；請統一 size 或加 gi_reducer。`, [A.index, B.index])
          }
        }
      }
    }
  }
  // U 型管束夾水管：原點在管心、水管沿 U 型管束局部 Z
  for (const U of items.filter((it) => it.g.type === 'u_bolt')) {
    const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(U.q)
    const center = new THREE.Vector3(...U.position)
    for (const P of items.filter((it) => it.g.type === 'pipe')) {
      const port = P.anchors.find((a) => a.kind === 'port')
      if (!port || !parallel(port.wdir, zAxis)) continue
      const { t, lateral } = axisRel(center, new THREE.Vector3(...P.position), port.wdir)
      if (lateral <= 2 && Math.abs(t) <= P.g.length / 2) joints.set(key(U.index, P.index), 'clamp')
    }
  }

  // ---------- ④ 接觸 / 穿透 ----------
  const contact = new Map(items.map((it) => [it.index, new Set()]))
  const expand = (b, m) => b.clone().expandByScalar(m)
  for (let i = 0; i < items.length; i++) {
    const A = items[i]
    const boxA = expand(A.box, TOL.contact)
    for (let j = i + 1; j < items.length; j++) {
      const B = items[j]
      const k = key(A.index, B.index)
      if (joints.has(k)) {
        contact.get(A.index).add(B.index)
        contact.get(B.index).add(A.index)
        continue
      }
      if (!boxA.intersectsBox(B.box)) continue
      let maxOverlap = -Infinity
      const deep = []
      for (const oa of A.obbs) {
        for (const ob of B.obbs) {
          const s = obbOverlap(oa, ob)
          if (s > maxOverlap) maxOverlap = s
          if (s > TOL.penetration) deep.push([oa, ob])
        }
      }
      if (maxOverlap >= -TOL.contact) {
        contact.get(A.index).add(B.index)
        contact.get(B.index).add(A.index)
      }
      if (maxOverlap <= TOL.penetration) continue
      const drill = drillThrough(A, B, deep) ?? drillThrough(B, A, deep.map(([x, y]) => [y, x]))
      if (drill) {
        add('info', 'drill_through', drill, [A.index, B.index])
        continue
      }
      add('error', 'interpenetration', `${A.label} 與 ${B.label} 互相穿透約 ${r1(maxOverlap)} mm。${penetrationHint(A, B)}`, [A.index, B.index])
    }
  }

  // ---------- ⑤ 落地 / 懸空 ----------
  const parent = new Map(items.map((it) => [it.index, it.index]))
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)))
  for (const [a, set] of contact) for (const b of set) parent.set(find(a), find(b))
  const grounded = new Set()
  for (const it of items) {
    if (it.box.min.y < -TOL.belowGround) add('error', 'below_ground', `${it.label} 最低點在 y = ${r1(it.box.min.y)} mm，陷入地面以下。`, [it.index])
    if (it.box.min.y <= TOL.ground) grounded.add(find(it.index))
  }
  const groups = new Map()
  for (const it of items) {
    const r = find(it.index)
    if (!grounded.has(r)) groups.set(r, [...(groups.get(r) ?? []), it])
  }
  for (const g of groups.values()) {
    const lowest = Math.min(...g.map((it) => it.box.min.y))
    const names = g.slice(0, 6).map((it) => it.label).join('、') + (g.length > 6 ? ` …等 ${g.length} 件` : '')
    add('error', 'floating', `懸空：${names} 沒有碰到地面，也沒有接觸其他零件（最低點 y = ${r1(lowest)} mm）。`, g.map((it) => it.index))
  }

  // ---------- ⑥ 螺帽 / 華司是否真的夾住東西 ----------
  for (const it of items) {
    if (!CLAMP_TYPES.has(it.g.type) && !NUT_TYPES.has(it.g.type)) continue
    const pins = onPin.get(it.index) ?? []
    if (!pins.length) {
      if (!onHole.has(it.index)) {
        add('warning', 'nut_not_on_rod', `${it.label} 沒有套在任何螺條 / 螺栓上，也沒有對準孔位。`, [it.index])
      }
      continue
    }
    if (!CLAMP_TYPES.has(it.g.type)) continue
    const others = [...contact.get(it.index)].filter((j) => !pins.includes(j))
    if (!others.length) {
      add('warning', 'not_clamping', `${it.label} 套在 ${byIndex.get(pins[0]).label} 上，但沒有夾住任何東西（上下都沒有接觸零件）。`, [it.index])
    }
  }

  return finish({ raw, issues, items, pkg, parts })
}

/** 合板被「圓形零件」垂直穿過 → 只是要鑽孔 / 開孔，不是錯誤 */
function drillThrough(P, R, deep) {
  if (!DRILLABLE_TYPES.has(P.g.type) || !R.diameter) return null
  // 合板局部 X / Z = 板面方向；穿過的子網格在板面上的投影要夠小，才是「鑽一個孔」能解決的
  const u = new THREE.Vector3(1, 0, 0).applyQuaternion(P.q)
  const w = new THREE.Vector3(0, 0, 1).applyQuaternion(P.q)
  const limit = Math.max(20, R.diameter * TOL.drillFootprint)
  for (const [, or] of deep) {
    if (2 * projRadius(or, u) > limit || 2 * projRadius(or, w) > limit) return null
  }
  const isPin = PIN_TYPES.has(R.g.type)
  const dia = isPin ? r1(R.diameter + 0.5) : Math.ceil(R.diameter + 2)
  return `加工：${R.label} 穿過 ${P.label}，合板需在該位置鑽 Ø${dia} mm 的孔（畫布上不會顯示這個孔）。`
}

function penetrationHint(A, B) {
  const pinItem = [A, B].find((it) => PIN_TYPES.has(it.g.type))
  const other = pinItem === A ? B : A
  if (pinItem) {
    const pin = pinItem.anchors.find((a) => a.kind === 'pin')
    const holes = other.anchors.filter((a) => a.kind === 'hole')
    if (pin && holes.length) {
      const best = holes
        .map((h) => ({ h, ...axisRel(h.wp, pin.wp, pin.wdir) }))
        .sort((x, y) => x.lateral - y.lateral)[0]
      return `最近的孔中心距離螺條軸線 ${r1(best.lateral)} mm${parallel(pin.wdir, best.h.wdir) ? '' : '（而且方向不平行）'}，請對準孔位。`
    }
    if (pin && !holes.length && !NUT_TYPES.has(other.g.type) && !WASHER_TYPES.has(other.g.type)) return `${other.def.id} 沒有孔可以讓螺條穿過，請移開或改用有孔的零件。`
  }
  return '請調整 position / rotation 讓它們剛好貼合而不重疊。'
}

const fmtIdx = (idx) => (idx.length > 8 ? `items[${idx.slice(0, 8).join(', ')}, …]` : `items[${idx.join(', ')}]`)

function itemLabel(it) {
  const p = it.params ?? {}
  const bits = [p.size, p.length !== undefined ? `L${p.length}` : null, p.width !== undefined ? `${p.width}×${p.depth}×${p.thickness}t` : null].filter(Boolean)
  return `items[${it.index}] ${it.def.name['zh-TW']}${bits.length ? ` ${bits.join(' ')}` : ''}`
}

function finish({ raw, issues, items, pkg, parts }) {
  const box = new THREE.Box3()
  for (const it of items) box.union(it.box)
  const has = items.length > 0
  const size = has ? box.getSize(new THREE.Vector3()) : new THREE.Vector3()
  // BOM（與網站採購清單相同的合併規則）
  const bom = new Map()
  for (const it of items) {
    const k = `${it.def.id}|${JSON.stringify(it.params ?? {})}`
    const row = bom.get(k) ?? { partId: it.def.id, params: it.params ?? {}, ...parts.bomLabel(it.def, it.params), qty: 0 }
    row.qty += 1
    bom.set(k, row)
  }
  const rows = [...bom.values()].map((r) => ({ ...r, subtotal: r.price * r.qty }))
  const order = { error: 0, warning: 1, info: 2 }
  issues.sort((a, b) => order[a.level] - order[b.level])
  const count = (lv) => issues.filter((x) => x.level === lv).length
  return {
    ok: count('error') === 0,
    title: raw?.title ?? '',
    packageId: pkg?.packageId ?? null,
    counts: { errors: count('error'), warnings: count('warning'), infos: count('info') },
    issues,
    partCount: items.length,
    rawItemCount: Array.isArray(raw?.items) ? raw.items.length : 0,
    dimensions: has
      ? {
          width: r1(size.x),
          height: r1(size.y),
          depth: r1(size.z),
          min: box.min.toArray().map(r1),
          max: box.max.toArray().map(r1),
        }
      : null,
    bom: rows,
    totalPrice: rows.reduce((s, r) => s + r.subtotal, 0),
    tolerances: TOL,
  }
}
