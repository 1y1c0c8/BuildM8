import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { useSidebar } from '../store/useSidebar'
import { useLayout } from '../store/useLayout'
import { PartGlyph, IconSearch, IconChevron, IconGrid, IconBox, IconX } from './Icons'

const CATS = [
  { key: 'all', label: '全部' },
  { key: 'fastener', label: '螺絲螺帽' },
  { key: 'rod', label: '螺條' },
  { key: 'profile', label: '型材' },
  { key: 'pipe', label: '水管' },
  { key: 'panel', label: '板材' },
  { key: 'hardware', label: '五金配件' },
]
const CAT_GROUP = { bracket: 'profile', fitting: 'pipe' }

function SidebarPanel({ collapsed = false, toggleRef, drawer = false, onClose }) {
  const packageId = useStore((s) => s.packageId)
  const addPart = useStore((s) => s.addPart)
  const pkg = getPackage(packageId)
  const [q, setQ] = useState('')
  const cat = useSidebar((s) => s.cat)
  const setCat = useSidebar((s) => s.setCat)

  const parts = useMemo(() => {
    const k = q.trim().toLowerCase()
    return pkg.parts.filter((p) => {
      const c = CAT_GROUP[p.category] ?? p.category
      if (cat !== 'all' && c !== cat) return false
      if (!k) return true
      return [p.name['zh-TW'], p.name.en, p.standard, ...(p.aliases ?? []), ...(p.params?.size?.options ?? [])].join(' ').toLowerCase().includes(k)
    })
  }, [pkg, q, cat])

  return (
    <aside
      id="parts-sidebar"
      aria-label="零件庫"
      aria-hidden={collapsed}
      inert={collapsed}
      className={`${drawer ? 'w-full' : 'w-[272px]'} h-full flex flex-col transition-opacity duration-200 ease-out ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-[11px] uppercase tracking-[.14em] text-ink-400 font-semibold">Hardware Package</div>
            <div className="text-sm font-semibold mt-0.5">{pkg.name}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-ink-300 border border-white/5">v{pkg.version}</span>
            {drawer ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉零件庫"
                title="關閉零件庫"
                className="size-9 shrink-0 rounded-lg grid place-items-center text-ink-300 hover:text-white hover:bg-white/[0.06]"
              >
                <IconX size={18} />
              </button>
            ) : (
              <CollapseToggle ref={toggleRef} collapsed={false} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-2.5">
          {pkg.standards.map((s) => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300/90 border border-emerald-400/10">
              {s}
            </span>
          ))}
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-ink-300 border border-white/5 font-mono">{pkg.packageId}</span>
        </div>
        <div className="relative">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋：螺帽、角鐵、4分管…"
            className="w-full h-9 md:h-8 pl-8 pr-2 rounded-lg bg-ink-800 border border-white/5 text-base md:text-xs placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto scroll-thin pb-1">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`shrink-0 h-8 md:h-6 px-2.5 md:px-2 rounded-md text-[11px] font-medium transition ${
                cat === c.key ? 'bg-white text-ink-950' : 'text-ink-300 hover:bg-white/5'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto scroll-thin px-3 pb-3 grid gap-2 content-start ${drawer ? 'grid-cols-2 min-[420px]:grid-cols-3' : 'grid-cols-2'}`}>
        {parts.map((p) => (
          <button
            key={p.id}
            draggable={!drawer}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-buildm8-part', p.id)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => {
              addPart(p.id)
              if (drawer) onClose?.()
            }}
            title={`${p.name['zh-TW']}｜${p.standard}${p.note ? `\n${p.note}` : ''}\n點擊或拖曳到畫布`}
            className="group relative text-left rounded-xl p-2 bg-ink-850 border border-white/[0.05] hover:border-brand/40 hover:bg-ink-800 transition cursor-grab active:cursor-grabbing"
          >
            <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-ink-800 to-ink-900 grid place-items-center text-ink-300 group-hover:text-brand-soft transition">
              <PartGlyph type={p.geometry.type} className="size-14 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="mt-1.5 text-[12px] font-semibold leading-tight truncate">{p.name['zh-TW']}</div>
            <div className="text-[10px] text-ink-400 truncate font-mono">{p.standard}</div>
            <span className="absolute top-2.5 right-2.5 size-5 rounded-md bg-brand text-ink-950 text-sm font-bold grid place-items-center opacity-0 group-hover:opacity-100 transition">
              +
            </span>
          </button>
        ))}
        {!parts.length && <div className="col-span-full text-center text-xs text-ink-400 py-8">找不到符合的零件</div>}
      </div>

      <div className="px-3 py-2.5 border-t border-white/5 text-[10px] text-ink-400 leading-relaxed">
        零件以標準參數即時生成（無 3D 檔）。未來可透過 Provider 從 TraceParts / PARTcommunity / McMaster-Carr 匯入。
      </div>
    </aside>
  )
}

/** 收合軌道上的分類圖示（未列出的分類以方塊圖示代替） */
const CAT_ICON = {
  fastener: 'hex_nut',
  rod: 'threaded_rod',
  profile: 'l_bracket',
  pipe: 'tee',
  panel: 'panel',
}

const RAIL_W = 52

function CollapseToggle({ collapsed, ref }) {
  const toggle = useSidebar((s) => s.toggle)
  const label = collapsed ? '展開零件庫 ([)' : '收合零件庫 ([)'
  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-controls="parts-sidebar"
      aria-label={label}
      title={label}
      className="size-7 shrink-0 rounded-lg grid place-items-center text-ink-400 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 transition"
    >
      <IconChevron size={16} className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-90'}`} />
    </button>
  )
}

export function Sidebar() {
  const collapsed = useSidebar((s) => s.collapsed)
  const cat = useSidebar((s) => s.cat)
  const openCategory = useSidebar((s) => s.openCategory)
  const wrapRef = useRef(null)
  const panelToggleRef = useRef(null)
  const railToggleRef = useRef(null)
  const prevCollapsed = useRef(collapsed)

  // 收合／展開後，若焦點原本在側欄內，移到另一側的切換鈕，避免焦點掉進 inert 區塊
  useEffect(() => {
    if (prevCollapsed.current === collapsed) return
    prevCollapsed.current = collapsed
    const wrap = wrapRef.current
    const active = document.activeElement
    if (!wrap || (active && active !== document.body && !wrap.contains(active))) return
    ;(collapsed ? railToggleRef : panelToggleRef).current?.focus({ preventScroll: true })
  }, [collapsed])

  return (
    <div
      ref={wrapRef}
      style={{ width: collapsed ? RAIL_W : 272 }}
      className="relative shrink-0 overflow-hidden hidden md:block border-r border-white/[0.06] bg-ink-900/70 backdrop-blur-xl z-10 transition-[width] duration-200 ease-out"
    >
      <SidebarPanel collapsed={collapsed} toggleRef={panelToggleRef} />

      <nav
        aria-label="零件分類"
        aria-hidden={!collapsed}
        inert={!collapsed}
        style={{ width: RAIL_W }}
        className={`absolute inset-y-0 left-0 flex flex-col items-center gap-1 py-3 transition-opacity duration-200 ease-out ${
          collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <CollapseToggle ref={railToggleRef} collapsed />
        <div className="w-6 h-px bg-white/[0.06] my-1.5" />
        {CATS.map((c) => {
          const glyph = CAT_ICON[c.key]
          const active = cat === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => openCategory(c.key)}
              title={`${c.label}（展開零件庫）`}
              aria-label={`展開零件庫：${c.label}`}
              className={`size-9 rounded-lg grid place-items-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                active ? 'bg-white/[0.08] text-brand' : 'text-ink-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {c.key === 'all' ? (
                <IconGrid size={16} />
              ) : glyph ? (
                <PartGlyph type={glyph} className="size-6" />
              ) : (
                <IconBox size={16} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/** 手機版：從左側滑出的零件庫抽屜 */
export function PartsDrawer() {
  const open = useLayout((s) => s.panel === 'parts')
  const close = useLayout((s) => s.close)
  return (
    <div className={`fixed inset-0 z-40 md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div onClick={close} className={`absolute inset-0 bg-ink-950/60 backdrop-blur-[2px] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="零件庫"
        className={`absolute inset-y-0 left-0 w-[min(88vw,380px)] bg-ink-900 border-r border-white/[0.08] shadow-2xl shadow-black/60 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-250 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarPanel drawer onClose={close} />
      </div>
    </div>
  )
}
