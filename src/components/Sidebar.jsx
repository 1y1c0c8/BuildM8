import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { PartGlyph, IconSearch } from './Icons'

const CATS = [
  { key: 'all', label: '全部' },
  { key: 'fastener', label: '螺絲螺帽' },
  { key: 'rod', label: '螺條' },
  { key: 'profile', label: '型材' },
  { key: 'pipe', label: '水管' },
  { key: 'panel', label: '板材' },
]
const CAT_GROUP = { bracket: 'profile', fitting: 'pipe' }

export function Sidebar() {
  const packageId = useStore((s) => s.packageId)
  const addPart = useStore((s) => s.addPart)
  const pkg = getPackage(packageId)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')

  const parts = useMemo(() => {
    const k = q.trim().toLowerCase()
    return pkg.parts.filter((p) => {
      const c = CAT_GROUP[p.category] ?? p.category
      if (cat !== 'all' && c !== cat) return false
      if (!k) return true
      return [p.name['zh-TW'], p.name.en, p.standard, ...(p.aliases ?? [])].join(' ').toLowerCase().includes(k)
    })
  }, [pkg, q, cat])

  return (
    <aside className="w-[272px] shrink-0 flex flex-col border-r border-white/[0.06] bg-ink-900/70 backdrop-blur-xl z-10">
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-[11px] uppercase tracking-[.14em] text-ink-400 font-semibold">Hardware Package</div>
            <div className="text-sm font-semibold mt-0.5">{pkg.name}</div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-ink-300 border border-white/5">v{pkg.version}</span>
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
            className="w-full h-8 pl-8 pr-2 rounded-lg bg-ink-800 border border-white/5 text-xs placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto scroll-thin pb-1">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`shrink-0 h-6 px-2 rounded-md text-[11px] font-medium transition ${
                cat === c.key ? 'bg-white text-ink-950' : 'text-ink-300 hover:bg-white/5'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-3 grid grid-cols-2 gap-2 content-start">
        {parts.map((p) => (
          <button
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-buildm8-part', p.id)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => addPart(p.id)}
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
        {!parts.length && <div className="col-span-2 text-center text-xs text-ink-400 py-8">找不到符合的零件</div>}
      </div>

      <div className="px-3 py-2.5 border-t border-white/5 text-[10px] text-ink-400 leading-relaxed">
        零件以標準參數即時生成（無 3D 檔）。未來可透過 Provider 從 TraceParts / PARTcommunity / McMaster-Carr 匯入。
      </div>
    </aside>
  )
}
