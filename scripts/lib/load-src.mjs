/**
 * 在 Node 載入網站原始碼（src/）的共用入口。
 * 先註冊「省略副檔名」的 resolve hook，再動態 import 驗證 / 幾何需要的模組。
 */
import { register } from 'node:module'

register('./extless-hooks.mjs', import.meta.url)

const src = (p) => new URL(`../../src/${p}`, import.meta.url).href

export async function loadSrc() {
  const [parts, copilot, packages, geometry, builders, schema] = await Promise.all([
    import(src('data/parts.js')),
    import(src('ai/copilot.js')),
    import(src('data/packages/index.js')),
    import(src('three/geometry.js')),
    import(src('ai/builders.js')),
    import(src('data/schema.js')),
  ])
  return { parts, copilot, packages, geometry, builders, schema }
}
