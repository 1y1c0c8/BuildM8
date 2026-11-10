import { useStore } from '../store/useStore'
import { PACKAGE_CATALOG } from '../data/packages'
import { IconMagnet, IconMove, IconRedo, IconRotate, IconSparkle, IconTrash, IconUndo } from './Icons'

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative size-8 grid place-items-center">
        <svg viewBox="0 0 32 32" className="absolute inset-0 size-8 drop-shadow-[0_0_12px_rgba(245,158,11,.45)]">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <polygon points="16,1.5 29,9 29,23 16,30.5 3,23 3,9" fill="url(#lg)" />
          <circle cx="16" cy="16" r="5.6" fill="#0b0d10" />
        </svg>
      </div>
      <div className="leading-none">
        <div className="text-[15px] font-bold tracking-tight">
          Build<span className="text-brand">M8</span>
        </div>
        <div className="text-[10px] text-ink-400 mt-0.5 tracking-wide">五金樂高 · AI 共創</div>
      </div>
    </div>
  )
}

function Seg({ value, onChange, options }) {
  return (
    <div className="flex items-center p-0.5 rounded-lg bg-ink-800 border border-white/5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
            value === o.value ? 'bg-ink-600 text-white shadow-sm' : 'text-ink-300 hover:text-white'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TopBar({ onMockGenerate, generating }) {
  const { packageId, mode, setMode, gridStep, setGridStep, magnet, toggleMagnet, undo, redo, clear, past, future, items } =
    useStore()

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-white/[0.06] bg-ink-900/90 backdrop-blur-xl z-20">
      <Logo />
      <div className="w-px h-6 bg-white/10 mx-1" />

      <label className="relative">
        <select
          value={packageId}
          onChange={() => {}}
          className="appearance-none h-8 pl-3 pr-8 rounded-lg bg-ink-800 border border-white/5 text-xs font-medium hover:border-white/15 focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          {PACKAGE_CATALOG.map((p) => (
            <option key={p.packageId} value={p.packageId} disabled={!p.available}>
              {p.label}
              {p.available ? '' : '（即將推出）'}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 text-[10px]">▼</span>
      </label>

      <div className="flex-1 flex items-center justify-center gap-2">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { value: 'translate', label: '移動', icon: <IconMove size={14} />, title: '移動 (G)' },
            { value: 'rotate', label: '旋轉', icon: <IconRotate size={14} />, title: '旋轉 (R)' },
          ]}
        />
        <Seg
          value={gridStep}
          onChange={setGridStep}
          options={[
            { value: 1, label: '1cm', title: '網格 1 cm' },
            { value: 0.5, label: '0.5cm', title: '網格 0.5 cm' },
            { value: 0, label: '自由', title: '關閉網格吸附' },
          ]}
        />
        <button
          onClick={toggleMagnet}
          title="孔洞磁吸 (M)"
          className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
            magnet ? 'bg-brand/15 border-brand/40 text-brand-soft' : 'bg-ink-800 border-white/5 text-ink-300 hover:text-white'
          }`}
        >
          <IconMagnet size={14} /> 孔洞磁吸
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <IconBtn title="復原 (Ctrl+Z)" onClick={undo} disabled={!past.length}>
          <IconUndo size={15} />
        </IconBtn>
        <IconBtn title="重做 (Ctrl+Shift+Z)" onClick={redo} disabled={!future.length}>
          <IconRedo size={15} />
        </IconBtn>
        <IconBtn title="清空畫布" onClick={clear} disabled={!items.length}>
          <IconTrash size={15} />
        </IconBtn>
      </div>

      <button
        onClick={onMockGenerate}
        disabled={generating}
        className="group relative h-9 pl-3 pr-4 rounded-xl text-sm font-semibold text-ink-950 bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_6px_24px_-6px_rgba(245,158,11,.7)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-60 flex items-center gap-2 overflow-hidden"
      >
        <span className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100" />
        <IconSparkle size={16} />
        AI 模擬生成
      </button>
    </header>
  )
}

function IconBtn({ children, ...p }) {
  return (
    <button
      {...p}
      className="size-8 grid place-items-center rounded-lg text-ink-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition"
    >
      {children}
    </button>
  )
}
