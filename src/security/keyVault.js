/**
 * keyVault — 用使用者自訂密碼加密保存 Claude API 金鑰（純函式、無 React 依賴）。
 *
 * 加密：PBKDF2-SHA-256（預設 600,000 次、16 bytes 隨機 salt）→ AES-GCM 256（12 bytes 隨機 IV）。
 * localStorage 只會出現 { v, salt, iv, ciphertext, iterations, createdAt, hint? }（base64），
 * 絕不保存密碼或明文金鑰。解密後的金鑰只回傳給呼叫端，由呼叫端放在記憶體中。
 *
 * 注意：加密只能保護「存放在硬碟上的副本」（例如共用電腦），
 * 無法防範頁面上執行的惡意腳本；正式上線建議改由後端代理呼叫 API。
 */

export const VAULT_STORAGE_KEY = 'buildm8.vault'
export const LEGACY_STORAGE_KEY = 'buildm8.ai'
export const VAULT_VERSION = 1
export const DEFAULT_ITERATIONS = 600_000
export const MIN_ITERATIONS = 310_000
const MAX_ITERATIONS = 10_000_000
const AAD = new TextEncoder().encode('buildm8.vault.v1')

export class VaultError extends Error {
  /** @param {'no-vault'|'corrupt'|'wrong-passphrase'|'invalid-input'|'unsupported'} code */
  constructor(code, message) {
    super(message)
    this.name = 'VaultError'
    this.code = code
  }
}

const defaultStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null)

function getSubtle() {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new VaultError('unsupported', '此瀏覽器不支援 WebCrypto（需要 HTTPS 或 localhost）。')
  return subtle
}

// ---------- base64 ----------
const toB64 = (bytes) => {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s)
}
const fromB64 = (str) => {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(passphrase, salt, iterations) {
  const subtle = getSubtle()
  const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 讀取並驗證保險庫格式（不解密）。不存在回傳 null，格式錯誤丟 VaultError('corrupt')。 */
export function readVault(storage = defaultStorage()) {
  let raw = null
  try {
    raw = storage?.getItem(VAULT_STORAGE_KEY) ?? null
  } catch {
    return null
  }
  if (!raw) return null
  let rec
  try {
    rec = JSON.parse(raw)
  } catch {
    throw new VaultError('corrupt', '已儲存的加密金鑰格式損毀。')
  }
  const ok =
    rec &&
    rec.v === VAULT_VERSION &&
    typeof rec.salt === 'string' &&
    typeof rec.iv === 'string' &&
    typeof rec.ciphertext === 'string' &&
    Number.isInteger(rec.iterations) &&
    rec.iterations >= MIN_ITERATIONS &&
    rec.iterations <= MAX_ITERATIONS
  if (!ok) throw new VaultError('corrupt', '已儲存的加密金鑰格式損毀或版本不符。')
  return rec
}

/** 是否已有加密保存的金鑰（損毀的保險庫也算存在，讓使用者可以選擇清除） */
export function hasVault(storage = defaultStorage()) {
  try {
    return !!readVault(storage)
  } catch {
    return true
  }
}

/** 公開資訊：建立時間、提示（不含機密） */
export function vaultInfo(storage = defaultStorage()) {
  try {
    const rec = readVault(storage)
    return rec ? { createdAt: rec.createdAt, hint: rec.hint || '', iterations: rec.iterations } : null
  } catch {
    return { corrupt: true, hint: '' }
  }
}

/**
 * 以密碼加密金鑰並寫入 localStorage（覆蓋舊的保險庫）。
 * @returns {Promise<{createdAt:string}>}
 */
export async function createVault(apiKey, passphrase, { hint, iterations = DEFAULT_ITERATIONS, storage = defaultStorage() } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new VaultError('invalid-input', '金鑰不可為空白。')
  if (typeof passphrase !== 'string' || !passphrase) throw new VaultError('invalid-input', '密碼不可為空白。')
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS)
    throw new VaultError('invalid-input', '迭代次數不在允許範圍內。')
  if (!storage) throw new VaultError('unsupported', '無法使用 localStorage。')
  const subtle = getSubtle()
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, iterations)
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, new TextEncoder().encode(apiKey.trim()))
  const rec = {
    v: VAULT_VERSION,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ct),
    iterations,
    createdAt: new Date().toISOString(),
  }
  const h = typeof hint === 'string' ? hint.trim().slice(0, 60) : ''
  if (h) rec.hint = h
  storage.setItem(VAULT_STORAGE_KEY, JSON.stringify(rec))
  return { createdAt: rec.createdAt }
}

/**
 * 用密碼解鎖，回傳明文金鑰（呼叫端只能放在記憶體）。
 * 密碼錯誤時 AES-GCM 驗證失敗 → VaultError('wrong-passphrase')。
 */
export async function unlockVault(passphrase, { storage = defaultStorage() } = {}) {
  const rec = readVault(storage)
  if (!rec) throw new VaultError('no-vault', '尚未儲存任何加密金鑰。')
  if (typeof passphrase !== 'string' || !passphrase) throw new VaultError('invalid-input', '請輸入密碼。')
  let salt, iv, ct
  try {
    salt = fromB64(rec.salt)
    iv = fromB64(rec.iv)
    ct = fromB64(rec.ciphertext)
  } catch {
    throw new VaultError('corrupt', '已儲存的加密金鑰格式損毀。')
  }
  if (salt.length !== 16 || iv.length !== 12) throw new VaultError('corrupt', '已儲存的加密金鑰格式損毀。')
  const key = await deriveKey(passphrase, salt, rec.iterations)
  let plain
  try {
    plain = await getSubtle().decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, ct)
  } catch {
    throw new VaultError('wrong-passphrase', '密碼錯誤，請再試一次。')
  }
  return new TextDecoder().decode(plain)
}

/** 刪除加密保存的金鑰 */
export function clearVault(storage = defaultStorage()) {
  try {
    storage?.removeItem(VAULT_STORAGE_KEY)
  } catch {
    /* 忽略 */
  }
}

/**
 * 舊版遷移：`buildm8.ai` 曾以明文存 { mode, apiKey }。
 * 立即刪除明文金鑰，只保留 mode 偏好。回傳是否真的移除了一把金鑰。
 */
export function migrateLegacyPlaintext(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return false
    let obj
    try {
      obj = JSON.parse(raw)
    } catch {
      storage.removeItem(LEGACY_STORAGE_KEY)
      return /sk-ant/i.test(raw)
    }
    if (!obj || typeof obj !== 'object' || !('apiKey' in obj)) return false
    const hadKey = typeof obj.apiKey === 'string' && obj.apiKey.length > 0
    const rest = { ...obj }
    delete rest.apiKey
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(rest))
    return hadKey
  } catch {
    return false
  }
}

/** 遮蔽字串中任何疑似 API 金鑰的片段，避免出現在錯誤訊息裡 */
export function redactSecrets(text, secret) {
  let s = String(text ?? '')
  if (secret && secret.length >= 8) s = s.split(secret).join('［已遮蔽］')
  return s.replace(/sk-ant-[A-Za-z0-9_-]+/g, '［已遮蔽］')
}

/** 密碼強度提示（0–4） */
export function passphraseStrength(p = '') {
  if (!p) return { score: 0, label: '' }
  if (p.length < 8) return { score: 0, label: '太短（至少 8 個字元）' }
  let score = 1
  if (p.length >= 12) score++
  if (p.length >= 16) score++
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length
  if (classes >= 3) score++
  score = Math.min(4, score)
  return { score, label: ['太短', '偏弱', '普通', '良好', '很強'][score] }
}
