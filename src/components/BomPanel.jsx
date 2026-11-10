import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { bomKey, bomLabel } from '../data/parts'
import { IconCart, IconChevron, IconCopy, IconDownload, IconCheck } from './Icons'

/** 自動生成標準採購清單（依 partId + 規格參數合併計數） */
export function useBom() {
  const items = useStore((s) => s.items)
  const packageId = useStore((s) => s.packageId)
  return useMemo(() => {
    const pkg = getPackage(packageId)
    const map = new Map()
    for (const it of items) {
      const def = pkg.parts.find((p) => p.id === it.partId)
      if (!def) continue
      const k = bomKey(it)
      const row = map.get(k) ?? { key: k, def, ...bomLabel(def, it.params), qty: 0, price: def.priceTWD }
      row.qty += 1
      map.set(k, row)
    }
    const rows = [...map.values()].sort((a, b) => order(a.def) - order(b.def) || b.qty - a.qty)
    const total = rows.reduce((s, r) => s + r.qty * r.price, 0)
    const count = rows.reduce((s, r) => s + r.qty, 0)
    return { rows, total, count }
  }, [items, packageId])
}
const ORDER = ['panel', 'pipe', 'fitting', 'profile', 'bracket', 'rod', 'fastener']
const order = (def) => ORDER.indexOf(def.category)

export function BomPanel() {
  const { rows, total, count } = useBom()
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const asText = () =>
    [
      'BuildM8 採購清單（台灣五金行）',
      ...rows.map((r) => `□ ${r.name}${r.spec ? ` ${r.spec}` : ''}［${r.standard}］ × ${r.qty} ${r.unit}`),
      `合計 ${count} 件，參考價約 NT$ ${total}`,
    ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* 剪貼簿不可用 */
    }
  }
  const downloadCsv = () => {
    const csv = ['品名,規格,標準,數量,單位,參考單價(TWD)', ...rows.map((r) => [r.name, r.spec, r.standard, r.qty, r.unit, r.price].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'buildm8-bom.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className={`shrink-0 border-t border-white/[0.06] flex flex-col ${open ? 'max-h-[44%]' : ''}`}>
      <button onClick={() => setOpen((v) => !v)} className="h-11 shrink-0 px-4 flex items-center gap-2 hover:bg-white/[0.02]">
        <IconCart size={15} className="text-brand" />
        <span className="text-sm font-semibold">採購清單 BOM</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-ink-300">{count} 件</span>
        <span className="ml-auto text-xs font-mono text-ink-300">≈ NT$ {total.toLocaleString()}</span>
        <IconChevron size={14} className={`text-ink-400 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-3">
            {!rows.length && (
              <div className="text-center text-xs text-ink-400 py-6 leading-relaxed">
                畫布上還沒有零件
                <br />
                從左側拖曳零件，或請 AI 幫你設計
              </div>
            )}
            <ul className="space-y-1 pb-2">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] animate-rise">
                  <span className="min-w-9 h-6 px-1.5 rounded-md bg-brand/15 text-brand-soft text-xs font-bold font-mono grid place-items-center">×{r.qty}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium truncate">
                      {r.name} {r.spec && <span className="text-ink-300">{r.spec}</span>}
                    </div>
                    <div className="text-[10px] text-ink-400 font-mono truncate">{r.standard}</div>
                  </div>
                  <span className="text-[10px] text-ink-400 font-mono">{r.unit}</span>
                </li>
              ))}
            </ul>
          </div>
          {rows.length > 0 && (
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2 shrink-0">
              <button onClick={copy} className="h-8 rounded-lg bg-white text-ink-950 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-ink-100">
                {copied ? <IconCheck size={13} /> : <IconCopy size={13} />} {copied ? '已複製' : '複製清單'}
              </button>
              <button onClick={downloadCsv} className="h-8 rounded-lg bg-ink-800 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 hover:border-white/20">
                <IconDownload size={13} /> 匯出 CSV
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
