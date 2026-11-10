/**
 * 3D 畫布截圖（給「請 Claude 修改這個設計」用）
 * ---------------------------------------------------------------------------
 * 不開 preserveDrawingBuffer（會讓每一幀多一次複製、拖慢手機）：
 * 截圖時在同一個 task 內先 gl.render() 一次，再立刻把 WebGL canvas 畫到 2D canvas，
 * 這時 drawing buffer 還沒被清掉，畫面完整。順便暫時隱藏選取用的 TransformControls，
 * 並鋪上不透明背景（WebGL canvas 是透明的，背景漸層原本由 CSS 提供）。
 */
import { registry } from './registry'

const MAX_SIDE = 1600

/** 由 Workspace 內的 CaptureBridge 設定：(gl, scene, camera) */
export function setCaptureTarget(target) {
  registry.captureTarget = target
}

/** 同步擷取目前畫面，回傳 2D canvas；畫布尚未就緒時丟出錯誤 */
export function captureCanvas({ label = '' } = {}) {
  const t = registry.captureTarget
  if (!t) throw new Error('3D 畫布還沒準備好，請稍後再試。')
  const { gl, scene, camera } = t
  const helper = registry.transform?.getHelper?.()
  const wasVisible = helper?.visible
  if (helper) helper.visible = false
  try {
    gl.render(scene, camera)
    const src = gl.domElement
    const k = Math.min(1, MAX_SIDE / Math.max(src.width, src.height))
    const w = Math.max(1, Math.round(src.width * k))
    const h = Math.max(1, Math.round(src.height * k))
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')
    const bg = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.75)
    bg.addColorStop(0, '#1b2028')
    bg.addColorStop(0.6, '#0e1115')
    bg.addColorStop(1, '#0b0d10')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(src, 0, 0, w, h)
    if (label) {
      const fs = Math.max(12, Math.round(h / 45))
      ctx.font = `600 ${fs}px system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      ctx.textBaseline = 'bottom'
      ctx.fillText(label, fs, h - fs * 0.8)
    }
    return out
  } finally {
    if (helper) helper.visible = wasVisible
  }
}

/** 縮圖（dataURL），給對話框預覽用 */
export function captureThumbnail(maxSide = 480, opts) {
  const c = captureCanvas(opts)
  const k = Math.min(1, maxSide / Math.max(c.width, c.height))
  if (k === 1) return c.toDataURL('image/png')
  const t = document.createElement('canvas')
  t.width = Math.round(c.width * k)
  t.height = Math.round(c.height * k)
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height)
  return t.toDataURL('image/jpeg', 0.85)
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('截圖失敗'))), 'image/png'))

const fileName = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `buildm8-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** 下載 PNG */
export async function downloadScreenshot(opts) {
  downloadBlob(await toBlob(captureCanvas(opts)))
  return 'downloaded'
}

/**
 * 複製 PNG 到剪貼簿；瀏覽器不支援圖片剪貼簿（或被拒絕）時改為下載。
 * ClipboardItem 必須在使用者點擊的同一個同步流程中建立（Safari），
 * 所以傳入 Promise<Blob>，而不是先 await 再建立。
 * @returns {Promise<'copied'|'downloaded'>}
 */
export async function copyScreenshot(opts) {
  const blob = toBlob(captureCanvas(opts))
  if (navigator.clipboard?.write && typeof window.ClipboardItem === 'function') {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      return 'copied'
    } catch {
      // 落到下載
    }
  }
  downloadBlob(await blob)
  return 'downloaded'
}
