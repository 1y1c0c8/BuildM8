import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { bomLabel } from '../data/parts'
import { PartGlyph, IconCopy, IconTrash, IconRotate } from './Icons'

const AX = ['X', 'Y', 'Z']
const AX_COLOR = ['text-red-400', 'text-green-400', 'text-blue-400']
const PATTERN_LABEL = { none: '無孔', corners: '四角孔', rack_2x8: '2×8 排孔' }

/** 選取零件的屬性浮動面板 */
export function Inspector() {
  const selectedId = useStore((s) => s.selectedId)
  const item = useStore((s) => s.items.find((i) => i.uid === s.selectedId))
  const packageId = useStore((s) => s.packageId)
  const { setParam, updateItem, rotateBy, removeItem, duplicate } = useStore.getState()
  if (!selectedId || !item) return null
  const def = getPackage(packageId).parts.find((p) => p.id === item.partId)
  if (!def) return null
  const label = bomLabel(def, item.params)

  return (
    <div className="absolute inset-x-2 bottom-2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:max-w-[calc(100%-32px)] panel rounded-2xl p-2.5 md:p-3 flex items-stretch gap-3 overflow-x-auto scroll-thin overscroll-x-contain [&>*]:shrink-0 animate-rise z-10">
      <div className="flex items-center gap-2.5 pr-3 border-r border-white/5">
        <div className="size-11 rounded-xl bg-brand/10 text-brand-soft grid place-items-center">
          <PartGlyph type={def.geometry.type} className="size-9" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold whitespace-nowrap">{def.name['zh-TW']}</div>
          <div className="text-[10px] text-ink-400 font-mono whitespace-nowrap">{label.standard}</div>
        </div>
      </div>

      {def.params && (
        <div className="flex items-center gap-2 pr-3 border-r border-white/5">
          {Object.entries(def.params).map(([k, spec]) => (
            <label key={k} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-ink-400">{spec.label ?? k}</span>
              <select
                value={item.params[k]}
                onChange={(e) => setParam(item.uid, k, typeof spec.default === 'number' ? Number(e.target.value) : e.target.value)}
                className="h-7 px-1.5 rounded-md bg-ink-800 border border-white/10 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                {[...new Set([...spec.options, item.params[k]])].map((o) => (
                  <option key={o} value={o}>
                    {PATTERN_LABEL[o] ?? o}
                    {spec.unit ? ` ${spec.unit}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 pr-3 border-r border-white/5">
        {AX.map((a, i) => (
          <label key={a} className="flex flex-col gap-0.5">
            <span className={`text-[10px] font-semibold ${AX_COLOR[i]}`}>{a} mm</span>
            <input
              type="number"
              step={5}
              value={item.position[i]}
              onChange={(e) => {
                const p = [...item.position]
                p[i] = Number(e.target.value)
                updateItem(item.uid, { position: p })
              }}
              className="w-[68px] h-7 px-1.5 rounded-md bg-ink-800 border border-white/10 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-1 pr-3 border-r border-white/5">
        {AX.map((a, i) => (
          <button
            key={a}
            onClick={() => rotateBy(item.uid, i, 90)}
            title={`繞 ${a} 軸旋轉 90°`}
            className="h-11 w-9 rounded-lg bg-ink-800 border border-white/5 hover:border-white/20 flex flex-col items-center justify-center gap-0.5"
          >
            <IconRotate size={13} className={AX_COLOR[i]} />
            <span className="text-[9px] font-mono text-ink-300">{a}90°</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => duplicate(item.uid)} title="複製 (Ctrl+D)" className="size-9 rounded-lg grid place-items-center text-ink-300 hover:text-white hover:bg-white/5">
          <IconCopy size={15} />
        </button>
        <button onClick={() => removeItem(item.uid)} title="刪除 (Delete)" className="size-9 rounded-lg grid place-items-center text-red-300 hover:text-red-200 hover:bg-red-500/10">
          <IconTrash size={15} />
        </button>
      </div>
    </div>
  )
}
