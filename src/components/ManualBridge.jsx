import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { buildManualPrompt, parseAssemblyText } from '../ai/copilot'
import { IconCheck, IconCopy, IconX } from './Icons'

const EXAMPLES = ['我想做一個放在桌上的手機架', '用 4 分水管做一個掛衣架，寬 60 公分', '做一個 3 層的小盆栽架']

/**
 * 「用我的 Claude 帳號生成」：
 *   ① 描述需求 → ② 複製提示詞，貼到 claude.ai → ③ 把回覆的 JSON 貼回來拼裝
 * 完全不呼叫 API，因此不需要金鑰、不產生 API 費用（使用者用自己的 Claude 訂閱）。
 */
export function ManualBridgeDialog({ initialRequest = '', onClose, onImport }) {
  const packageId = useStore((s) => s.packageId)
  const pkg = getPackage(packageId)
  const [request, setRequest] = useState(initialRequest)
  const [copied, setCopied] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const promptRef = useRef(null)
  const dialogRef = useRef(null)

  const prompt = useMemo(() => (request.trim() ? buildManualPrompt(request, pkg) : ''), [request, pkg])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    dialogRef.current?.querySelector('textarea')?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => setCopied(false), [prompt])

  const copyPrompt = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      // 剪貼簿不可用（例如非 HTTPS 或瀏覽器拒絕）：展開全文讓使用者手動複製
      setShowPrompt(true)
      requestAnimationFrame(() => promptRef.current?.select())
    }
  }

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) {
        setPasted(t)
        setError('')
      }
    } catch {
      setError('瀏覽器不允許讀取剪貼簿，請直接在下方框內貼上（Ctrl/⌘ + V）。')
    }
  }

  const doImport = () => {
    try {
      const raw = parseAssemblyText(pasted)
      onImport(raw, request)
    } catch (e) {
      setError(e.message)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-4 bg-ink-950/70 backdrop-blur-sm animate-rise"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-bridge-title"
        className="panel w-full max-w-[560px] max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-2xl"
      >
        <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 flex items-start gap-3 border-b border-white/5">
          <div className="size-9 shrink-0 rounded-xl bg-violet-500/15 grid place-items-center text-lg" aria-hidden>
            📋
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="manual-bridge-title" className="text-[15px] font-semibold">
              用我的 Claude 帳號生成
            </h2>
            <p className="text-[11.5px] text-ink-400 leading-relaxed mt-0.5">
              把提示詞貼到 claude.ai，用你自己的訂閱產生設計，再把結果貼回來。不經過 API，不需要金鑰，也不會產生 API 費用。
            </p>
          </div>
          <button onClick={onClose} aria-label="關閉" className="size-8 shrink-0 grid place-items-center rounded-lg text-ink-400 hover:text-white hover:bg-white/5">
            <IconX size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 sm:px-5 py-4 space-y-5">
          {/* ① 需求 */}
          <Step n={1} title="描述你想做的東西">
            <textarea
              rows={2}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="例：我想做一個放在桌上的手機架"
              className="w-full resize-none rounded-lg bg-ink-800 border border-white/10 px-3 py-2 text-[13px] placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            {!request.trim() && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setRequest(ex)} className="h-7 px-2.5 rounded-full text-[11px] bg-ink-800 border border-white/5 text-ink-300 hover:text-white hover:border-brand/40">
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </Step>

          {/* ② 複製提示詞 */}
          <Step n={2} title="複製提示詞，貼到 claude.ai">
            <div className="flex flex-wrap gap-2">
              <button
                data-testid="copy-manual-prompt"
                onClick={copyPrompt}
                disabled={!prompt}
                className={`h-9 px-3.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 transition disabled:opacity-40 ${
                  copied ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30' : 'bg-white text-ink-950 hover:bg-ink-100'
                }`}
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                {copied ? '已複製提示詞' : '複製提示詞'}
              </button>
              <a
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium flex items-center gap-1.5 bg-ink-800 border border-white/10 hover:border-white/25"
              >
                開啟 claude.ai ↗
              </a>
              <button
                onClick={() => setShowPrompt((v) => !v)}
                disabled={!prompt}
                className="h-9 px-2 text-[11.5px] text-ink-400 hover:text-white disabled:opacity-40"
              >
                {showPrompt ? '收起提示詞' : '查看提示詞'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-400 leading-relaxed">
              在 claude.ai 開一個新對話，貼上後送出。提示詞含零件目錄與格式規則{prompt ? `（約 ${Math.round(prompt.length / 1000)}k 字元）` : ''}，Claude 會只回覆一段 JSON。
            </p>
            {showPrompt && prompt && (
              <textarea
                ref={promptRef}
                readOnly
                value={prompt}
                rows={6}
                onFocus={(e) => e.target.select()}
                className="mt-2 w-full rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-[10.5px] font-mono text-ink-300 focus:outline-none"
              />
            )}
          </Step>

          {/* ③ 貼回結果 */}
          <Step n={3} title="把 Claude 的回覆貼回來">
            <textarea
              data-testid="manual-paste"
              rows={5}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value)
                setError('')
              }}
              placeholder={'把 Claude 回覆的整段內容貼在這裡\n（有沒有 ```json 程式碼框都可以）'}
              className="w-full resize-y rounded-lg bg-ink-800 border border-white/10 px-3 py-2 text-[12px] font-mono placeholder:font-sans placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button onClick={pasteFromClipboard} className="h-8 px-3 rounded-lg text-[12px] bg-ink-800 border border-white/10 hover:border-white/25">
                從剪貼簿貼上
              </button>
              {pasted && <span className="text-[11px] text-ink-400">{pasted.length.toLocaleString()} 字元</span>}
            </div>
            {error && (
              <div role="alert" className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed bg-red-500/10 border border-red-400/20 text-red-200">
                {error}
              </div>
            )}
          </Step>
        </div>

        <div className="shrink-0 px-4 sm:px-5 py-3 flex items-center justify-end gap-2 border-t border-white/5">
          <button onClick={onClose} className="h-9 px-3 rounded-lg text-[13px] text-ink-300 hover:text-white">
            取消
          </button>
          <button
            data-testid="manual-import"
            onClick={doImport}
            disabled={!pasted.trim()}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-ink-950 bg-gradient-to-b from-amber-300 to-amber-500 hover:brightness-110 disabled:opacity-40"
          >
            拼裝到畫布
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Step({ n, title, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="size-5 rounded-full bg-brand/15 text-brand-soft text-[11px] font-bold font-mono grid place-items-center">{n}</span>
        <h3 className="text-[13px] font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  )
}
