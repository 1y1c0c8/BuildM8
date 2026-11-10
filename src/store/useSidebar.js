import { create } from 'zustand'

/** 左側零件庫的收合狀態（每個瀏覽器各自記住；storage 不可用時仍可正常運作） */
const KEY = 'buildm8.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(v) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    // 無痕模式或封鎖網站資料時忽略
  }
}

export const useSidebar = create((set, get) => ({
  collapsed: readCollapsed(),
  cat: 'all',
  setCat: (cat) => set({ cat }),
  setCollapsed(collapsed) {
    writeCollapsed(collapsed)
    set({ collapsed })
  },
  toggle() {
    get().setCollapsed(!get().collapsed)
  },
  /** 從收合軌道點分類：展開並切到該分類 */
  openCategory(cat) {
    writeCollapsed(false)
    set({ collapsed: false, cat })
  },
}))
