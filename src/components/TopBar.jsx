import { useStore } from '../store/useStore'
import { PACKAGE_CATALOG } from '../data/packages'
import { selectKeyStatus, useKeyStore } from '../store/useKeyStore'
import { useLayout } from '../store/useLayout'
import { IconKey, IconLock, IconMagnet, IconMove, IconRedo, IconRotate, IconSparkle, IconTrash, IconUndo } from './Icons'

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
        <div className="text-[15px] font-bold tracking-tight whitespace-nowrap">
          Build<span className="text-brand">M8</span>
        </div>
        <div className="hidden sm:block whitespace-nowrap text-[10px] text-ink-400 mt-0.5 tracking-wide">五金樂高 · AI 共創</div>
      </div>
    </div>
  )
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="flex items-center p-0.5 rounded-lg bg-ink-800 border border-white/5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition ${
            value === o.value ? 'bg-ink-600 text-white shadow-sm' : 'text-ink-300 hover:text-white'
          }`}
        >
          {o.icon}
          {o.icon ? <span className="hidden xl:inline">{o.label}</span> : o.label}
        </button>
      ))}
    </div>
  )
}

export function TopBar({ onMockGenerate, generating }) {
  const { packageId, mode, setMode, gridStep, setGridStep, magnet, toggleMagnet, undo, redo, clear, past, future, items } =
    useStore()

  return (
    <header className="h-14 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pt-[env(safe-area-inset-top)] box-content border-b border-white/[0.06] bg-ink-900/90 backdrop-blur-xl z-20">
      <Logo />
      <div className="hidden md:block lg:hidden xl:block w-px h-6 bg-white/10 mx-1" />

      <label className="relative hidden md:block lg:hidden xl:block">
        <select
          value={packageId}
          onChange={() => {}}
          className="appearance-none h-8 max-w-[190px] xl:max-w-[260px] truncate pl-3 pr-8 rounded-lg bg-ink-800 border border-white/5 text-xs font-medium hover:border-white/15 focus:outline-none focus:ring-2 focus:ring-brand/40"
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

      <div className="flex-1 lg:hidden" />
      <div className="hidden lg:flex flex-1 items-center justify-center gap-2">
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
          <IconMagnet size={14} /> <span className="hidden xl:inline whitespace-nowrap">孔洞磁吸</span>
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

      <PanelButton />
      <KeyButton />

      <button
        onClick={onMockGenerate}
        disabled={generating}
        className="group relative shrink-0 h-9 pl-3 pr-3.5 sm:pr-4 rounded-xl text-sm font-semibold text-ink-950 bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_6px_24px_-6px_rgba(245,158,11,.7)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-60 flex items-center gap-2 overflow-hidden"
      >
        <span className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100" />
        <IconSparkle size={16} />
        <span className="hidden xl:inline whitespace-nowrap">AI 模擬生成</span>
        <span className="xl:hidden whitespace-nowrap">生成</span>
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

/** 頂部「AI 金鑰」入口：顯示目前狀態，點擊開啟設定（上鎖時開啟解鎖畫面） */
function KeyButton() {
  const status = useKeyStore(selectKeyStatus)
  const openSettings = useKeyStore((s) => s.openSettings)
  const openUnlock = useKeyStore((s) => s.openUnlock)
  const dot = { none: 'bg-ink-400', unlocked: 'bg-emerald-400', locked: 'bg-amber-400' }[status]
  const label = { none: '未設定金鑰', unlocked: '金鑰已解鎖', locked: '金鑰已上鎖' }[status]
  return (
    <button
      data-testid="topbar-key"
      onClick={status === 'locked' ? openUnlock : openSettings}
      title={`AI 設定 · ${label}`}
      aria-label={`AI 設定（${label}）`}
      className="shrink-0 h-9 sm:h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border bg-ink-800 border-white/5 text-ink-300 hover:text-white hover:border-white/15 transition"
    >
      {status === 'locked' ? <IconLock size={14} /> : <IconKey size={14} />}
      <span className="hidden sm:inline whitespace-nowrap">AI 設定</span>
      <span className={`size-1.5 rounded-full ${dot}`} />
    </button>
  )
}

/** 平板：開關右側「AI 助手／採購清單」面板 */
function PanelButton() {
  const panel = useLayout((s) => s.panel)
  const toggle = useLayout((s) => s.toggle)
  const count = useStore((s) => s.items.length)
  const open = panel === 'ai' || panel === 'bom'
  return (
    <button
      onClick={() => toggle('ai')}
      aria-expanded={open}
      aria-controls="side-panel"
      title="AI 助手與採購清單"
      className={`hidden md:flex lg:hidden shrink-0 h-8 px-2.5 rounded-lg text-xs font-medium items-center gap-1.5 border transition ${
        open ? 'bg-brand/15 border-brand/40 text-brand-soft' : 'bg-ink-800 border-white/5 text-ink-300 hover:text-white'
      }`}
    >
      <IconSparkle size={14} /> <span className="whitespace-nowrap">AI 助手</span>
      {count > 0 && <span className="text-[10px] font-mono px-1 rounded bg-white/10">{count}</span>}
    </button>
  )
}

/** 平板／手機：畫布右上角的浮動工具列（桌面版放在頂部列） */
export function CanvasToolbar() {
  const { mode, setMode, gridStep, setGridStep, magnet, toggleMagnet, undo, redo, clear, past, future, items } = useStore()
  const nextGrid = { 1: 0.5, 0.5: 0, 0: 1 }[gridStep] ?? 1
  const gridLabel = gridStep ? `${gridStep}cm` : '自由'
  const btn = 'size-10 md:size-9 grid place-items-center rounded-lg transition disabled:opacity-30'
  return (
    <div className="lg:hidden absolute top-3 right-3 panel rounded-xl p-1 flex flex-col gap-0.5 z-10">
      <button
        onClick={() => setMode(mode === 'translate' ? 'rotate' : 'translate')}
        title={mode === 'translate' ? '目前：移動（點擊切換為旋轉）' : '目前：旋轉（點擊切換為移動）'}
        aria-label={mode === 'translate' ? '切換為旋轉模式' : '切換為移動模式'}
        className={`${btn} bg-white/[0.06] text-white`}
      >
        {mode === 'translate' ? <IconMove size={17} /> : <IconRotate size={17} />}
      </button>
      <button
        onClick={toggleMagnet}
        aria-pressed={magnet}
        title="孔洞磁吸"
        aria-label="孔洞磁吸"
        className={`${btn} ${magnet ? 'text-brand-soft bg-brand/15' : 'text-ink-300 hover:text-white'}`}
      >
        <IconMagnet size={17} />
      </button>
      <button
        onClick={() => setGridStep(nextGrid)}
        title={`網格：${gridLabel}（點擊切換）`}
        aria-label={`網格吸附：${gridLabel}`}
        className={`${btn} text-[10px] font-mono font-semibold ${gridStep ? 'text-ink-100' : 'text-ink-400'}`}
      >
        {gridLabel}
      </button>
      <div className="h-px mx-1.5 my-0.5 bg-white/10" />
      <button onClick={undo} disabled={!past.length} title="復原" aria-label="復原" className={`${btn} text-ink-300 hover:text-white`}>
        <IconUndo size={17} />
      </button>
      <button onClick={redo} disabled={!future.length} title="重做" aria-label="重做" className={`${btn} text-ink-300 hover:text-white`}>
        <IconRedo size={17} />
      </button>
      <button onClick={clear} disabled={!items.length} title="清空畫布" aria-label="清空畫布" className={`${btn} text-ink-300 hover:text-white`}>
        <IconTrash size={17} />
      </button>
    </div>
  )
}
