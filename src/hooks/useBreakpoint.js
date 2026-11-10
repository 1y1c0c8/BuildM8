import { useSyncExternalStore } from 'react'

/**
 * 版面斷點（與 Tailwind 預設一致）
 *  - mobile : < 768px  （md 以下）→ 抽屜 + 底部面板 + 底部導覽列
 *  - tablet : 768–1023 （md）     → 左側可收合欄 + 右側滑出面板
 *  - desktop: ≥ 1024   （lg）     → 三欄並排
 */
const QUERIES = { mobile: '(max-width: 767.98px)', tablet: '(min-width: 768px) and (max-width: 1023.98px)' }

function read() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  if (window.matchMedia(QUERIES.mobile).matches) return 'mobile'
  if (window.matchMedia(QUERIES.tablet).matches) return 'tablet'
  return 'desktop'
}

function subscribe(cb) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mqs = Object.values(QUERIES).map((q) => window.matchMedia(q))
  mqs.forEach((m) => m.addEventListener('change', cb))
  return () => mqs.forEach((m) => m.removeEventListener('change', cb))
}

export function useBreakpoint() {
  return useSyncExternalStore(subscribe, read, () => 'desktop')
}

export const getBreakpoint = read
