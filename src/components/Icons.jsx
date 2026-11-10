/** 精簡線條圖示（lucide 風格，inline SVG，無外部依賴） */
const I = ({ d, size = 16, className = '', stroke = 1.7, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {d ? <path d={d} /> : children}
  </svg>
)
export const IconMove = (p) => <I {...p} d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
export const IconRotate = (p) => <I {...p} d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
export const IconUndo = (p) => <I {...p} d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
export const IconRedo = (p) => <I {...p} d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
export const IconTrash = (p) => <I {...p} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
export const IconCopy = (p) => <I {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I>
export const IconSparkle = (p) => <I {...p} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 3v4M21 5h-4M5 17v4M7 19H3" />
export const IconMagnet = (p) => <I {...p} d="M6 3v8a6 6 0 0 0 12 0V3M6 3h4v8a2 2 0 0 0 4 0V3h4M6 7h4M14 7h4" />
export const IconGrid = (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></I>
export const IconSend = (p) => <I {...p} d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
export const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></I>
export const IconSettings = (p) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>
export const IconChevron = (p) => <I {...p} d="M6 9l6 6 6-6" />
export const IconCart = (p) => <I {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></I>
export const IconCode = (p) => <I {...p} d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
export const IconBox = (p) => <I {...p} d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />
export const IconX = (p) => <I {...p} d="M18 6L6 18M6 6l12 12" />
export const IconCheck = (p) => <I {...p} d="M20 6L9 17l-5-5" />
export const IconKeyboard = (p) => <I {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></I>
export const IconKey = (p) => <I {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L21 2M16 7l3 3M18.5 4.5l2 2" /></I>
export const IconLock = (p) => <I {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>
export const IconUnlock = (p) => <I {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.8-1.2" /></I>
export const IconEye = (p) => <I {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>
export const IconEyeOff = (p) => <I {...p} d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
export const IconShield = (p) => <I {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
export const IconDownload =(p) => <I {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />

/** 零件縮圖：依 geometry.type 畫等角示意 */
export function PartGlyph({ type, className = '' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' }
  const g = {
    perforated_bar: (
      <g {...common}>
        <path d="M6 30 L34 14 L42 18 L14 34 Z" />
        {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx={12 + i * 6} cy={29 - i * 3.4} rx="1.7" ry="1" />)}
      </g>
    ),
    l_bracket: (
      <g {...common}>
        <path d="M10 34 L30 24 L38 28 L18 38 Z" />
        <path d="M10 34 L10 14 L18 18 L18 38" />
        <ellipse cx="26" cy="30" rx="2" ry="1.1" />
        <ellipse cx="14" cy="22" rx="1.1" ry="2" />
      </g>
    ),
    threaded_rod: (
      <g {...common}>
        <path d="M21 6 L21 42 M27 6 L27 42" />
        <ellipse cx="24" cy="6" rx="3" ry="1.4" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <path key={i} d={`M21 ${10 + i * 3.8} L27 ${8.4 + i * 3.8}`} strokeWidth="1" />)}
      </g>
    ),
    hex_bolt: (
      <g {...common}>
        <path d="M16 10 L20 7 L28 7 L32 10 L28 13 L20 13 Z" />
        <path d="M16 10 L16 14 L20 17 L28 17 L32 14 L32 10" />
        <path d="M21.5 17 L21.5 41 M26.5 17 L26.5 41" />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M21.5 ${22 + i * 4} L26.5 ${20.5 + i * 4}`} strokeWidth="1" />)}
      </g>
    ),
    hex_nut: (
      <g {...common}>
        <path d="M10 20 L17 14 L31 14 L38 20 L31 26 L17 26 Z" />
        <path d="M10 20 L10 27 L17 33 L31 33 L38 27 L38 20 M17 26 L17 33 M31 26 L31 33" />
        <ellipse cx="24" cy="20" rx="5" ry="2.6" />
      </g>
    ),
    cap_nut: (
      <g {...common}>
        <path d="M12 26 L18 21 L30 21 L36 26 L30 31 L18 31 Z" />
        <path d="M12 26 L12 31 L18 36 L30 36 L36 31 L36 26" />
        <path d="M15 24 C15 10, 33 10, 33 24" />
      </g>
    ),
    washer: (
      <g {...common}>
        <ellipse cx="24" cy="22" rx="14" ry="7" />
        <ellipse cx="24" cy="22" rx="6" ry="3" />
        <path d="M10 22 L10 25 C10 29, 38 29, 38 25 L38 22" />
      </g>
    ),
    pipe: (
      <g {...common}>
        <ellipse cx="14" cy="14" rx="4" ry="5" transform="rotate(-30 14 14)" />
        <path d="M11 10.5 L34 31 M17 17.5 L39 37" />
        <ellipse cx="36.5" cy="34" rx="4" ry="5" transform="rotate(-30 36.5 34)" />
      </g>
    ),
    tee: (
      <g {...common}>
        <path d="M6 22 L42 22 L42 32 L6 32 Z" />
        <path d="M19 22 L19 8 L29 8 L29 22" />
        <path d="M6 21 L6 33 M42 21 L42 33 M18 8 L30 8" strokeWidth="2.6" />
      </g>
    ),
    elbow: (
      <g {...common}>
        <path d="M10 26 L28 26 L28 8 L38 8 L38 26 C38 32, 34 36, 28 36 L10 36 Z" />
        <path d="M10 25 L10 37 M27 8 L39 8" strokeWidth="2.6" />
      </g>
    ),
    flange: (
      <g {...common}>
        <ellipse cx="24" cy="30" rx="16" ry="7" />
        <path d="M8 30 L8 33 C8 40, 40 40, 40 33 L40 30" />
        <path d="M18 29 L18 14 M30 29 L30 14" />
        <ellipse cx="24" cy="14" rx="6" ry="2.6" />
        {[[13, 29], [35, 29], [24, 25], [24, 34]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" />)}
      </g>
    ),
    panel: (
      <g {...common}>
        <path d="M6 26 L26 14 L42 22 L22 34 Z" />
        <path d="M6 26 L6 29 L22 37 L42 25 L42 22 M22 34 L22 37" />
        {[[11, 26], [26, 17.5], [37, 22], [22, 31]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="1.4" ry=".8" />)}
      </g>
    ),
    // ───── v1.1 新增 ─────
    mending_plate: (
      <g {...common}>
        <path d="M6 30 L32 15 L42 20 L16 35 Z" />
        <path d="M6 30 L6 32 L16 37 L42 22 L42 20" />
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={13 + i * 7.5} cy={30.5 - i * 4.3} rx="1.6" ry=".9" />)}
      </g>
    ),
    t_plate: (
      <g {...common}>
        <path d="M5 22 L25 10 L33 14 L24 19.5 L38 28 L30 33 L16 24.5 L13 26.5 Z" />
        <path d="M5 22 L5 24 L13 28.5 L16 26.5 M30 33 L30 35 L38 30 L38 28" />
        {[[11, 22], [20, 16.5], [27, 27], [32, 30]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="1.4" ry=".8" />)}
      </g>
    ),
    shelf_bracket: (
      <g {...common}>
        <path d="M10 8 L10 40 L40 40" strokeWidth="3.2" />
        <path d="M11.5 22 L26 38.5" strokeWidth="2.4" />
        <circle cx="10" cy="14" r="1" />
        <circle cx="10" cy="30" r="1" />
        <circle cx="20" cy="40" r="1" />
        <circle cx="34" cy="40" r="1" />
      </g>
    ),
    wing_nut: (
      <g {...common}>
        <path d="M18 36 L18 26 C18 24, 30 24, 30 26 L30 36 C30 38.5, 18 38.5, 18 36 Z" />
        <path d="M18 27 C12 20, 6 14, 6 10 C8 8, 12 9, 14 12 C16 16, 18 22, 19 25" />
        <path d="M30 27 C36 20, 42 14, 42 10 C40 8, 36 9, 34 12 C32 16, 30 22, 29 25" />
        <ellipse cx="24" cy="25.5" rx="3" ry="1.2" />
      </g>
    ),
    nylon_nut: (
      <g {...common}>
        <path d="M10 24 L17 18 L31 18 L38 24 L31 30 L17 30 Z" />
        <path d="M10 24 L10 31 L17 37 L31 37 L38 31 L38 24 M17 30 L17 37 M31 30 L31 37" />
        <path d="M14 21 C14 12, 34 12, 34 21" />
        <ellipse cx="24" cy="13.5" rx="7" ry="2.4" strokeWidth="2.4" />
      </g>
    ),
    coupling_nut: (
      <g {...common}>
        <path d="M14 10 L19 7 L29 7 L34 10 L29 13 L19 13 Z" />
        <path d="M14 10 L14 38 L19 41 L29 41 L34 38 L34 10 M19 13 L19 41 M29 13 L29 41" />
        <ellipse cx="24" cy="10" rx="3" ry="1.5" />
      </g>
    ),
    spring_washer: (
      <g {...common}>
        <path d="M27 17 C36 17, 40 20, 40 24 C40 29, 33 31, 24 31 C15 31, 8 29, 8 24 C8 19, 14 16, 22 16" />
        <path d="M27 21 C31 21, 33 22.5, 33 24 C33 26, 29 27, 24 27 C19 27, 15 26, 15 24 C15 22, 18 20.5, 22 20" />
        <path d="M22 16 L22 20 M27 17 L27 21" />
      </g>
    ),
    eye_bolt: (
      <g {...common}>
        <circle cx="24" cy="13" r="8" strokeWidth="3" />
        <path d="M18 23 L30 23 L31 26 L17 26 Z" />
        <path d="M21.5 26 L21.5 42 M26.5 26 L26.5 42" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M21.5 ${30 + i * 3.5} L26.5 ${28.5 + i * 3.5}`} strokeWidth="1" />)}
      </g>
    ),
    wood_screw: (
      <g {...common}>
        <path d="M14 8 L34 8 L26 15 L22 15 Z" />
        <path d="M20 8 L28 8 M24 6 L24 10" strokeWidth="1.2" />
        <path d="M22 15 L22 34 L24 42 L26 34 L26 15" />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M20.5 ${19 + i * 3.4} L27.5 ${17 + i * 3.4}`} strokeWidth="1" />)}
      </g>
    ),
    carriage_bolt: (
      <g {...common}>
        <path d="M12 14 C12 6, 36 6, 36 14 Z" />
        <path d="M20 14 L28 14 L28 19 L20 19 Z" />
        <path d="M21.5 19 L21.5 42 M26.5 19 L26.5 42" />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M21.5 ${24 + i * 3.6} L26.5 ${22.5 + i * 3.6}`} strokeWidth="1" />)}
      </g>
    ),
    u_bolt: (
      <g {...common}>
        <path d="M13 40 L13 22 A11 11 0 0 1 35 22 L35 40" strokeWidth="3" />
        <circle cx="24" cy="22" r="6.5" strokeDasharray="2 2" />
        {[0, 1, 2].map((i) => <path key={i} d={`M11 ${32 + i * 3} L15 ${31 + i * 3} M33 ${32 + i * 3} L37 ${31 + i * 3}`} strokeWidth="1" />)}
      </g>
    ),
    cross: (
      <g {...common}>
        <path d="M6 19 L19 19 L19 6 L29 6 L29 19 L42 19 L42 29 L29 29 L29 42 L19 42 L19 29 L6 29 Z" />
        <path d="M6 18 L6 30 M42 18 L42 30 M18 6 L30 6 M18 42 L30 42" strokeWidth="2.6" />
      </g>
    ),
    elbow45: (
      <g {...common}>
        <path d="M18 42 L18 24 L31 11 L38 18 L28 28 L28 42 Z" />
        <path d="M17 42 L29 42 M30.3 10.3 L38.7 18.7" strokeWidth="2.6" />
      </g>
    ),
    pipe_cap: (
      <g {...common}>
        <path d="M13 36 L13 16 C13 10, 35 10, 35 16 L35 36" />
        <ellipse cx="24" cy="36" rx="11" ry="4" />
        <path d="M12 33 L12 37 M36 33 L36 37" strokeWidth="2.4" />
      </g>
    ),
    reducer: (
      <g {...common}>
        <path d="M12 6 L36 6 L36 18 L30 28 L30 42 L18 42 L18 28 L12 18 Z" />
        <path d="M11 6 L37 6 M17 42 L31 42" strokeWidth="2.6" />
      </g>
    ),
    hinge: (
      <g {...common}>
        <path d="M6 10 L21 10 L21 38 L6 38 Z M27 10 L42 10 L42 38 L27 38 Z" />
        <path d="M21 9 L27 9 L27 39 L21 39 Z" />
        <path d="M21 15 L27 15 M21 21 L27 21 M21 27 L27 27 M21 33 L27 33" strokeWidth="1" />
        {[14, 24, 34].map((y) => <g key={y}><circle cx="13" cy={y} r="1.3" /><circle cx="35" cy={y} r="1.3" /></g>)}
      </g>
    ),
    caster: (
      <g {...common}>
        <path d="M10 8 L38 8 L38 11 L10 11 Z" />
        <path d="M18 11 L30 11 L28 15 L20 15 Z" />
        <path d="M17 15 L17 30 M31 15 L31 30 M17 15 L31 15" />
        <circle cx="24" cy="31" r="10" />
        <circle cx="24" cy="31" r="3.5" />
      </g>
    ),
    // ───── v1.2 新增 ─────
    u_folded_plate: (
      <g {...common}>
        <path d="M8 16 L8 36 L30 42 L30 22" />
        <path d="M8 16 L18 11 L18 31 M30 22 L40 17 L40 37 L30 42" />
        <path d="M8 36 L18 31 L40 37" strokeDasharray="2 2" strokeWidth="1" />
        <ellipse cx="19" cy="36.5" rx="1.8" ry="1" />
        <circle cx="13" cy="22" r=".9" />
        <circle cx="35" cy="27" r=".9" />
      </g>
    ),
    clock_movement: (
      <g {...common}>
        <path d="M8 22 L24 14 L40 22 L24 30 Z" />
        <path d="M8 22 L8 28 L24 36 L40 28 L40 22 M24 30 L24 36" />
        <path d="M24 22 L24 8" strokeWidth="2.2" />
        <path d="M24 10 L16 6 M24 12 L33 9" strokeWidth="1.8" />
        <path d="M24 9 L28 16" stroke="#ef4444" strokeWidth="1.2" />
      </g>
    ),
  }
  return (
    <svg viewBox="0 0 48 48" className={className}>
      {g[type] ?? <rect x="12" y="12" width="24" height="24" {...common} />}
    </svg>
  )
}
