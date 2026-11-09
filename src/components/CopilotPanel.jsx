import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { runCopilot, validateAssembly, STAGES } from '../ai/copilot'
import { IconCheck, IconCode, IconSend, IconSettings, IconSparkle, IconX } from './Icons'

const SUGGESTIONS = [
  { label: '⏰ 方形時鐘外殼', text: '我想做一個有厚度的方形時鐘外殼，大約 20 公分' },
  { label: '💿 CD 收納展示架', text: '我想做一個 CD 收納展示架' },
  { label: '🔲 簡易方形框架', text: '用角鐵和螺條做一個 30 公分的簡易方形框架' },
  { label: '🏭 工業風水管層架', text: '我想做一個工業風水管層架' },
]

const loadSettings = () => {
  try {
    return JSON.parse(localStorage.getItem('buildm8.ai') || '{}')
  } catch {
    return {}
  }
}

/** Chat 狀態 hook：讓頂部「AI 模擬生成」按鈕與聊天框共用同一條流程 */
export function useCopilotChat() {
  const [messages, setMessages] = useState([
    {
      id: 'hello',
      role: 'assistant',
      text: '嗨，我是你的五金共創夥伴 M8 👋\n告訴我你想做什麼，我會從「台灣五金行標準件包」挑零件，直接在畫布上幫你拼出來，並列出採購清單。',
    },
  ])
  const [stage, setStage] = useState(null)
  const [settings, setSettingsState] = useState(() => ({ mode: 'mock', apiKey: '', ...loadSettings() }))
  const busy = stage !== null

  const setSettings = (s) => {
    setSettingsState(s)
    try {
      localStorage.setItem('buildm8.ai', JSON.stringify(s))
    } catch {
      /* 私密視窗等情況忽略 */
    }
  }

  const send = useCallback(
    async (text) => {
      if (!text.trim() || busy) return
      const pkg = getPackage(useStore.getState().packageId)
      const uid = Math.random().toString(36).slice(2)
      setMessages((m) => [...m, { id: `u${uid}`, role: 'user', text }])
      setStage('parse')
      try {
        const res = await runCopilot(text, {
          pkg,
          mode: settings.mode === 'claude' && settings.apiKey ? 'claude' : 'mock',
          apiKey: settings.apiKey,
          onStage: setStage,
        })
        if (res.kind === 'clarify') {
          setMessages((m) => [...m, { id: `a${uid}`, role: 'assistant', text: res.text }])
        } else {
          useStore.getState().loadAssembly(res.assembly)
          setMessages((m) => [
            ...m,
            {
              id: `a${uid}`,
              role: 'assistant',
              text: res.assembly.summary,
              assembly: res.assembly,
              source: settings.mode === 'claude' && settings.apiKey ? 'Claude' : 'Mock',
            },
          ])
        }
      } catch (err) {
        setMessages((m) => [...m, { id: `e${uid}`, role: 'assistant', error: true, text: `生成失敗：${err.message}` }])
      } finally {
        setStage(null)
      }
    },
    [busy, settings],
  )

  /** 「AI 模擬生成」：直接讀取一段 Mock JSON（模擬 LLM 回傳），走同樣的驗證與拼裝流程 */
  const runMockJson = useCallback(
    async (json, label = 'AI 模擬生成：讀取 Mock JSON') => {
      if (busy) return
      const pkg = getPackage(useStore.getState().packageId)
      const uid = Math.random().toString(36).slice(2)
      setMessages((m) => [...m, { id: `u${uid}`, role: 'user', text: `⚡ ${label}` }])
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      for (const s of STAGES) {
        setStage(s.key)
        await wait(320)
      }
      const assembly = validateAssembly(json, pkg)
      useStore.getState().loadAssembly(assembly)
      setMessages((m) => [...m, { id: `a${uid}`, role: 'assistant', text: assembly.summary, assembly, source: 'Mock JSON' }])
      setStage(null)
    },
    [busy],
  )

  return { messages, send, runMockJson, stage, busy, settings, setSettings }
}

export function CopilotPanel({ chat }) {
  const { messages, send, stage, busy, settings, setSettings } = chat
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const listRef = useRef()

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, stage])

  const submit = (e) => {
    e?.preventDefault()
    send(input)
    setInput('')
  }

  return (
    <section className="flex-1 min-h-0 flex flex-col">
      <div className="h-12 shrink-0 px-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-gradient-to-br from-amber-300 to-orange-500 grid place-items-center text-ink-950">
            <IconSparkle size={14} />
          </div>
          <div className="text-sm font-semibold">AI Copilot</div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${
              settings.mode === 'claude' && settings.apiKey
                ? 'bg-violet-500/10 text-violet-300 border-violet-400/20'
                : 'bg-white/5 text-ink-300 border-white/10'
            }`}
          >
            {settings.mode === 'claude' && settings.apiKey ? 'Claude' : 'Mock'}
          </span>
        </div>
        <button onClick={() => setShowSettings((v) => !v)} className="size-7 grid place-items-center rounded-lg text-ink-400 hover:text-white hover:bg-white/5" title="AI 設定">
          <IconSettings size={15} />
        </button>
      </div>

      {showSettings && <SettingsCard settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 py-4 space-y-3">
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && <StageCard stage={stage} />}
      </div>

      <div className="px-3 pb-3 pt-1 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              disabled={busy}
              onClick={() => send(s.text)}
              className="shrink-0 h-7 px-2.5 rounded-full text-[11px] bg-ink-800 border border-white/5 text-ink-300 hover:text-white hover:border-brand/40 transition disabled:opacity-40"
            >
              {s.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="relative rounded-xl bg-ink-800 border border-white/[0.07] focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10 transition">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
            }}
            placeholder="例：我想做一個有厚度的方形時鐘外殼"
            className="w-full resize-none bg-transparent px-3 pt-2.5 pb-9 text-[13px] placeholder:text-ink-400 focus:outline-none"
          />
          <div className="absolute bottom-2 left-3 text-[10px] text-ink-400">Enter 送出 · Shift+Enter 換行</div>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="absolute bottom-2 right-2 size-7 rounded-lg bg-brand text-ink-950 grid place-items-center disabled:opacity-30 hover:brightness-110 transition"
          >
            <IconSend size={14} />
          </button>
        </form>
      </div>
    </section>
  )
}

function Message({ m }) {
  const [showJson, setShowJson] = useState(false)
  if (m.role === 'user') {
    return (
      <div className="flex justify-end animate-rise">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 bg-brand/90 text-ink-950 text-[13px] font-medium whitespace-pre-wrap">{m.text}</div>
      </div>
    )
  }
  return (
    <div className="animate-rise">
      <div className={`max-w-[95%] rounded-2xl rounded-bl-md px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap border ${m.error ? 'bg-red-500/10 border-red-400/20 text-red-200' : 'bg-ink-800 border-white/5 text-ink-100'}`}>
        {m.assembly && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-300 grid place-items-center">
              <IconCheck size={11} stroke={2.5} />
            </span>
            <span className="text-[13px] font-semibold text-white">{m.assembly.title}</span>
          </div>
        )}
        {m.text}
      </div>
      {m.assembly && (
        <div className="mt-2 rounded-xl border border-white/5 bg-ink-850 overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between text-[11px] text-ink-300 border-b border-white/5">
            <span>
              已拼裝 <b className="text-white">{m.assembly.items.length}</b> 個標準件 · {m.source}
            </span>
            <button onClick={() => setShowJson((v) => !v)} className="flex items-center gap-1 text-ink-300 hover:text-brand-soft">
              <IconCode size={12} /> {showJson ? '收合' : 'JSON'}
            </button>
          </div>
          {showJson ? (
            <pre className="max-h-56 overflow-auto scroll-thin p-3 text-[10.5px] leading-snug font-mono text-emerald-200/90">
              {JSON.stringify({ ...m.assembly, warnings: undefined, items: m.assembly.items.slice(0, 8), _more: m.assembly.items.length > 8 ? `…還有 ${m.assembly.items.length - 8} 個` : undefined }, null, 2)}
            </pre>
          ) : (
            <ol className="p-3 space-y-1.5">
              {m.assembly.steps?.map((s, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-ink-300">
                  <span className="shrink-0 size-4 rounded-full bg-white/5 text-[10px] font-mono grid place-items-center text-ink-300 mt-0.5">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          {m.assembly.warnings?.length > 0 && (
            <div className="px-3 pb-2 text-[11px] text-amber-300/90">⚠ {m.assembly.warnings.join('；')}</div>
          )}
        </div>
      )}
    </div>
  )
}

function StageCard({ stage }) {
  const idx = STAGES.findIndex((s) => s.key === stage)
  return (
    <div className="rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/[0.07] to-transparent p-3 animate-rise">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-brand-soft mb-2">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-brand" />
        </span>
        M8 正在設計…
      </div>
      <div className="space-y-1.5">
        {STAGES.map((s, i) => (
          <div key={s.key} className={`flex items-center gap-2 text-[12px] transition ${i < idx ? 'text-ink-300' : i === idx ? 'text-white' : 'text-ink-400/50'}`}>
            <span className={`size-4 rounded-full grid place-items-center border ${i < idx ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' : i === idx ? 'border-brand/60' : 'border-white/10'}`}>
              {i < idx ? <IconCheck size={10} stroke={3} /> : i === idx ? <span className="size-1.5 rounded-full bg-brand animate-pulse" /> : null}
            </span>
            {s.label}
            {i === idx && <span className="ml-auto h-1 w-16 rounded-full shimmer" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsCard({ settings, onChange, onClose }) {
  const [draft, setDraft] = useState(settings)
  return (
    <div className="mx-3 mt-3 rounded-xl border border-white/10 bg-ink-850 p-3 animate-rise">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold">AI 引擎</div>
        <button onClick={onClose} className="text-ink-400 hover:text-white">
          <IconX size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-ink-900 border border-white/5 mb-2">
        {[
          ['mock', 'Mock（離線示範）'],
          ['claude', 'Claude API'],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setDraft({ ...draft, mode: v })} className={`h-7 rounded-md text-[11px] font-medium ${draft.mode === v ? 'bg-ink-600 text-white' : 'text-ink-300'}`}>
            {l}
          </button>
        ))}
      </div>
      {draft.mode === 'claude' && (
        <>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder="sk-ant-…"
            className="w-full h-8 px-2.5 rounded-lg bg-ink-900 border border-white/10 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <p className="text-[10.5px] text-ink-400 mt-1.5 leading-relaxed">
            金鑰只存在你的瀏覽器 localStorage，並由瀏覽器直接呼叫 Anthropic API —— 僅適合本機原型；正式上線請改走後端代理。
          </p>
        </>
      )}
      <button
        onClick={() => {
          onChange(draft)
          onClose()
        }}
        className="mt-2 w-full h-8 rounded-lg bg-white text-ink-950 text-xs font-semibold hover:bg-ink-100"
      >
        儲存
      </button>
    </div>
  )
}
