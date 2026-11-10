#!/usr/bin/env node
/**
 * BuildM8 設計檔截圖工具（給 Claude Code 代理人「看」自己的設計）
 *
 *   npm run render-design -- designs/foo.json [--views iso,front,side,top] [--out designs/renders] [--url http://localhost:5173]
 *
 * 流程：啟動 Vite 開發伺服器（或用 --url 指定已在跑的 npm run dev）→ 無頭 Chromium 開啟網站 →
 *       透過開發模式掛鉤 window.__buildm8 載入設計 → 每個視角存一張 PNG。
 *
 * 需要 Playwright（不在專案相依套件中，避免每次 npm ci 都下載瀏覽器）：
 *   npm i -D playwright && npx playwright install chromium
 * 找不到 Playwright 或瀏覽器時會印出安裝說明並以代碼 3 結束（不影響其他流程）。
 */
import { readFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : def
}
const files = args.filter((a, i) => !a.startsWith('--') && !['--views', '--out', '--url', '--size'].includes(args[i - 1]))
const views = opt('--views', 'iso,front,side').split(',').map((s) => s.trim()).filter(Boolean)
const outDir = path.resolve(opt('--out', path.join(root, 'designs', 'renders')))
const [vw, vh] = opt('--size', '1400x1000').split('x').map(Number)
const GRACEFUL = 3

if (!files.length || args.includes('--help')) {
  console.log(`用法：npm run render-design -- <設計檔.json> [更多檔案…] [--views iso,front,side,top,back] [--out 資料夾] [--url 開發伺服器網址] [--size 1400x1000]`)
  process.exit(files.length ? 0 : 2)
}

const pick = (mod) => (mod?.chromium ? mod : mod?.default?.chromium ? mod.default : null)

async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const mod = pick(await import(name))
      if (mod) return mod
    } catch {
      /* 試下一個 */
    }
  }
  // 全域安裝（npm i -g playwright）
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const req = createRequire(path.join(globalRoot, 'noop.js'))
    for (const name of ['playwright', 'playwright-core']) {
      try {
        const mod = pick(await import(pathToFileURL(req.resolve(name)).href))
        if (mod) return mod
      } catch {
        /* 試下一個 */
      }
    }
  } catch {
    /* 沒有全域 npm */
  }
  return null
}

const pw = await loadPlaywright()
if (!pw?.chromium) {
  console.error(`找不到 Playwright，無法截圖（驗證工具 npm run validate-design 仍可正常使用）。
安裝方式：
  npm i -D playwright
  npx playwright install chromium`)
  process.exit(GRACEFUL)
}

let server = null
let baseUrl = opt('--url')
if (!baseUrl) {
  const { createServer } = await import('vite')
  server = await createServer({
    root,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 5190, strictPort: false },
  })
  await server.listen()
  baseUrl = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${server.config.server.port}/`
}

let browser
const cleanup = async () => {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
}

try {
  try {
    browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  } catch (e) {
    console.error(`無法啟動 Chromium：${e.message.split('\n')[0]}
請執行：npx playwright install chromium`)
    await cleanup()
    process.exit(GRACEFUL)
  }
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__buildm8 && document.querySelector('canvas'), null, { timeout: 30000 })
  await mkdir(outDir, { recursive: true })

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const info = await page.evaluate((t) => window.__buildm8.loadAssembly(t), text)
    // 等鏡頭動畫（約 1.8 秒）結束，再自己擺視角
    await page.waitForTimeout(2500)
    const slug = path.basename(file).replace(/\.json$/i, '')
    const canvas = page.locator('canvas').first()
    const saved = []
    for (const view of views) {
      const ok = await page.evaluate((v) => window.__buildm8.setView(v), view)
      if (!ok) throw new Error('畫布上沒有零件，無法擺放鏡頭。')
      await page.waitForTimeout(500)
      const out = path.join(outDir, `${slug}-${view}.png`)
      await canvas.screenshot({ path: out })
      saved.push(out)
    }
    console.log(`「${info.title}」${info.count} 個零件${info.warnings?.length ? `（${info.warnings.join('；')}）` : ''}`)
    for (const s of saved) console.log(`  已存 ${path.relative(process.cwd(), s)}`)
  }
  if (errors.length) console.warn(`頁面錯誤：\n  ${errors.join('\n  ')}`)
  await cleanup()
} catch (e) {
  console.error(`截圖失敗：${e.message}`)
  await cleanup()
  process.exit(1)
}
