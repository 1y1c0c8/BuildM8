// 讓 Node 能載入 Vite 風格的無副檔名匯入（'../data/schema' → schema.js / index.js）
// 用法：node --import ./tests/register.mjs --test 'tests/**/*.test.mjs'
import { register } from 'node:module'
register('./resolve-hook.mjs', import.meta.url)
