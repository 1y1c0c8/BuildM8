import Anthropic from '@anthropic-ai/sdk'

/**
 * 用最小的請求（列出 1 個模型，不產生任何 token 費用）確認金鑰可用。
 * 回傳的訊息不會包含金鑰本身或 SDK 的原始錯誤字串。
 * @returns {Promise<{ ok:boolean, message:string }>}
 */
export async function testApiKey(apiKey) {
  if (!apiKey) return { ok: false, message: '請先輸入或解鎖金鑰。' }
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 15_000 })
    await client.models.list({ limit: 1 })
    return { ok: true, message: '金鑰有效，已成功連線到 Anthropic。' }
  } catch (err) {
    const status = typeof err?.status === 'number' ? err.status : null
    if (status === 401) return { ok: false, message: '金鑰無效或已被撤銷（401）。' }
    if (status === 403) return { ok: false, message: '這把金鑰沒有權限（403）。' }
    if (status === 429) return { ok: true, message: '金鑰有效，但目前請求次數已達上限（429），請稍後再試。' }
    if (status && status >= 500) return { ok: false, message: `Anthropic 服務暫時無法使用（${status}），請稍後再試。` }
    if (status) return { ok: false, message: `測試失敗（HTTP ${status}）。` }
    return { ok: false, message: '無法連線到 Anthropic，請檢查網路連線後再試。' }
  }
}
