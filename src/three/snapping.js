/**
 * 網格對齊 + 孔洞磁吸（Grid & Hole Snapping）
 *
 *  pin  → hole : 螺條 / 螺栓自動轉正並穿進孔（螺栓頭貼齊表面）
 *  bore → hole : 螺帽 / 華司貼在孔的表面上
 *  bore → pin  : 螺帽沿著螺條滑動（像真的鎖上去）
 *  hole → hole : 洞洞鐵、角鐵、板材孔對孔疊放
 *  port → port : 水管與管件管口接合
 *
 * 相容性：錨點帶 thread（牙規 / 管徑）與 d（mm）。螺帽只會套上同牙規的螺條 / 螺栓，
 * 螺栓 / 螺帽不會吸進比自己細的孔，管口只接同管徑（異徑接頭兩端各自標示）。
 *
 * 座標：場景單位 cm；錨點資料為 mm（乘上 S）。
 */
import * as THREE from 'three'
import { getAnchors } from '../data/parts'
import { S } from './geometry'

const THR = 1.6 // cm：孔 / 軸吸附距離
const THR_PORT = 2.8 // cm：管口吸附距離

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()

/** joints：目前關節值（例 { angle: 90 }），活動葉片上的孔會跟著轉 */
export function worldAnchors(obj, def, params, joints) {
  obj.updateMatrixWorld(true)
  const q = obj.getWorldQuaternion(new THREE.Quaternion())
  return getAnchors(def, params, joints).map((a) => ({
    kind: a.kind,
    local: new THREE.Vector3(...a.p).multiplyScalar(S),
    p: new THREE.Vector3(...a.p).multiplyScalar(S).applyMatrix4(obj.matrixWorld),
    dir: new THREE.Vector3(...a.dir).applyQuaternion(q).normalize(),
    half: (a.half ?? 0) * S,
    seat: a.seat === undefined ? undefined : a.seat * S,
    d: a.d, // mm
    thread: a.thread,
  }))
}

/** 牙規 / 孔徑相容性：M8 螺帽只套 M8 螺條；螺栓不能穿進比自己細的孔；15A 管口只接 15A */
const FIT_TOL = 0.6 // mm
const fitsHole = (shaft, hole) => !(shaft.d && hole.d) || shaft.d <= hole.d + FIT_TOL
const sameThread = (a, b) => !(a.thread && b.thread) || a.thread === b.thread

/** 點到線段距離與投影參數 t */
function pointSegment(pt, center, dir, half) {
  const t = THREE.MathUtils.clamp(_v.copy(pt).sub(center).dot(dir), -half, half)
  const closest = center.clone().addScaledVector(dir, t)
  return { d: closest.distanceTo(pt), t, closest }
}

const signOr1 = (x) => (x < 0 ? -1 : 1)

/**
 * 在 TransformControls 拖曳中呼叫：直接修改 obj 的 position / quaternion。
 * @param {THREE.Object3D} obj
 * @param {{def, params, joints?}} self
 * @param {ReturnType<typeof worldAnchors>} targets  其他零件的世界錨點（拖曳開始時快取）
 * @param {{ grid:number, magnet:boolean }} opts
 * @returns {null | { position:number[], dir:number[], kind:string }}
 */
export function applySnap(obj, self, targets, { grid, magnet }) {
  if (grid > 0) {
    obj.position.set(
      Math.round(obj.position.x / grid) * grid,
      Math.round(obj.position.y / grid) * grid,
      Math.round(obj.position.z / grid) * grid,
    )
  }
  if (!magnet || !targets.length) return null

  const own = worldAnchors(obj, self.def, self.params, self.joints)
  let best = null
  const consider = (score, apply, hint) => {
    if (!best || score < best.score) best = { score, apply, hint }
  }

  for (const a of own) {
    for (const t of targets) {
      // ---- 螺條 / 螺栓 穿孔 ----
      if (a.kind === 'pin' && t.kind === 'hole') {
        if (!fitsHole(a, t)) continue
        const align = Math.abs(a.dir.dot(t.dir))
        if (align < 0.8) continue
        const { d } = pointSegment(t.p, a.p, a.dir, a.half)
        if (d > THR) continue
        consider(d, () => {
          const isBolt = a.seat !== undefined
          const s = isBolt ? signOr1(_v.copy(obj.position).sub(t.p).dot(t.dir)) : signOr1(a.dir.dot(t.dir))
          const newDir = t.dir.clone().multiplyScalar(s)
          rotateAnchorTo(obj, a.dir, newDir)
          if (isBolt) {
            obj.position.copy(t.p).addScaledVector(newDir, t.half)
          } else {
            const along = THREE.MathUtils.clamp(_v.copy(a.p).sub(t.p).dot(newDir), -a.half + t.half, a.half - t.half)
            const center = t.p.clone().addScaledVector(newDir, along)
            obj.position.copy(center).sub(a.local.clone().applyQuaternion(obj.quaternion))
          }
        }, t)
      }
      // ---- 螺帽 / 華司 → 孔 或 螺條 ----
      if (a.kind === 'bore' && (t.kind === 'hole' || t.kind === 'pin')) {
        if (t.kind === 'pin' ? !sameThread(a, t) : !fitsHole(a, t)) continue
        const { d, t: along } = pointSegment(a.p, t.p, t.dir, t.half)
        if (d > THR) continue
        consider(d * 0.9, () => {
          if (t.kind === 'hole') {
            const s = signOr1(_v.copy(a.p).sub(t.p).dot(t.dir))
            const newDir = t.dir.clone().multiplyScalar(s)
            rotateAnchorTo(obj, a.dir, newDir)
            obj.position.copy(t.p).addScaledVector(newDir, t.half + (a.seat ?? 0))
          } else {
            const newDir = t.dir.clone().multiplyScalar(signOr1(a.dir.dot(t.dir)))
            rotateAnchorTo(obj, a.dir, newDir)
            obj.position.copy(t.p).addScaledVector(t.dir, along)
          }
        }, t)
      }
      // ---- 孔對孔（洞洞鐵 / 角鐵 / 板材疊放） ----
      if (a.kind === 'hole' && t.kind === 'hole') {
        if (Math.abs(a.dir.dot(t.dir)) < 0.97) continue
        const delta = _v.copy(a.p).sub(t.p)
        const axial = delta.dot(t.dir)
        const lateral = delta.clone().addScaledVector(t.dir, -axial).length()
        if (lateral > THR || Math.abs(axial) > a.half + t.half + 1.2) continue
        consider(lateral + 0.2, () => {
          const s = signOr1(axial)
          const goal = t.p.clone().addScaledVector(t.dir, s * (a.half + t.half))
          obj.position.add(goal.sub(a.p))
        }, t)
      }
      // ---- 管口接合 ----
      if (a.kind === 'port' && t.kind === 'port') {
        if (!sameThread(a, t)) continue
        const d = a.p.distanceTo(t.p)
        if (d > THR_PORT) continue
        consider(d, () => {
          rotateAnchorTo(obj, a.dir, t.dir.clone().negate())
          obj.position.copy(t.p).sub(a.local.clone().applyQuaternion(obj.quaternion))
        }, t)
      }
    }
  }

  if (!best) return null
  best.apply()
  return { position: best.hint.p.toArray(), dir: best.hint.dir.toArray(), kind: best.hint.kind }
}

/** 旋轉物件，使某個錨點方向 from（世界）轉到 to（世界） */
function rotateAnchorTo(obj, from, to) {
  if (from.dot(to) > 0.99999) return
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize())
  obj.quaternion.premultiply(_q)
  obj.updateMatrixWorld(true)
}
