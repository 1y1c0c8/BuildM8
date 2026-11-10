#!/usr/bin/env node
/**
 * BuildM8 設計檔檢查工具
 *
 *   npm run validate-design -- designs/foo.json [更多檔案…] [--json] [--strict]
 *   npm run validate-design -- --builtin              # 檢查網站內建的參考設計（builders.js + mock）
 *   npm run validate-design -- --dump-builtin <資料夾>  # 把參考設計輸出成 JSON，當範例參考
 *
 * 檢查內容：
 *   ① 規格：partId 是否存在（含舊版別名）、參數是否為現貨規格（與網站 validateAssembly 相同）
 *   ② 幾何：懸空零件、零件互相穿透（排除螺條穿孔 / 螺帽套螺條 / 水管接管件等正常情況）、
 *      牙規 / 管徑不符、孔太小、螺帽沒夾住東西
 *   ③ 摘要：整體尺寸、零件數、採購清單與估價
 *
 * 結束代碼：0 = 通過；1 = 有錯誤（--strict 時警告也算）；2 = 用法或讀檔錯誤
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { loadSrc } from './lib/load-src.mjs'
import { analyzeAssembly } from './lib/analyze.mjs'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const files = []
let dumpDir = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dump-builtin') dumpDir = args[++i]
  else if (!args[i].startsWith('--')) files.push(args[i])
}
const asJson = flags.has('--json')
const strict = flags.has('--strict')

if (flags.has('--help') || (!files.length && !flags.has('--builtin') && !dumpDir)) {
  console.log(`用法：
  npm run validate-design -- <設計檔.json> [更多檔案…] [--json] [--strict]
  npm run validate-design -- --builtin
  npm run validate-design -- --dump-builtin <資料夾>

選項：
  --json      輸出機器可讀的 JSON（給 Claude Code 代理人使用）
  --strict    警告也視為失敗
  --builtin   檢查網站內建參考設計（builders.js 與 src/data/mock/square_frame.json）`)
  process.exit(flags.has('--help') ? 0 : 2)
}

const ctx = await loadSrc()

/** 內建參考設計（正確設計的基準） */
async function builtinDesigns() {
  const pkg = ctx.packages.getPackage('taiwan_hardware_store_v1')
  const b = ctx.builders
  const list = [
    ['builtin:square_frame', b.buildSquareFrame(pkg)],
    ['builtin:square_frame_600x900', b.buildSquareFrame(pkg, { size: 600, height: 900 })],
    ['builtin:clock_case', b.buildClockCase(pkg)],
    ['builtin:clock_case_300x60', b.buildClockCase(pkg, { size: 300, depth: 60 })],
    ['builtin:cd_rack', b.buildCdRack(pkg)],
    ['builtin:pipe_shelf', b.buildPipeShelf(pkg)],
    ['builtin:pipe_shelf_rise450', b.buildPipeShelf(pkg, { rise: 450 })],
  ]
  // 其他分支新增的 builder（例 U 型折板時鐘）也一併檢查
  for (const [name, fn] of Object.entries(b)) {
    if (typeof fn !== 'function' || !name.startsWith('build')) continue
    if (['buildSquareFrame', 'buildClockCase', 'buildCdRack', 'buildPipeShelf'].includes(name)) continue
    try {
      list.push([`builtin:${name}`, fn(pkg)])
    } catch (e) {
      list.push([`builtin:${name}`, { items: [], _error: e.message }])
    }
  }
  const mockPath = new URL('../src/data/mock/square_frame.json', import.meta.url)
  list.push(['src/data/mock/square_frame.json', JSON.parse(await readFile(mockPath, 'utf8'))])
  return list
}

/** 讀檔：容許純 JSON、```json 程式碼框、或 claude.ai 回覆的前後說明文字 */
async function readDesign(file) {
  const text = await readFile(file, 'utf8')
  try {
    const j = JSON.parse(text.replace(/^﻿/, ''))
    return Array.isArray(j) ? { items: j } : j
  } catch {
    const parsed = ctx.copilot.parseAssemblyText(text)
    return parsed
  }
}

if (dumpDir) {
  await mkdir(dumpDir, { recursive: true })
  for (const [name, a] of await builtinDesigns()) {
    if (!name.startsWith('builtin:')) continue
    const out = path.join(dumpDir, `${name.slice(8)}.json`)
    await writeFile(out, JSON.stringify(a, null, 2) + '\n')
    if (!asJson) console.log(`已輸出 ${out}`)
  }
  if (!files.length && !flags.has('--builtin')) process.exit(0)
}

const targets = []
if (flags.has('--builtin')) targets.push(...(await builtinDesigns()))
for (const f of files) {
  try {
    targets.push([f, await readDesign(f)])
  } catch (e) {
    if (asJson) console.log(JSON.stringify({ file: f, ok: false, fatal: e.message }))
    else console.error(`無法讀取 ${f}：${e.message}`)
    process.exit(2)
  }
}

const reports = targets.map(([file, raw]) => ({ file, ...analyzeAssembly(raw, ctx) }))
const failed = reports.filter((r) => !r.ok || (strict && r.counts.warnings > 0))

if (asJson) {
  console.log(JSON.stringify(reports.length === 1 ? reports[0] : { ok: failed.length === 0, reports }, null, 2))
} else {
  for (const r of reports) printReport(r)
  if (reports.length > 1) {
    console.log(`\n共 ${reports.length} 份設計：${reports.length - failed.length} 份通過、${failed.length} 份未通過。`)
  }
}
process.exit(failed.length ? 1 : 0)

function printReport(r) {
  const LV = { error: '錯誤', warning: '警告', info: '提示' }
  const MARK = { error: '✗', warning: '!', info: '·' }
  const pass = r.ok && !(strict && r.counts.warnings)
  console.log('─'.repeat(64))
  console.log(`BuildM8 設計檢查：${r.file}`)
  if (r.title) console.log(`標題：${r.title}`)
  console.log(`結果：${pass ? '通過' : '未通過'}（${r.counts.errors} 個錯誤、${r.counts.warnings} 個警告、${r.counts.infos} 個提示）`)
  console.log(`零件數：${r.partCount} 件${r.rawItemCount !== r.partCount ? `（檔案內 ${r.rawItemCount} 項，${r.rawItemCount - r.partCount} 項無法使用）` : ''}`)
  if (r.dimensions) {
    const d = r.dimensions
    const cm = (v) => (v / 10).toFixed(1)
    console.log(`整體尺寸：寬 ${d.width} × 高 ${d.height} × 深 ${d.depth} mm（約 ${cm(d.width)} × ${cm(d.height)} × ${cm(d.depth)} cm）`)
  }
  for (const level of ['error', 'warning', 'info']) {
    const list = r.issues.filter((x) => x.level === level)
    if (!list.length) continue
    console.log(`\n${LV[level]}（${list.length}）`)
    const shown = level === 'info' ? list.slice(0, 12) : list
    for (const x of shown) console.log(`  ${MARK[level]} ${x.message}`)
    if (shown.length < list.length) console.log(`  …另有 ${list.length - shown.length} 個提示（用 --json 看完整內容）`)
  }
  if (r.bom.length) {
    console.log('\n採購清單（參考價）')
    for (const b of r.bom) {
      console.log(`  ${b.name}${b.spec ? ` ${b.spec}` : ''} × ${b.qty} ${b.unit}　約 NT$ ${b.subtotal}`)
    }
    console.log(`  合計約 NT$ ${r.totalPrice}（實際價格依店家而異）`)
  }
  console.log('')
}
