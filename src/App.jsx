import { useEffect, useRef, useState } from 'react'
import Workspace from './three/Workspace'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { CopilotPanel, useCopilotChat } from './components/CopilotPanel'
import { BomPanel } from './components/BomPanel'
import { Inspector } from './components/Inspector'
import { IconKeyboard, IconSparkle, IconBox } from './components/Icons'
import { useStore } from './store/useStore'
import { useSidebar } from './store/useSidebar'
import { getPackage } from './data/packages'
import { restY, defaultParams } from './data/parts'
import { registry } from './three/registry'
import mockSquareFrame from './data/mock/square_frame.json'

export default function App() {
  const chat = useCopilotChat()
  useShortcuts()

  return (
    <div className="h-full flex flex-col">
      <TopBar generating={chat.busy} onMockGenerate={() => chat.runMockJson(mockSquareFrame, 'AI 模擬生成：讀取 mock/square_frame.json')} />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <main className="relative flex-1 min-w-0">
          <CanvasArea onTry={() => chat.runMockJson(mockSquareFrame, 'AI 模擬生成：讀取 mock/square_frame.json')} />
        </main>
        <aside className="w-[368px] shrink-0 flex flex-col border-l border-white/[0.06] bg-ink-900/70 backdrop-blur-xl z-10">
          <CopilotPanel chat={chat} />
          <BomPanel />
        </aside>
      </div>
    </div>
  )
}

function CanvasArea({ onTry }) {
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

      <ShortcutHint />

      {count === 0 && <EmptyState onTry={onTry} />}
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-brand/60 bg-brand/[0.04] grid place-items-center">
          <div className="text-brand-soft text-sm font-semibold">放開以加入零件</div>
        </div>
      )}
      <Inspector />
    </div>
  )
}

function EmptyState({ onTry }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="pointer-events-auto text-center max-w-sm animate-rise">
        <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 grid place-items-center text-ink-950 shadow-[0_10px_40px_-10px_rgba(245,158,11,.8)]">
          <IconSparkle size={26} />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">像拼樂高一樣做 DIY</h1>
        <p className="mt-1.5 text-[13px] text-ink-300 leading-relaxed">
          從左側拖曳五金行標準件到畫布，
          <br />
          或直接告訴右邊的 AI 你想做什麼。
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
        s.select(null)
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
