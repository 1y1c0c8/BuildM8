import { create } from 'zustand'

/**
 * 小螢幕用的浮動面板狀態（桌面版三欄並排時不使用）
 *  - 'parts' : 左側零件庫抽屜（手機）
 *  - 'ai'    : AI 助手（手機底部面板／平板右側面板）
 *  - 'bom'   : 採購清單（手機底部面板／平板右側面板）
 */
export const useLayout = create((set, get) => ({
  panel: null,
  open: (panel) => set({ panel }),
  close: () => set({ panel: null }),
  toggle: (panel) => set({ panel: get().panel === panel ? null : panel }),
}))
