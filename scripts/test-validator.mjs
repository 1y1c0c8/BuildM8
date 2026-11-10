#!/usr/bin/env node
/**
 * 驗證工具自我測試：
 *   - 網站內建參考設計（builders.js + mock）必須全部通過
 *   - scripts/fixtures/*.json 依各檔 `_expect` 欄位：結束代碼與必須出現的問題代碼
 *
 *   npm run test:validator
 */
import { readdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const cli = path.join(here, 'validate-design.mjs')
const run = (args) => {
  const r = spawnSync(process.execPath, [cli, ...args, '--json'], { encoding: 'utf8' })
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    /* 留給下方報錯 */
  }
  return { code: r.status, json, stderr: r.stderr }
}

let fail = 0
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fail++
}

const builtin = run(['--builtin'])
for (const r of builtin.json?.reports ?? []) {
  ok(r.ok && r.counts.warnings === 0, `${r.file}：${r.counts.errors} 錯誤 / ${r.counts.warnings} 警告 / ${r.counts.infos} 提示`)
}
ok(builtin.code === 0, `--builtin 結束代碼 ${builtin.code}`)

const dir = path.join(here, 'fixtures')
for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json')).sort()) {
  const file = path.join(dir, f)
  const expect = JSON.parse(await readFile(file, 'utf8'))._expect ?? { exit: 0, codes: [] }
  const r = run([file])
  const codes = new Set((r.json?.issues ?? []).map((x) => x.code))
  const missing = expect.codes.filter((c) => !codes.has(c))
  ok(r.code === expect.exit && !missing.length, `${f}：結束代碼 ${r.code}（預期 ${expect.exit}）${missing.length ? `，缺少 ${missing.join(', ')}` : ''}；問題代碼 [${[...codes].join(', ')}]`)
  if (expect.strictExit !== undefined) {
    const s = run([file, '--strict'])
    ok(s.code === expect.strictExit, `${f} --strict：結束代碼 ${s.code}（預期 ${expect.strictExit}）`)
  }
}

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
