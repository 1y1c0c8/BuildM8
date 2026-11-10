import { useEffect, useRef, useState } from 'react'
import Workspace from './three/Workspace'
import { TopBar, CanvasToolbar } from './components/TopBar'
import { Sidebar, PartsDrawer } from './components/Sidebar'
import { CopilotPanel, useCopilotChat } from './components/CopilotPanel'
import { BomPanel } from './components/BomPanel'
import { KeyLayer } from './components/KeyDialogs'
import { Inspector } from './components/Inspector'
import { DesignFileDrop } from './components/DesignFileIO'
import { IconKeyboard, IconSparkle, IconBox, IconCart, IconChevron } from './components/Icons'
import { useStore } from './store/useStore'
import { useSidebar } from './store/useSidebar'
import { useLayout } from './store/useLayout'
import { useBreakpoint } from './hooks/useBreakpoint'
import { getPackage } from './data/packages'
import { restY, defaultParams } from './data/parts'
import { registry } from './three/registry'
import mockSquareFrame from './data/mock/square_frame.json'

export default function App() {
  const chat = useCopilotChat()
  const bp = useBreakpoint()
  useShortcuts()
  useAutoClosePanels(bp)
  const runMock = () => chat.runMockJson(mockSquareFrame, 'AI 模擬生成：讀取 mock/square_frame.json')

  return (
    <div className="h-full flex flex-col">
      <TopBar generating={chat.busy} onMockGenerate={runMock} />
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        <Sidebar />
        <main className="relative flex-1 min-w-0">
          <CanvasArea onTry={runMock} bp={bp} />
          <DesignFileDrop importAssembly={chat.importAssembly} />
        </main>
        {bp === 'desktop' && (
          <aside className="w-[320px] xl:w-[368px] shrink-0 flex flex-col border-l border-white/[0.06] bg-ink-900/70 backdrop-blur-xl z-10">
            <CopilotPanel chat={chat} />
            <BomPanel />
          </aside>
        )}
        {bp === 'tablet' && <TabletPanel chat={chat} />}
      </div>
      {bp === 'mobile' && (
        <>
          <MobileSheet chat={chat} />
          <MobileNav />
          <PartsDrawer />
        </>
      )}
      <KeyLayer />
    </div>
  )
}

/** 小螢幕：AI 產生設計後自動收起面板，讓使用者看到拼裝動畫；切到桌面版時清掉面板狀態 */
function useAutoClosePanels(bp) {
  const lastAssembly = useStore((s) => s.lastAssembly)
  useEffect(() => {
    if (lastAssembly && bp !== 'desktop') useLayout.getState().close()
  }, [lastAssembly, bp])
  useEffect(() => {
    if (bp === 'desktop') useLayout.getState().close()
  }, [bp])
}

/** 平板：從右側滑出的 AI 助手 + 採購清單 */
function TabletPanel({ chat }) {
  const panel = useLayout((s) => s.panel)
  const close = useLayout((s) => s.close)
  const open = panel === 'ai' || panel === 'bom'
  return (
    <>
      <div
        onClick={close}
        className={`absolute inset-0 z-20 bg-ink-950/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <aside
        id="side-panel"
        aria-label="AI 助手與採購清單"
        aria-hidden={!open}
        inert={!open}
        className={`absolute inset-y-0 right-0 z-30 w-[380px] max-w-[92vw] flex flex-col bg-ink-900 border-l border-white/[0.08] shadow-2xl shadow-black/60 transition-transform duration-250 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <CopilotPanel chat={chat} />
        <BomPanel />
      </aside>
    </>
  )
}

/** 手機：底部面板（AI 助手／採購清單分頁） */
function MobileSheet({ chat }) {
  const panel = useLayout((s) => s.panel)
  const openPanel = useLayout((s) => s.open)
  const close = useLayout((s) => s.close)
  const open = panel === 'ai' || panel === 'bom'
  const count = useStore((s) => s.items.length)
  const [tab, setTab] = useState('ai')
  useEffect(() => {
    if (panel === 'ai' || panel === 'bom') setTab(panel)
  }, [panel])

  return (
    <div className={`fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div onClick={close} className={`absolute inset-0 bg-ink-950/55 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <section
        role="dialog"
        aria-label={tab === 'ai' ? 'AI 助手' : '採購清單'}
        className={`absolute inset-x-0 bottom-0 h-[78%] flex flex-col rounded-t-2xl bg-ink-900 border-t border-white/[0.08] shadow-[0_-20px_60px_-10px_rgba(0,0,0,.7)] transition-transform duration-250 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="shrink-0 pt-2 pb-1.5 px-3 flex items-center gap-2 border-b border-white/5">
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-white/15" />
          <div className="mt-2 flex p-0.5 rounded-lg bg-ink-800 border border-white/5">
            {[
              ['ai', 'AI 助手'],
              ['bom', `採購清單${count ? ` (${count})` : ''}`],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => openPanel(k)}
                aria-pressed={tab === k}
                className={`h-8 px-3 rounded-md text-xs font-semibold transition ${tab === k ? 'bg-ink-600 text-white' : 'text-ink-300'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={close} aria-label="收起面板" className="mt-2 ml-auto size-9 grid place-items-center rounded-lg text-ink-300 hover:text-white hover:bg-white/5">
            <IconChevron size={18} />
          </button>
        </div>
        {tab === 'ai' ? <CopilotPanel chat={chat} /> : <BomPanel full />}
      </section>
    </div>
  )
}

/** 手機：底部導覽列 */
function MobileNav() {
  const panel = useLayout((s) => s.panel)
  const toggle = useLayout((s) => s.toggle)
  const count = useStore((s) => s.items.length)
  const items = [
    { key: 'parts', label: '零件', icon: <IconBox size={20} /> },
    { key: 'ai', label: 'AI 助手', icon: <IconSparkle size={20} /> },
    { key: 'bom', label: '採購清單', icon: <IconCart size={20} />, badge: count },
  ]
  return (
    <nav aria-label="主要功能" className="relative z-40 shrink-0 grid grid-cols-3 h-14 box-content pb-[env(safe-area-inset-bottom)] border-t border-white/[0.08] bg-ink-900/95 backdrop-blur-xl">
      {items.map((it) => {
        const active = panel === it.key
        return (
          <button
            key={it.key}
            onClick={() => toggle(it.key)}
            aria-pressed={active}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${active ? 'text-brand-soft' : 'text-ink-300'}`}
          >
            <span className="relative">
              {it.icon}
              {it.badge > 0 && (
                <span className="absolute -top-1.5 -right-3 min-w-4 h-4 px-1 rounded-full bg-brand text-ink-950 text-[9px] font-bold font-mono grid place-items-center">
                  {it.badge > 99 ? '99+' : it.badge}
                </span>
              )}
            </span>
            {it.label}
            {active && <span className="absolute top-0 inset-x-6 h-0.5 rounded-full bg-brand" />}
          </button>
        )
      })}
    </nav>
  )
}

function CanvasArea({ onTry, bp }) {
  const ref = useRef()
  const [dragOver, setDragOver] = useState(false)
  const count = useStore((s) => s.items.length)
  const snapHint = useStore((s) => s.snapHint)

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const partId = e.dataTransfer.getData('application/x-buildm8-part')
    if (!partId || !registry.dropAt) return
    const p = registry.dropAt(e.clientX, e.clientY, ref.current.getBoundingClientRect())
    if (!p) return
    const { packageId, addPart, gridStep } = useStore.getState()
    const def = getPackage(packageId).parts.find((d) => d.id === partId)
    const g = (gridStep || 0.1) * 10
    addPart(partId, {
      position: [Math.round(p[0] / g) * g, restY(def, defaultParams(def)), Math.round(p[2] / g) * g],
    })
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#1b2028_0%,#0e1115_60%,#0b0d10_100%)]"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-buildm8-part')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Workspace />

      {/* 左上狀態 */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <div className="panel rounded-lg px-2.5 h-7 flex items-center gap-1.5 text-[11px] text-ink-300">
          <IconBox size={13} /> <b className="text-white font-semibold">{count}</b> 個零件
        </div>
        {snapHint && (
          <div className="rounded-lg px-2.5 h-7 flex items-center gap-1.5 text-[11px] font-semibold bg-brand text-ink-950 animate-rise">
            🧲 {snapHint.kind === 'port' ? '管口接合' : snapHint.kind === 'pin' ? '套入螺條' : '對準孔位'}
          </div>
        )}
      </div>

      <CanvasToolbar />
      {bp === 'desktop' && <ShortcutHint />}

      {count === 0 && <EmptyState onTry={onTry} bp={bp} />}
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-brand/60 bg-brand/[0.04] grid place-items-center">
          <div className="text-brand-soft text-sm font-semibold">放開以加入零件</div>
        </div>
      )}
      <Inspector />
    </div>
  )
}

function EmptyState({ onTry, bp }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="pointer-events-auto text-center max-w-sm px-6 animate-rise">
        <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 grid place-items-center text-ink-950 shadow-[0_10px_40px_-10px_rgba(245,158,11,.8)]">
          <IconSparkle size={26} />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">像拼樂高一樣做 DIY</h1>
        <p className="mt-1.5 text-[13px] text-ink-300 leading-relaxed">
          {bp === 'mobile' ? (
            <>
              點下方「零件」加入五金行標準件，
              <br />
              或打開「AI 助手」說出你想做什麼。
            </>
          ) : bp === 'tablet' ? (
            <>
              點左側零件庫加入五金行標準件，
              <br />
              或打開右上角「AI 助手」說出你想做什麼。
            </>
          ) : (
            <>
              從左側拖曳五金行標準件到畫布，
              <br />
              或直接告訴右邊的 AI 你想做什麼。
            </>
          )}
        </p>
        <button
          onClick={onTry}
          className="mt-4 h-9 px-4 rounded-xl text-sm font-semibold bg-white text-ink-950 hover:bg-ink-100 transition"
        >
          ⚡ 一鍵生成方形框架試試看
        </button>
      </div>
    </div>
  )
}

function ShortcutHint() {
  const [open, setOpen] = useState(false)
  const rows = [
    ['G', '移動模式'],
    ['R', '旋轉模式'],
    ['M', '孔洞磁吸開關'],
    ['[', '收合／展開零件庫'],
    ['Del', '刪除'],
    ['⌘/Ctrl D', '複製'],
    ['⌘/Ctrl Z', '復原'],
    ['Esc', '取消選取'],
    ['滑鼠左鍵拖曳', '旋轉視角'],
    ['右鍵拖曳', '平移視角'],
  ]
  return (
    <div className="absolute bottom-4 left-3">
      {open && (
        <div className="panel rounded-xl p-3 mb-2 w-52 animate-rise">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-0.5 text-[11px]">
              <span className="text-ink-300">{v}</span>
              <span className="kbd">{k}</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} className="panel rounded-lg h-8 px-2.5 flex items-center gap-1.5 text-[11px] text-ink-300 hover:text-white">
        <IconKeyboard size={14} /> 快捷鍵
      </button>
    </div>
  )
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.duplicate(s.selectedId)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        s.removeItem(s.selectedId)
      } else if (e.key === 'Escape') {
        if (useLayout.getState().panel) useLayout.getState().close()
        else s.select(null)
      } else if (!mod && (e.key === 'g' || e.key === 't')) {
        s.setMode('translate')
      } else if (!mod && e.key === 'r') {
        s.setMode('rotate')
      } else if (!mod && e.key === 'm') {
        s.toggleMagnet()
      } else if (!mod && !e.altKey && e.key === '[') {
        e.preventDefault()
        useSidebar.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
