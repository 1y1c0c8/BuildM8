/**
 * Node ESM resolve hook：讓 Node 直接載入 src/ 內「省略副檔名」的 import
 * （例 `import { x } from '../data/parts'`，Vite 可以、Node 預設不行）。
 * 只處理相對路徑；找不到時依序嘗試 .js / .mjs / index.js。
 */
const EXTS = ['.js', '.mjs', '/index.js', '/index.mjs']

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../')
    if (!relative || (err?.code !== 'ERR_MODULE_NOT_FOUND' && err?.code !== 'ERR_UNSUPPORTED_DIR_IMPORT')) throw err
    for (const ext of EXTS) {
      try {
        return await nextResolve(specifier + ext, context)
      } catch {
        /* 試下一個 */
      }
    }
    throw err
  }
}
