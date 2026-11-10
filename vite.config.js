import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 相對路徑：GitHub Pages 的 /BuildM8/ 子路徑與本機都能直接使用
  base: './',
  plugins: [react(), tailwindcss()],
})
