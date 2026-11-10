import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildManualPrompt, buildRevisionPrompt, assemblyForPrompt, parseAssemblyText } from '../src/ai/copilot.js'
import { designGuideText, designGuideMarkdown, getStyle, STYLE_VOCABULARY } from '../src/ai/designGuide.js'
import { ASSEMBLY_JSON_SCHEMA } from '../src/data/schema.js'
import { getPackage } from '../src/data/packages/index.js'

const pkg = getPackage('taiwan_hardware_store_v1')
const mock = JSON.parse(readFileSync(new URL('../src/data/mock/square_frame.json', import.meta.url), 'utf8'))
const fence = (s, lang = 'json') => '```' + lang + '\n' + s + '\n```'

test('manual prompt: three roles, guide, schema, ends with the request', () => {
  const p = buildManualPrompt('  做一個桌上手機架  ', pkg)
  for (const s of ['角色 1　設計師', '角色 2　工程師', '角色 3　檢查員', '最終輸出', '【設計指南】', '3 個明顯不同的概念']) {
    assert.ok(p.includes(s), `missing ${s}`)
  }
  assert.ok(p.includes(JSON.stringify(ASSEMBLY_JSON_SCHEMA)))
  assert.ok(p.indexOf('角色 1') < p.indexOf('角色 2') && p.indexOf('角色 2') < p.indexOf('角色 3'))
  assert.ok(p.trimEnd().endsWith('使用者需求：\n做一個桌上手機架'))
  assert.ok(!p.includes('角色 0'))
  assert.ok(p.length < 24000, `prompt too long: ${p.length}`)
})

test('manual prompt: style and reference images', () => {
  const p = buildManualPrompt('層架', pkg, { style: '日式木作', withImages: true })
  assert.ok(p.includes('角色 0　參考圖片分析'))
  assert.ok(p.indexOf('角色 0') < p.indexOf('角色 1'))
  assert.ok(p.includes('本次指定風格「日式木作」'))
  assert.ok(p.trimEnd().endsWith('使用者需求（風格：日式木作）：\n層架'))
})

test('design guide exports', () => {
  assert.ok(designGuideText().length < 3000)
  assert.ok(designGuideMarkdown().startsWith('# BuildM8 設計指南'))
  assert.equal(getStyle('industrial').label, '工業風')
  assert.equal(getStyle('包浩斯').key, 'bauhaus')
  assert.ok(STYLE_VOCABULARY.length >= 5)
})

test('revision prompt: includes current JSON and feedback', () => {
  const items = [{ uid: 'a', partId: 'threaded_rod', params: { size: 'M8', length: 300 }, position: [1.234, 150, 0], rotation: [0, 0, 0], spawn: null }]
  const assembly = assemblyForPrompt(items, { title: '立柱' })
  assert.deepEqual(assembly.items[0].params, { size: 'M8', length: 300, width: null, depth: null, thickness: null, pattern: null })
  assert.deepEqual(assembly.items[0].position, [1.2, 150, 0])
  const p = buildRevisionPrompt({ assembly, feedback: '再高一點', pkg })
  assert.ok(p.includes(JSON.stringify(assembly)))
  assert.ok(p.includes('截圖'))
  assert.ok(p.includes('角色 3　檢查員'))
  assert.ok(p.includes(JSON.stringify(ASSEMBLY_JSON_SCHEMA)))
  assert.ok(p.trimEnd().endsWith('使用者回饋：\n再高一點'))
  const short = buildRevisionPrompt({ assembly, pkg, sameChat: true, withScreenshot: false })
  assert.ok(short.length < 6000 && !short.includes('截圖'))
  assert.ok(short.includes('沒有特別意見'))
})

test('parse: picks the final valid assembly among several code blocks', () => {
  const draft = { title: '草稿', summary: '', steps: [], items: [{ partId: 'hex_nut', position: [0, 0, 0], rotation: [0, 0, 0] }] }
  const final = { ...mock, title: '最終版' }
  const reply = [
    '## 角色 2　工程師',
    fence('rod_y = 300 / 2 = 150\nnut_y = 3.25', 'text'),
    fence(JSON.stringify([1, 2, 3])),
    '草稿：',
    fence(JSON.stringify(draft)),
    '## 角色 3　檢查員\n✔ 全部通過',
    fence(JSON.stringify(final, null, 2)),
  ].join('\n\n')
  const r = parseAssemblyText(reply)
  assert.equal(r.title, '最終版')
  assert.equal(r.items.length, mock.items.length)
})

test('parse: complete assembly preferred over a trailing items-only snippet', () => {
  const reply = fence(JSON.stringify(mock)) + '\n補充：\n' + fence(JSON.stringify([{ partId: 'washer', position: [0, 0, 0] }]))
  assert.equal(parseAssemblyText(reply).items.length, mock.items.length)
})

test('parse: unfenced JSON after prose containing brackets', () => {
  const reply = `角色 1 [概念 A] 比例 {寬:高} = 2:3\n最終：\n${JSON.stringify(mock)}\n`
  assert.equal(parseAssemblyText(reply).title, mock.title)
})

test('parse: old cases still work', () => {
  assert.equal(parseAssemblyText('好的！\n' + fence(JSON.stringify(mock)) + '\n祝順利').title, mock.title)
  assert.equal(parseAssemblyText(JSON.stringify(mock)).items.length, mock.items.length)
  assert.equal(parseAssemblyText('﻿' + JSON.stringify(mock)).title, mock.title)
  const arr = parseAssemblyText(JSON.stringify(mock.items))
  assert.equal(arr.items.length, mock.items.length)
  assert.equal(arr.title, '來自 Claude 的設計')
  assert.equal(parseAssemblyText(JSON.stringify({ assembly: mock })).title, mock.title)
  assert.throws(() => parseAssemblyText('   '), /還沒有貼上內容/)
  assert.throws(() => parseAssemblyText('這不是 JSON'), /看不懂這段內容/)
  assert.throws(() => parseAssemblyText('{"title":"x","items":[]}'), /找不到 items/)
  assert.throws(() => parseAssemblyText('{"title":"x","items":[1,2]'), /看不懂這段內容/)
})
