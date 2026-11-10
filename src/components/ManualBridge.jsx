import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { assemblyForPrompt, buildManualPrompt, buildRevisionPrompt, parseAssemblyText } from '../ai/copilot'
import { STYLE_VOCABULARY } from '../ai/designGuide'
import { captureThumbnail, copyScreenshot, downloadScreenshot } from '../three/capture'
import { IconCheck, IconCopy, IconX } from './Icons'

const EXAMPLES = ['我想做一個放在桌上的手機架', '用 4 分水管做一個掛衣架，寬 60 公分', '做一個 3 層的小盆栽架']
const FEEDBACK_EXAMPLES = ['整體再高一點、比例更修長', '換成工業風的感覺', '零件種類再少一點，新手好做', '看起來太空，加一層層板']

/**
 * 「用我的 Claude 帳號生成」：
 *   新設計：① 描述需求（可選風格、附參考圖）→ ② 複製提示詞，貼到 claude.ai → ③ 把回覆的 JSON 貼回來拼裝
 *   修改設計：① 說說想怎麼改 → ② 複製截圖與修改提示詞（含目前設計 JSON）→ ③ 貼回修改後的 JSON
 * 完全不呼叫 API，因此不需要金鑰、不產生 API 費用（使用者用自己的 Claude 訂閱）。
 */
export function ManualBridgeDialog({ initialRequest = '', initialMode = 'new', onClose, onImport }) {
  const packageId = useStore((s) => s.packageId)
  const items = useStore((s) => s.items)
  const lastAssembly = useStore((s) => s.lastAssembly)
  const pkg = getPackage(packageId)
  const hasDesign = items.length > 0
  const [mode, setMode] = useState(initialMode === 'revise' && hasDesign ? 'revise' : 'new')
  const [request, setRequest] = useState(initialRequest)
  const [feedback, setFeedback] = useState('')
  const [style, setStyle] = useState('')
  const [withImages, setWithImages] = useState(false)
  const [sameChat, setSameChat] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shot, setShot] = useState({ status: '', thumb: '' })
  const [showPrompt, setShowPrompt] = useState(false)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const promptRef = useRef(null)
  const dialogRef = useRef(null)
  const revise = mode === 'revise'
  const styleLabel = STYLE_VOCABULARY.find((s) => s.key === style)?.label

  const prompt = useMemo(() => {
    if (!revise) return request.trim() ? buildManualPrompt(request, pkg, { style: styleLabel, withImages }) : ''
    if (!items.length) return ''
    const assembly = assemblyForPrompt(items, lastAssembly ?? {})
    return buildRevisionPrompt({ assembly, feedback, pkg, style: styleLabel, withScreenshot: true, sameChat })
  }, [revise, request, feedback, pkg, styleLabel, withImages, sameChat, items, lastAssembly])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    dialogRef.current?.querySelector('textarea')?.focus({ preventScroll: true })
  }, [mode])

  useEffect(() => setCopied(false), [prompt])

  const refreshThumb = useCallback(() => {
    try {
      setShot((s) => ({ ...s, thumb: captureThumbnail(480) }))
    } catch {
      setShot((s) => ({ ...s, thumb: '' }))
    }
  }, [])

  // 進入修改模式時擷取縮圖預覽
  useEffect(() => {
    if (!revise || !hasDesign) return
    // 稍等鏡頭動畫 / 面板轉場結束再擷取
    const id = setTimeout(refreshThumb, 300)
    return () => clearTimeout(id)
  }, [revise, hasDesign, items, refreshThumb])

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

  const shotLabel = `BuildM8 · ${items.length} 個零件${lastAssembly?.title ? ` · ${lastAssembly.title}` : ''}`
  const doShot = useCallback(
    async (kind) => {
      refreshThumb()
      try {
        const r = kind === 'copy' ? await copyScreenshot({ label: shotLabel }) : await downloadScreenshot({ label: shotLabel })
        // 按「複製」卻只能下載 → fallback；直接按「下載」→ downloaded
        setShot((s) => ({ ...s, status: kind === 'copy' && r === 'downloaded' ? 'fallback' : r }))
      } catch (e) {
        setShot((s) => ({ ...s, status: 'error' }))
        setError(e.message || '截圖失敗')
      }
    },
    [shotLabel, refreshThumb],
  )

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
      onImport(raw, revise ? `修改設計：${feedback.trim() || '依設計指南改善'}` : request)
    } catch (e) {
      setError(e.message)
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setShowPrompt(false)
    setError('')
  }

  const styleChips = (
    <div className="mt-2.5">
      <div className="text-[11px] text-ink-400 mb-1.5">風格（可不選）</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="風格">
        {STYLE_VOCABULARY.map((s) => {
          const on = style === s.key
          return (
            <button
              key={s.key}
              type="button"
              data-testid={`style-${s.key}`}
              aria-pressed={on}
              title={`${s.idea}：${s.parts}`}
              onClick={() => setStyle(on ? '' : s.key)}
              className={`h-7 px-2.5 rounded-full text-[11.5px] border transition ${
                on ? 'bg-brand/15 border-brand/50 text-brand-soft font-semibold' : 'bg-ink-800 border-white/5 text-ink-300 hover:text-white hover:border-white/20'
              }`}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      {styleLabel && (
        <p className="mt-1.5 text-[11px] text-ink-400 leading-relaxed">
          {STYLE_VOCABULARY.find((s) => s.key === style).idea}：{STYLE_VOCABULARY.find((s) => s.key === style).parts}
        </p>
      )}
    </div>
  )

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
        <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-start gap-3">
            <div className="size-9 shrink-0 rounded-xl bg-violet-500/15 grid place-items-center text-lg" aria-hidden>
              {revise ? '✏️' : '📋'}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="manual-bridge-title" className="text-[15px] font-semibold">
                {revise ? '請 Claude 修改這個設計' : '用我的 Claude 帳號生成'}
              </h2>
              <p className="text-[11.5px] text-ink-400 leading-relaxed mt-0.5">
                {revise
                  ? '把畫面截圖和目前設計交給 claude.ai，讓它依設計指南評論並改良，再把新版貼回來。'
                  : '把提示詞貼到 claude.ai，用你自己的訂閱產生設計，再把結果貼回來。不經過 API，不需要金鑰，也不會產生 API 費用。'}
              </p>
            </div>
            <button onClick={onClose} aria-label="關閉" className="size-8 shrink-0 grid place-items-center rounded-lg text-ink-400 hover:text-white hover:bg-white/5">
              <IconX size={16} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 p-0.5 rounded-lg bg-ink-800 border border-white/5" role="tablist" aria-label="模式">
            {[
              ['new', '新設計'],
              ['revise', '修改目前設計'],
            ].map(([k, l]) => (
              <button
                key={k}
                role="tab"
                data-testid={`bridge-mode-${k}`}
                aria-selected={mode === k}
                disabled={k === 'revise' && !hasDesign}
                title={k === 'revise' && !hasDesign ? '畫布上還沒有設計' : undefined}
                onClick={() => switchMode(k)}
                className={`h-8 rounded-md text-[12px] font-semibold transition disabled:opacity-40 ${mode === k ? 'bg-ink-600 text-white' : 'text-ink-300 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 sm:px-5 py-4 space-y-5">
          {!revise ? (
            <Step n={1} title="描述你想做的東西">
              <textarea
                data-testid="manual-request"
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
              {styleChips}
              <label className="mt-2.5 flex items-start gap-2 text-[12px] text-ink-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="with-images"
                  checked={withImages}
                  onChange={(e) => setWithImages(e.target.checked)}
                  className="mt-0.5 size-4 accent-amber-400"
                />
                <span>
                  我會附上參考圖片
                  <span className="block text-[11px] text-ink-400">在 claude.ai 直接貼上 Pinterest / IG 的圖片，Claude 會先分析風格、比例與接合方式。</span>
                </span>
              </label>
            </Step>
          ) : (
            <Step n={1} title="說說你想怎麼改">
              <textarea
                data-testid="revision-feedback"
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="例：整體再高一點，螺帽不要那麼多（可留空，讓 Claude 依設計指南自行改善）"
                className="w-full resize-none rounded-lg bg-ink-800 border border-white/10 px-3 py-2 text-[13px] placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              {!feedback.trim() && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {FEEDBACK_EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setFeedback(ex)} className="h-7 px-2.5 rounded-full text-[11px] bg-ink-800 border border-white/5 text-ink-300 hover:text-white hover:border-brand/40">
                      {ex}
                    </button>
                  ))}
                </div>
              )}
              {styleChips}
            </Step>
          )}

          <Step n={2} title={revise ? '複製截圖與修改提示詞，貼到 claude.ai' : '複製提示詞，貼到 claude.ai'}>
            {revise && (
              <div className="mb-3 flex gap-3 items-start">
                <div className="w-28 sm:w-36 shrink-0 relative aspect-[4/3] rounded-lg overflow-hidden border border-white/10 bg-ink-950 grid place-items-center">
                  {shot.thumb ? (
                    <img src={shot.thumb} alt="目前 3D 畫面的截圖預覽" className="absolute inset-0 w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-ink-400">截圖預覽</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <button
                      data-testid="copy-screenshot"
                      onClick={() => doShot('copy')}
                      className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 transition ${
                        shot.status === 'copied' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30' : 'bg-white text-ink-950 hover:bg-ink-100'
                      }`}
                    >
                      {shot.status === 'copied' ? <IconCheck size={14} /> : <span aria-hidden>📷</span>}
                      {shot.status === 'copied' ? '已複製截圖' : '複製截圖'}
                    </button>
                    <button
                      data-testid="download-screenshot"
                      onClick={() => doShot('download')}
                      className="h-9 px-3 rounded-lg text-[12.5px] font-medium bg-ink-800 border border-white/10 hover:border-white/25"
                    >
                      下載截圖
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-400 leading-relaxed" aria-live="polite">
                    {shot.status === 'fallback'
                      ? '這個瀏覽器不能複製圖片，已改為下載，請把圖檔拖進或上傳到 claude.ai。'
                      : shot.status === 'downloaded'
                        ? '已下載截圖，請把圖檔拖進或上傳到 claude.ai。'
                        : shot.status === 'copied'
                          ? '已複製截圖，到 claude.ai 的輸入框按 Ctrl/⌘ + V 貼上。'
                          : '截取目前的 3D 視角，可先旋轉畫面到最能看出問題的角度。'}
                  </p>
                </div>
              </div>
            )}
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
                {copied ? '已複製提示詞' : revise ? '複製修改提示詞' : '複製提示詞'}
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
            {revise && (
              <label className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-300 cursor-pointer select-none">
                <input type="checkbox" checked={sameChat} onChange={(e) => setSameChat(e.target.checked)} className="size-4 accent-amber-400" />
                在原本產生設計的 Claude 對話接續（不重附零件目錄，提示詞較短）
              </label>
            )}
            <p className="mt-1.5 text-[11px] text-ink-400 leading-relaxed">
              {revise
                ? '剪貼簿一次只能放一樣東西：先複製截圖、在 claude.ai 貼上，再回來複製提示詞貼上後送出。'
                : `在 claude.ai 開一個新對話，${withImages ? '先貼上參考圖片，再' : ''}貼上提示詞後送出。`}
              {prompt ? `提示詞約 ${Math.round(prompt.length / 1000)}k 字元；` : ''}
              Claude 會依序以設計師、工程師、檢查員的角度思考，最後輸出一段 JSON。
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

          <Step n={3} title={revise ? '把修改後的回覆貼回來' : '把 Claude 的回覆貼回來'}>
            <textarea
              data-testid="manual-paste"
              rows={5}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value)
                setError('')
              }}
              placeholder={'把 Claude 回覆的整段內容貼在這裡\n（有沒有 ```json 程式碼框都可以，會自動取最後一段完整設計）'}
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
            {revise ? '套用修改' : '拼裝到畫布'}
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
