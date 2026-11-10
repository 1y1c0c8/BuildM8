import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { parseAssemblyText, validateAssembly } from '../ai/copilot'
import { ASSEMBLY_SCHEMA } from '../data/schema'
import { registry } from '../three/registry'

/**
 * 設計檔（buildm8.assembly/v1 JSON）的匯入 / 匯出：
 *   - 匯入：檔案選擇或把 .json 拖到畫布 → parseAssemblyText → importAssembly（同「用我的 Claude 帳號生成」流程）
 *   - 匯出：把目前畫布存成設計檔，可交回 Claude Code（/design）修改
 * 搭配 docs/CLAUDE_CODE_WORKFLOW.md 的 Claude Code 代理人流程使用。
 */

const MAX_BYTES = 5 * 1024 * 1024

/** 目前畫布 → 組合矩陣（保留零件上未知的欄位，例如之後新增的 joints） */
export function currentAssembly() {
  const { items, packageId, lastAssembly } = useStore.getState()
  return {
    schema: ASSEMBLY_SCHEMA,
    packageId,
    title: lastAssembly?.title || '我的 BuildM8 設計',
    summary: lastAssembly?.summary || '',
    steps: Array.isArray(lastAssembly?.steps) ? lastAssembly.steps : [],
    items: items.map(({ uid: _uid, spawn: _spawn, ...rest }) => rest),
  }
}

/** 最近一次匯入的檔名：匯出時沿用（方便覆蓋 designs/<slug>.json 交回 Claude Code） */
let lastImport = null

/**
 * 下載檔名只用 ASCII：部分瀏覽器遇到中文或全形符號會改成 "download"。
 * 優先沿用匯入時的檔名，其次取標題中的英數字，最後用時間戳記。
 */
function fileName(title) {
  if (lastImport && useStore.getState().lastAssembly === lastImport.assembly) return lastImport.name
  const ascii = String(title || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40)
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  return `buildm8-${ascii && /[a-z]/.test(ascii) ? `${ascii}-` : ''}${stamp}.json`
}

export function downloadAssembly() {
  const a = currentAssembly()
  const blob = new Blob([JSON.stringify(a, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(a.title)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return a
}

async function importFile(file, importAssembly) {
  if (!/\.json$/i.test(file.name) && !/json/.test(file.type)) throw new Error(`「${file.name}」不是 .json 設計檔。`)
  if (file.size > MAX_BYTES) throw new Error('檔案太大（超過 5 MB），不像是 BuildM8 設計檔。')
  const raw = parseAssemblyText(await file.text())
  const assembly = importAssembly(raw, `匯入設計檔：${file.name}`, '設計檔')
  const ascii = file.name.replace(/\.json$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  lastImport = { assembly, name: `${ascii || 'buildm8-design'}.json` }
  return assembly
}

const btn =
  'flex-1 h-9 md:h-8 px-2.5 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 bg-ink-800 border border-white/[0.07] text-ink-200 hover:text-white hover:border-brand/40 transition disabled:opacity-40'

/** Copilot 面板內的「匯入設計檔 / 匯出設計檔」兩顆按鈕 */
export function DesignFileButtons({ importAssembly, disabled }) {
  const inputRef = useRef(null)
  const count = useStore((s) => s.items.length)
  const [msg, setMsg] = useState(null)

  const onPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const a = await importFile(file, importAssembly)
      setMsg({ ok: true, text: `已匯入「${a.title}」，共 ${a.items.length} 個零件。` })
    } catch (err) {
      setMsg({ ok: false, text: err?.message ?? '匯入失敗' })
    }
  }

  return (
    <div className="mb-2">
      <div className="flex gap-1.5">
        <button type="button" data-testid="import-design" disabled={disabled} onClick={() => inputRef.current?.click()} className={btn} title="匯入 Claude Code 產生的 designs/*.json，也可以直接把檔案拖到畫布">
          <span aria-hidden>📂</span> 匯入設計檔（.json）
        </button>
        <button
          type="button"
          data-testid="export-design"
          disabled={!count}
          onClick={() => {
            const a = downloadAssembly()
            setMsg({ ok: true, text: `已下載設計檔（${a.items.length} 個零件）。` })
          }}
          className={btn}
          title="把目前畫布存成設計檔，可交給 Claude Code 修改"
        >
          <span aria-hidden>💾</span> 匯出設計檔
        </button>
      </div>
      <input ref={inputRef} data-testid="import-design-input" type="file" accept=".json,application/json" className="hidden" onChange={onPick} />
      {msg && (
        <div role="status" data-testid="design-file-status" className={`mt-1.5 text-[11px] leading-snug ${msg.ok ? 'text-emerald-300/90' : 'text-red-300'}`}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

/** 把 .json 設計檔拖到畫布（整個視窗都可以放）就匯入；開發模式另提供給 scripts/render-design.mjs 用的掛鉤 */
export function DesignFileDrop({ importAssembly }) {
  const [over, setOver] = useState(false)
  const [toast, setToast] = useState(null)
  const importRef = useRef(importAssembly)
  importRef.current = importAssembly

  useEffect(() => {
    let depth = 0
    const isFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e) => {
      if (!isFiles(e)) return
      depth++
      setOver(true)
    }
    const leave = (e) => {
      if (!isFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setOver(false)
    }
    const overFn = (e) => {
      if (!isFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const drop = async (e) => {
      if (!isFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      const file = Array.from(e.dataTransfer.files ?? [])[0]
      if (!file) return
      try {
        const a = await importFile(file, importRef.current)
        setToast({ ok: true, text: `已匯入「${a.title}」，共 ${a.items.length} 個零件。` })
      } catch (err) {
        setToast({ ok: false, text: err?.message ?? '匯入失敗' })
      }
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overFn)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overFn)
      window.removeEventListener('drop', drop)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!import.meta.env.DEV) return // 正式版不會有這個掛鉤
    window.__buildm8 = devHook
    return () => {
      if (window.__buildm8 === devHook) delete window.__buildm8
    }
  }, [])

  return (
    <>
      {over && (
        <div data-testid="design-drop-overlay" className="pointer-events-none absolute inset-3 z-20 rounded-2xl border-2 border-dashed border-violet-400/60 bg-violet-500/[0.06] grid place-items-center">
          <div className="text-violet-200 text-sm font-semibold">放開以匯入設計檔（.json）</div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          data-testid="design-drop-toast"
          className={`absolute top-12 left-1/2 -translate-x-1/2 z-20 max-w-[90%] rounded-lg px-3 py-2 text-[12px] font-medium shadow-lg ${
            toast.ok ? 'bg-emerald-500/90 text-ink-950' : 'bg-red-500/90 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  )
}

/**
 * 開發模式專用（npm run dev）：讓 scripts/render-design.mjs 用 Playwright 載入設計並拍照。
 * 正式版（import.meta.env.DEV = false）不會掛上 window。
 */
const devHook = {
  /** 載入設計（略過掉落動畫），回傳驗證後的組合矩陣 */
  loadAssembly(raw) {
    const pkg = getPackage(useStore.getState().packageId)
    const assembly = validateAssembly(typeof raw === 'string' ? parseAssemblyText(raw) : raw, pkg)
    useStore.getState().loadAssembly(assembly)
    useStore.setState((s) => ({ items: s.items.map((i) => ({ ...i, spawn: null })), selectedId: null }))
    return { title: assembly.title, count: assembly.items.length, warnings: assembly.warnings }
  },
  getAssembly: currentAssembly,
  /** 鏡頭：'front' | 'iso' | 'top' | 'side' | 'back' */
  setView(view = 'iso') {
    const c = registry.controls
    if (!c) return false
    const box = new THREE.Box3()
    registry.objects.forEach((o) => box.expandByObject(o))
    if (box.isEmpty()) return false
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(4, box.getSize(new THREE.Vector3()).length() / 2)
    const cam = c.object
    const vfov = (cam.fov * Math.PI) / 180
    const fov = Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect))
    const dist = (radius / Math.sin(fov / 2)) * 1.05
    const dirs = { front: [0, 0.08, 1], back: [0, 0.08, -1], side: [1, 0.08, 0], top: [0, 1, 0.001], iso: [0.75, 0.55, 1] }
    const dir = new THREE.Vector3(...(dirs[view] ?? dirs.iso)).normalize()
    const damping = c.enableDamping
    c.enableDamping = false
    c.target.copy(center)
    cam.position.copy(center).addScaledVector(dir, dist)
    cam.near = Math.max(0.1, dist / 200)
    cam.far = dist * 20
    cam.updateProjectionMatrix()
    c.update()
    c.enableDamping = damping
    return true
  },
}
