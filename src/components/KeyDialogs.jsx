import { useEffect, useRef, useState } from 'react'
import { getApiKey, selectKeyStatus, useKeyStore } from '../store/useKeyStore'
import { passphraseStrength } from '../security/keyVault'
import { testApiKey } from '../security/testKey'
import { IconEye, IconEyeOff, IconKey, IconLock, IconShield, IconUnlock, IconX } from './Icons'

const MIN_PASS = 8
const AUTO_LOCK_OPTIONS = [
  [5, '5 分鐘'],
  [15, '15 分鐘'],
  [30, '30 分鐘'],
  [60, '1 小時'],
  [0, '不自動鎖定'],
]

/** 掛在 App 最外層：設定對話框、解鎖畫面、通知 */
export function KeyLayer() {
  const settingsOpen = useKeyStore((s) => s.settingsOpen)
  const unlockOpen = useKeyStore((s) => s.unlockOpen)
  const status = useKeyStore(selectKeyStatus)
  return (
    <>
      {settingsOpen && <KeySettingsDialog />}
      {unlockOpen && status === 'locked' && <UnlockDialog />}
      <KeyNotice />
    </>
  )
}

// ---------------------------------------------------------------------------
// 共用元件
// ---------------------------------------------------------------------------

export function KeyStatusChip({ className = '' }) {
  const status = useKeyStore(selectKeyStatus)
  const keySource = useKeyStore((s) => s.keySource)
  const map = {
    none: { label: '未設定', cls: 'bg-white/5 text-ink-300 border-white/10', icon: <IconKey size={11} /> },
    unlocked: {
      label: keySource === 'vault' ? '已解鎖（僅記憶體）' : '已設定（僅記憶體）',
      cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
      icon: <IconUnlock size={11} />,
    },
    locked: { label: '已上鎖', cls: 'bg-amber-500/10 text-amber-300 border-amber-400/25', icon: <IconLock size={11} /> },
  }[status]
  return (
    <span data-testid="key-status" data-status={status} className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[10.5px] font-medium ${map.cls} ${className}`}>
      {map.icon}
      {map.label}
    </span>
  )
}

function Modal({ title, icon, onClose, children, footer, labelledBy }) {
  const ref = useRef()
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    const first = ref.current?.querySelector('input') ?? ref.current?.querySelector('button')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink-950/70 backdrop-blur-sm animate-rise" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="panel w-full max-w-[440px] max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl">
        <div className="h-12 shrink-0 px-4 flex items-center justify-between border-b border-white/5">
          <div id={labelledBy} className="flex items-center gap-2 text-sm font-semibold">
            <span className="size-6 rounded-lg bg-brand/15 text-brand-soft grid place-items-center">{icon}</span>
            {title}
          </div>
          {onClose && (
            <button onClick={onClose} className="size-7 grid place-items-center rounded-lg text-ink-400 hover:text-white hover:bg-white/5" title="關閉">
              <IconX size={15} />
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-4">{children}</div>
        {footer && <div className="shrink-0 px-4 py-3 border-t border-white/5 flex items-center gap-2">{footer}</div>}
      </div>
    </div>
  )
}

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-ink-950/60 border border-white/10 text-[13px] placeholder:text-ink-400 focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10'

function SecretInput({ value, onChange, placeholder, autoComplete = 'off', mono, testId, onEnter }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        data-testid={testId}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="off"
        className={`${inputCls} pr-9 ${mono ? 'font-mono text-xs' : ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md text-ink-400 hover:text-white"
        title={show ? '隱藏' : '顯示'}
        aria-label={show ? '隱藏' : '顯示'}
      >
        {show ? <IconEyeOff size={14} /> : <IconEye size={14} />}
      </button>
    </div>
  )
}

const Label = ({ children, right }) => (
  <div className="flex items-center justify-between mb-1.5">
    <div className="text-[11px] font-semibold text-ink-300 tracking-wide">{children}</div>
    {right}
  </div>
)

function Confirm({ text, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 animate-rise">
      <p className="text-[12px] text-red-100 leading-relaxed">{text}</p>
      <div className="mt-2.5 flex justify-end gap-2">
        <button onClick={onCancel} className="h-7 px-3 rounded-lg text-[12px] text-ink-300 hover:text-white hover:bg-white/5">
          取消
        </button>
        <button onClick={onConfirm} className="h-7 px-3 rounded-lg text-[12px] font-semibold bg-red-500 text-white hover:bg-red-400">
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 設定對話框
// ---------------------------------------------------------------------------

export function KeySettingsDialog() {
  const st = useKeyStore()
  const status = selectKeyStatus(st)
  const [engine, setEngine] = useState(st.engine)
  const [keyDraft, setKeyDraft] = useState('')
  const [storage, setStorage] = useState(st.vaultExists ? 'vault' : 'none')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [hint, setHint] = useState('')
  const [autoLock, setAutoLock] = useState(st.autoLockMinutes)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [test, setTest] = useState(null) // { state:'running'|'ok'|'fail', message }
  const [confirmRemove, setConfirmRemove] = useState(false)

  const newKey = keyDraft.trim()
  const vaultBacked = st.vaultExists && (st.keySource === 'vault' || !st.hasKey)
  // 需要設定新密碼：選了加密儲存，且（輸入了新金鑰，或目前沒有保險庫 / 金鑰只在記憶體）
  const needsPass = storage === 'vault' && (!!newKey || !vaultBacked)
  const strength = passphraseStrength(pass)

  const runTest = async () => {
    const k = newKey || getApiKey()
    if (!k) {
      setTest({ state: 'fail', message: status === 'locked' ? '金鑰已上鎖，請先解鎖或輸入新金鑰。' : '請先輸入金鑰。' })
      return
    }
    setTest({ state: 'running', message: '測試中…' })
    const r = await testApiKey(k)
    setTest({ state: r.ok ? 'ok' : 'fail', message: r.message })
  }

  const save = async () => {
    setError('')
    const effectiveKey = newKey || getApiKey()
    try {
      if (storage === 'none') {
        if (newKey) st.setMemoryOnlyKey(newKey)
        else if (st.vaultExists) st.dropVaultKeepMemory()
      } else if (needsPass) {
        if (!effectiveKey) return setError('請先輸入要加密儲存的金鑰。')
        if (pass.length < MIN_PASS) return setError(`密碼至少需要 ${MIN_PASS} 個字元。`)
        if (pass !== pass2) return setError('兩次輸入的密碼不一致。')
        setSaving(true)
        await st.saveToVault(effectiveKey, pass, hint)
      }
      st.setEngine(engine)
      st.setAutoLockMinutes(autoLock)
      st.closeSettings()
    } catch (err) {
      setError(err?.name === 'VaultError' ? err.message : '儲存失敗，請再試一次。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="AI 設定"
      icon={<IconKey size={14} />}
      onClose={st.closeSettings}
      labelledBy="key-settings-title"
      footer={
        <>
          {(st.hasKey || st.vaultExists) && (
            <button data-testid="remove-key" onClick={() => setConfirmRemove(true)} className="h-8 px-2.5 rounded-lg text-[12px] text-red-300 hover:bg-red-500/10">
              移除金鑰
            </button>
          )}
          {st.hasKey && st.keySource === 'vault' && (
            <button
              data-testid="lock-key"
              onClick={() => {
                st.lock()
                st.closeSettings()
              }}
              className="h-8 px-2.5 rounded-lg text-[12px] text-ink-300 hover:text-white hover:bg-white/5 flex items-center gap-1"
            >
              <IconLock size={13} /> 鎖定
            </button>
          )}
          <div className="flex-1" />
          <button onClick={st.closeSettings} className="h-8 px-3 rounded-lg text-[12px] text-ink-300 hover:text-white hover:bg-white/5">
            取消
          </button>
          <button
            data-testid="save-settings"
            onClick={save}
            disabled={saving}
            className="h-8 px-4 rounded-lg bg-white text-ink-950 text-[12px] font-semibold hover:bg-ink-100 disabled:opacity-50"
          >
            {saving ? '加密中…' : '儲存'}
          </button>
        </>
      }
    >
      {/* 引擎 */}
      <div>
        <Label>AI 引擎</Label>
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-ink-950/60 border border-white/5">
          {[
            ['mock', 'Mock（離線示範）'],
            ['claude', 'Claude API'],
          ].map(([v, l]) => (
            <button key={v} data-testid={`engine-${v}`} onClick={() => setEngine(v)} className={`h-8 rounded-md text-[12px] font-medium transition ${engine === v ? 'bg-ink-600 text-white shadow-sm' : 'text-ink-300 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 金鑰 */}
      <div>
        <Label right={<KeyStatusChip />}>Claude API 金鑰</Label>
        {status === 'locked' && !newKey && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-[12px] text-amber-200">
            <span>已有加密儲存的金鑰，目前上鎖中。</span>
            <button onClick={st.openUnlock} className="shrink-0 h-6 px-2 rounded-md bg-amber-400/90 text-ink-950 text-[11px] font-semibold hover:bg-amber-300">
              解鎖
            </button>
          </div>
        )}
        <SecretInput
          testId="api-key-input"
          value={keyDraft}
          onChange={(v) => {
            setKeyDraft(v)
            setTest(null)
          }}
          placeholder={st.hasKey || st.vaultExists ? '留空則沿用目前的金鑰' : 'sk-ant-…'}
          mono
        />
        {newKey && !newKey.startsWith('sk-ant-') && <p className="mt-1 text-[11px] text-amber-300/90">提醒：Anthropic 金鑰通常以 sk-ant- 開頭。</p>}
        <div className="mt-2 flex items-center gap-2">
          <button
            data-testid="test-key"
            onClick={runTest}
            disabled={test?.state === 'running'}
            className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-ink-800 border border-white/10 text-ink-100 hover:border-brand/40 disabled:opacity-50"
          >
            測試金鑰
          </button>
          {test && (
            <span
              data-testid="test-result"
              data-state={test.state}
              className={`text-[11.5px] ${test.state === 'ok' ? 'text-emerald-300' : test.state === 'fail' ? 'text-red-300' : 'text-ink-300'}`}
            >
              {test.state === 'ok' ? '✓ ' : test.state === 'fail' ? '✕ ' : ''}
              {test.message}
            </span>
          )}
        </div>
      </div>

      {/* 儲存方式 */}
      <div>
        <Label>儲存方式</Label>
        <div className="space-y-1.5">
          <StorageOption
            id="none"
            checked={storage === 'none'}
            onChange={setStorage}
            title="不儲存（預設）"
            desc="金鑰只放在這個分頁的記憶體，關閉或重新整理就會忘記。最安全。"
          />
          <StorageOption
            id="vault"
            checked={storage === 'vault'}
            onChange={setStorage}
            title="加密儲存＋設定密碼"
            desc="用你設定的密碼加密（PBKDF2 + AES-GCM）後存在這台電腦的瀏覽器；下次開啟時輸入密碼解鎖。"
          />
        </div>
        {storage === 'none' && st.vaultExists && !newKey && (
          <p className="mt-2 text-[11.5px] text-amber-300/90 leading-relaxed">
            儲存後會刪除目前加密保存的金鑰{st.hasKey ? '，這個分頁仍可繼續使用記憶體中的金鑰' : '（尚未解鎖，刪除後需要重新輸入）'}。
          </p>
        )}
        {storage === 'vault' && !needsPass && <p className="mt-2 text-[11.5px] text-ink-400">沿用目前的加密金鑰與密碼。要更換密碼，請重新輸入金鑰。</p>}
        {needsPass && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-ink-950/40 p-3">
            <div>
              <Label>設定密碼</Label>
              <SecretInput testId="passphrase-input" value={pass} onChange={setPass} placeholder={`至少 ${MIN_PASS} 個字元`} autoComplete="new-password" />
              {pass && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1 rounded-full ${i <= strength.score ? ['', 'bg-red-400', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-400'][strength.score] : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <span className="text-[10.5px] text-ink-300 w-28 text-right">強度：{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <Label>再次輸入密碼</Label>
              <SecretInput testId="passphrase-confirm" value={pass2} onChange={setPass2} placeholder="確認密碼" autoComplete="new-password" />
              {pass2 && pass !== pass2 && <p className="mt-1 text-[11px] text-red-300">兩次輸入的密碼不一致。</p>}
            </div>
            <div>
              <Label>密碼提示（選填，會以明文儲存）</Label>
              <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={60} placeholder="例如：常用的那組 + 年份" className={inputCls} />
            </div>
            <p className="text-[11px] text-ink-400 leading-relaxed">BuildM8 不會保存你的密碼，忘記密碼就無法救回，只能清除後重新輸入金鑰。</p>
          </div>
        )}
        {storage === 'vault' && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[12px] text-ink-300">閒置後自動鎖定</span>
            <select
              value={autoLock}
              onChange={(e) => setAutoLock(Number(e.target.value))}
              className="h-8 px-2 rounded-lg bg-ink-800 border border-white/10 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {AUTO_LOCK_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div data-testid="settings-error" className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      )}

      {confirmRemove && (
        <Confirm
          text="確定要移除金鑰嗎？記憶體中的金鑰與這台電腦上的加密副本都會被刪除，之後需要重新輸入。"
          confirmLabel="移除金鑰"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            st.removeKey()
            setConfirmRemove(false)
            setKeyDraft('')
            setTest(null)
          }}
        />
      )}

      <PrivacyNote />
    </Modal>
  )
}

function StorageOption({ id, checked, onChange, title, desc }) {
  return (
    <label
      className={`flex gap-2.5 rounded-xl border p-2.5 cursor-pointer transition ${checked ? 'border-brand/50 bg-brand/[0.06]' : 'border-white/5 bg-ink-950/30 hover:border-white/15'}`}
    >
      <input data-testid={`storage-${id}`} type="radio" name="key-storage" checked={checked} onChange={() => onChange(id)} className="mt-0.5 accent-amber-500" />
      <span>
        <span className="block text-[12.5px] font-semibold text-white">{title}</span>
        <span className="block text-[11.5px] text-ink-300 leading-relaxed mt-0.5">{desc}</span>
      </span>
    </label>
  )
}

function PrivacyNote() {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-950/40 p-3 text-[11.5px] text-ink-300 leading-relaxed space-y-1.5">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-100">
        <IconShield size={13} /> 隱私與安全說明
      </div>
      <p>• 金鑰只會從你的瀏覽器直接送到 Anthropic，不會經過、也不會傳送到任何 BuildM8 伺服器（BuildM8 是純靜態網站，沒有後端）。</p>
      <p>• 加密儲存能保護「存在這台電腦上的副本」，適合共用電腦；但無法防範在頁面上執行的惡意腳本或擴充功能。</p>
      <p>• 正式上線的產品建議改由後端代理呼叫 API，金鑰不要放在瀏覽器裡。</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 解鎖畫面（本機「登入」）
// ---------------------------------------------------------------------------

export function UnlockDialog() {
  const { unlock, closeUnlock, removeKey, vaultHint, vaultCorrupt, openSettings } = useKeyStore()
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)

  const submit = async () => {
    if (!pass || busy) return
    setBusy(true)
    setError('')
    try {
      await unlock(pass)
    } catch (err) {
      setError(err?.code === 'wrong-passphrase' ? '密碼錯誤，請再試一次。' : err?.name === 'VaultError' ? err.message : '解鎖失敗，請再試一次。')
      setPass('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="解鎖 Claude API 金鑰" icon={<IconLock size={14} />} onClose={closeUnlock} labelledBy="unlock-title">
      <p className="text-[12.5px] text-ink-300 leading-relaxed">
        這台電腦上有一把加密儲存的金鑰。輸入你設定的密碼即可解鎖；解鎖後金鑰只會放在這個分頁的記憶體裡。
      </p>
      {vaultCorrupt ? (
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">加密資料已損毀，無法解鎖，請清除後重新輸入金鑰。</div>
      ) : (
        <div>
          <Label>密碼</Label>
          <SecretInput testId="unlock-input" value={pass} onChange={setPass} onEnter={submit} placeholder="輸入密碼" autoComplete="current-password" />
          {vaultHint && <p className="mt-1.5 text-[11.5px] text-ink-400">提示：{vaultHint}</p>}
          {error && (
            <p data-testid="unlock-error" className="mt-1.5 text-[12px] text-red-300">
              {error}
            </p>
          )}
          <button
            data-testid="unlock-submit"
            onClick={submit}
            disabled={!pass || busy}
            className="mt-3 w-full h-9 rounded-lg bg-brand text-ink-950 text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <IconUnlock size={14} /> {busy ? '解鎖中…' : '解鎖'}
          </button>
        </div>
      )}
      <div className="flex items-center justify-between text-[12px]">
        <button onClick={closeUnlock} className="text-ink-400 hover:text-white">
          先不要，使用 Mock 模式
        </button>
        <button data-testid="forget-vault" onClick={() => setConfirmForget(true)} className="text-red-300 hover:text-red-200">
          忘記密碼？清除金鑰
        </button>
      </div>
      {confirmForget && (
        <Confirm
          text="密碼無法找回。清除後，這台電腦上加密保存的金鑰會被永久刪除，你需要重新輸入金鑰。確定要清除嗎？"
          confirmLabel="清除金鑰"
          onCancel={() => setConfirmForget(false)}
          onConfirm={() => {
            removeKey()
            openSettings()
          }}
        />
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// 通知（遷移提示、自動鎖定）
// ---------------------------------------------------------------------------

function KeyNotice() {
  const notice = useKeyStore((s) => s.notice)
  const dismiss = useKeyStore((s) => s.dismissNotice)
  const openSettings = useKeyStore((s) => s.openSettings)
  if (!notice) return null
  return (
    <div data-testid="key-notice" className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,440px)] panel rounded-xl p-3 flex gap-2.5 animate-rise">
      <span className="shrink-0 size-6 rounded-lg bg-amber-500/15 text-amber-300 grid place-items-center">
        <IconShield size={14} />
      </span>
      <div className="flex-1 text-[12px] text-ink-100 leading-relaxed">
        {notice}
        <div className="mt-1.5">
          <button
            onClick={() => {
              dismiss()
              openSettings()
            }}
            className="text-brand-soft hover:underline font-medium"
          >
            開啟 AI 設定
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="shrink-0 size-6 grid place-items-center rounded-md text-ink-400 hover:text-white" title="關閉">
        <IconX size={13} />
      </button>
    </div>
  )
}
