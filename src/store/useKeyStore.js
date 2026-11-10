import { create } from 'zustand'
import {
  LEGACY_STORAGE_KEY,
  clearVault,
  createVault,
  hasVault,
  migrateLegacyPlaintext,
  unlockVault,
  vaultInfo,
} from '../security/keyVault'

/**
 * 金鑰狀態（BYOK）。
 *
 * - 明文金鑰只存在這個模組的閉包變數 `memoryKey`，不放進 zustand state（避免被 devtools /
 *   序列化帶出去），也「絕不」持久化。重新整理分頁就會忘記。
 * - 若使用者選擇「加密儲存」，localStorage 只會有 keyVault 產生的密文。
 * - `buildm8.ai` 只保存非機密的偏好：{ mode, autoLockMinutes }。
 */
let memoryKey = null

/** 取得目前記憶體中的金鑰（僅在要呼叫 API 的當下使用，不要存進 state 或 log） */
export const getApiKey = () => memoryKey

const DEFAULT_AUTO_LOCK = 30

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}')
    return {
      mode: p.mode === 'claude' ? 'claude' : 'mock',
      autoLockMinutes: Number.isFinite(p.autoLockMinutes) ? p.autoLockMinutes : DEFAULT_AUTO_LOCK,
    }
  } catch {
    return { mode: 'mock', autoLockMinutes: DEFAULT_AUTO_LOCK }
  }
}

function savePrefs(prefs) {
  try {
    // 只寫入白名單欄位，確保金鑰永遠不會被寫進來
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ mode: prefs.mode, autoLockMinutes: prefs.autoLockMinutes }))
  } catch {
    /* 私密視窗等情況忽略 */
  }
}

// 啟動時立即執行：刪除舊版明文金鑰
const migratedLegacyKey = migrateLegacyPlaintext()
const initialPrefs = loadPrefs()
const initialVault = vaultInfo()

export const useKeyStore = create((set, get) => ({
  engine: initialPrefs.mode, // 'mock' | 'claude'（使用者偏好）
  autoLockMinutes: initialPrefs.autoLockMinutes, // 0 = 不自動鎖定
  hasKey: false, // 記憶體中是否有金鑰
  keySource: null, // null | 'memory'（不儲存） | 'vault'（由加密保險庫解鎖）
  vaultExists: !!initialVault,
  vaultHint: initialVault?.hint || '',
  vaultCorrupt: !!initialVault?.corrupt,
  settingsOpen: false,
  unlockOpen: !!initialVault, // 有保險庫且上鎖 → 啟動時就顯示解鎖畫面
  notice: migratedLegacyKey
    ? '為了安全，BuildM8 已刪除先前以明文存在瀏覽器裡的 Claude API 金鑰。請到「AI 設定」重新輸入，並可選擇用密碼加密儲存。'
    : null,

  _refreshVault() {
    const info = vaultInfo()
    set({ vaultExists: !!info, vaultHint: info?.hint || '', vaultCorrupt: !!info?.corrupt })
  },

  setEngine(engine) {
    set({ engine })
    savePrefs({ mode: engine, autoLockMinutes: get().autoLockMinutes })
  },
  setAutoLockMinutes(min) {
    set({ autoLockMinutes: min })
    savePrefs({ mode: get().engine, autoLockMinutes: min })
  },

  /** 只放在記憶體（不儲存）；同時移除任何舊的保險庫 */
  setMemoryOnlyKey(key) {
    clearVault()
    memoryKey = key.trim()
    set({ hasKey: true, keySource: 'memory' })
    get()._refreshVault()
  },

  /** 不更動金鑰，只把保險庫刪除（記憶體中的金鑰保留為「不儲存」模式） */
  dropVaultKeepMemory() {
    clearVault()
    set({ keySource: memoryKey ? 'memory' : null, hasKey: !!memoryKey })
    get()._refreshVault()
  },

  /** 加密儲存：以密碼建立保險庫，並把金鑰放進記憶體（視為已解鎖） */
  async saveToVault(key, passphrase, hint) {
    const k = key.trim()
    await createVault(k, passphrase, { hint })
    memoryKey = k
    set({ hasKey: true, keySource: 'vault', unlockOpen: false })
    get()._refreshVault()
  },

  async unlock(passphrase) {
    const key = await unlockVault(passphrase)
    memoryKey = key
    set({ hasKey: true, keySource: 'vault', unlockOpen: false })
  },

  /** 鎖定：從記憶體抹除金鑰（加密副本仍保留） */
  lock() {
    memoryKey = null
    set({ hasKey: false, keySource: null })
  },

  /** 移除金鑰：記憶體與加密副本一起刪除 */
  removeKey() {
    memoryKey = null
    clearVault()
    set({ hasKey: false, keySource: null, unlockOpen: false })
    get()._refreshVault()
  },

  openSettings: () => set({ settingsOpen: true, unlockOpen: false, notice: null }),
  closeSettings: () => set({ settingsOpen: false }),
  openUnlock: () => set({ unlockOpen: hasVault(), settingsOpen: false }),
  closeUnlock: () => set({ unlockOpen: false }),
  dismissNotice: () => set({ notice: null }),
}))

/** 'none' 未設定 | 'unlocked' 已解鎖（僅記憶體） | 'locked' 已上鎖 */
export const selectKeyStatus = (s) => (s.hasKey ? 'unlocked' : s.vaultExists ? 'locked' : 'none')

/** Copilot 實際使用的引擎與原因 */
export const selectEffectiveEngine = (s) => {
  if (s.engine !== 'claude') return { engine: 'mock', reason: null }
  if (s.hasKey) return { engine: 'claude', reason: null }
  return { engine: 'mock', reason: s.vaultExists ? '金鑰已上鎖' : '未設定金鑰' }
}

// ---------- 閒置自動鎖定 ----------
let lastActivity = Date.now()
if (typeof window !== 'undefined') {
  const bump = () => {
    lastActivity = Date.now()
  }
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, bump, { passive: true })
  setInterval(() => {
    const s = useKeyStore.getState()
    if (!s.hasKey || s.keySource !== 'vault' || !s.autoLockMinutes) return
    if (Date.now() - lastActivity >= s.autoLockMinutes * 60_000) {
      s.lock()
      useKeyStore.setState({ notice: `閒置超過 ${s.autoLockMinutes} 分鐘，已自動鎖定金鑰。` })
    }
  }, 15_000)
}
