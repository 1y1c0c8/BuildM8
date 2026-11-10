import { create } from 'zustand'
import { getPackage } from '../data/packages'
import { defaultParams, normalizeParams, resolvePartRef, restY } from '../data/parts'

let seq = 0
const uid = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`
const round = (v, d = 10) => Math.round(v * d) / d

const HISTORY_LIMIT = 80

/**
 * 場景資料以「mm / 度」保存，與 AI 組合矩陣格式完全一致；
 * 3D 畫布在渲染時才換算成 cm。
 */
export const useStore = create((set, get) => ({
  packageId: 'taiwan_hardware_store_v1',
  items: [],
  selectedId: null,
  hoveredId: null,
  mode: 'translate', // translate | rotate
  gridStep: 1, // cm；0 = 關閉
  magnet: true,
  snapHint: null, // { position:[cm], dir:[x,y,z], kind }
  past: [],
  future: [],
  lastAssembly: null,

  // ---------- 歷史紀錄 ----------
  _record() {
    const { items, past } = get()
    set({ past: [...past.slice(-HISTORY_LIMIT), items], future: [] })
  },
  undo() {
    const { past, items, future } = get()
    if (!past.length) return
    set({ items: past[past.length - 1], past: past.slice(0, -1), future: [items, ...future], selectedId: null })
  },
  redo() {
    const { past, items, future } = get()
    if (!future.length) return
    set({ items: future[0], future: future.slice(1), past: [...past, items], selectedId: null })
  },

  // ---------- 零件操作 ----------
  addPart(partId, { params, position, rotation } = {}) {
    const ref = resolvePartRef(getPackage(get().packageId), partId, params ?? {})
    if (!ref) return null
    const { def } = ref
    const p = normalizeParams(def, { ...defaultParams(def), ...ref.params })
    get()._record()
    const item = {
      uid: uid(),
      partId: def.id,
      params: p,
      position: position ?? findFreeSpot(get().items, restY(def, p)),
      rotation: rotation ?? [0, 0, 0],
      spawn: { at: performance.now(), delay: 0 },
    }
    set({ items: [...get().items, item], selectedId: item.uid })
    return item.uid
  },

  updateItem(id, patch, { record = true } = {}) {
    if (record) get()._record()
    set({
      items: get().items.map((it) =>
        it.uid === id
          ? {
              ...it,
              ...patch,
              position: patch.position ? patch.position.map((v) => round(v)) : it.position,
              rotation: patch.rotation ? patch.rotation.map((v) => round(v)) : it.rotation,
              spawn: null,
            }
          : it,
      ),
    })
  },

  setParam(id, key, value) {
    const pkg = getPackage(get().packageId)
    const it = get().items.find((i) => i.uid === id)
    const def = pkg.parts.find((p) => p.id === it?.partId)
    if (!def) return
    get().updateItem(id, { params: normalizeParams(def, { ...it.params, [key]: value }) })
  },

  rotateBy(id, axis, deg) {
    const it = get().items.find((i) => i.uid === id)
    if (!it) return
    const r = [...it.rotation]
    r[axis] = ((r[axis] + deg + 540) % 360) - 180
    get().updateItem(id, { rotation: r })
  },

  removeItem(id) {
    if (!id) return
    get()._record()
    set({ items: get().items.filter((i) => i.uid !== id), selectedId: null })
  },

  duplicate(id) {
    const it = get().items.find((i) => i.uid === id)
    if (!it) return
    get()._record()
    const copy = {
      ...it,
      uid: uid(),
      position: [it.position[0] + 30, it.position[1], it.position[2] + 30],
      spawn: { at: performance.now(), delay: 0 },
    }
    set({ items: [...get().items, copy], selectedId: copy.uid })
  },

  clear() {
    if (!get().items.length) return
    get()._record()
    set({ items: [], selectedId: null, lastAssembly: null })
  },

  /** 讀入 AI 產生的組合矩陣，並以「逐顆掉落」動畫拼裝 */
  loadAssembly(assembly, { replace = true } = {}) {
    const pkg = getPackage(get().packageId)
    get()._record()
    const now = performance.now()
    // 舊版 partId（例 hex_nut_m8）會經由 package.idAliases 轉成尺寸家族 + 規格
    const valid = (assembly.items ?? [])
      .map((i) => ({ i, ref: resolvePartRef(pkg, i.partId, i.params ?? (i.length ? { length: i.length } : {})) }))
      .filter((x) => x.ref)
    const step = Math.max(12, Math.min(70, 2400 / Math.max(1, valid.length)))
    const items = valid.map(({ i, ref }, idx) => {
      const def = ref.def
      const params = normalizeParams(def, ref.params)
      return {
        uid: uid(),
        partId: def.id,
        params,
        position: (i.position ?? [0, restY(def, params), 0]).map(Number),
        rotation: (i.rotation ?? [0, 0, 0]).map(Number),
        spawn: { at: now, delay: idx * step },
      }
    })
    set({
      items: replace ? items : [...get().items, ...items],
      selectedId: null,
      lastAssembly: assembly,
    })
  },

  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  setMode: (mode) => set({ mode }),
  setGridStep: (gridStep) => set({ gridStep }),
  toggleMagnet: () => set({ magnet: !get().magnet }),
  setSnapHint: (snapHint) => set({ snapHint }),
}))

/** 找一個不和既有零件重疊的地面位置（簡易：沿 X 軸排開） */
function findFreeSpot(items, y) {
  const taken = items.map((i) => i.position)
  for (let r = 0; r < 12; r++) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const x = Math.round((Math.cos(a) * r * 110) / 10) * 10
      const z = Math.round((Math.sin(a) * r * 110) / 10) * 10
      if (!taken.some((p) => Math.hypot(p[0] - x, p[2] - z) < 95)) return [x, y, z]
      if (r === 0) break
    }
  }
  return [0, y, 0]
}
