import * as THREE from 'three'

/** 螺紋：用 Canvas 產生條紋貼圖當 bump/roughness，避免真的建模牙紋 */
function threadTexture() {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 32
  const ctx = c.getContext('2d')
  const grd = ctx.createLinearGradient(0, 0, 0, 32)
  grd.addColorStop(0, '#222')
  grd.addColorStop(0.5, '#fff')
  grd.addColorStop(1, '#222')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, 4, 32)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function woodTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#d8b88a'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 512
    ctx.strokeStyle = `rgba(${150 + Math.random() * 40},${110 + Math.random() * 30},${70 + Math.random() * 20},${0.12 + Math.random() * 0.18})`
    ctx.lineWidth = 0.6 + Math.random() * 2.4
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4 + (Math.random() - 0.5) * 2)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

let base = null
function baseMaterials() {
  if (base) return base
  const thread = threadTexture()
  base = {
    zinc: new THREE.MeshStandardMaterial({ color: '#c7ccd3', metalness: 0.9, roughness: 0.32 }),
    stainless: new THREE.MeshStandardMaterial({ color: '#e4e7eb', metalness: 1, roughness: 0.16 }),
    galvanized: new THREE.MeshStandardMaterial({ color: '#a9b0b8', metalness: 0.85, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: '#8a929c', metalness: 0.8, roughness: 0.4 }),
    plywood: new THREE.MeshStandardMaterial({ map: woodTexture(), metalness: 0, roughness: 0.78 }),
    hole: new THREE.MeshStandardMaterial({ color: '#15181c', metalness: 0.2, roughness: 0.9 }),
    nylon: new THREE.MeshStandardMaterial({ color: '#e9e4d6', metalness: 0, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#33373d', metalness: 0, roughness: 0.85 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#202327', metalness: 0, roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.9, roughness: 0.3 }),
    hand: new THREE.MeshStandardMaterial({ color: '#111316', metalness: 0.3, roughness: 0.45 }),
    red: new THREE.MeshStandardMaterial({ color: '#d92b2b', metalness: 0.1, roughness: 0.5 }),
    thread: new THREE.MeshStandardMaterial({
      color: '#bfc5cc',
      metalness: 0.9,
      roughness: 0.38,
      bumpMap: thread,
      bumpScale: 1.2,
    }),
  }
  return base
}

const cache = new Map()
/**
 * @param {string} key  材質名稱
 * @param {'idle'|'hover'|'selected'} state
 * @param {number} [threadRepeat]
 */
export function getMaterial(key, state = 'idle', threadRepeat) {
  const id = `${key}|${state}|${threadRepeat ? Math.round(threadRepeat) : ''}`
  if (cache.has(id)) return cache.get(id)
  const src = baseMaterials()[key] ?? baseMaterials().steel
  let m = src
  if (state !== 'idle' || threadRepeat) {
    m = src.clone()
    if (threadRepeat && m.bumpMap) {
      m.bumpMap = m.bumpMap.clone()
      m.bumpMap.needsUpdate = true
      m.bumpMap.repeat.set(1, threadRepeat)
    }
    if (state === 'selected') {
      m.emissive = new THREE.Color('#f59e0b')
      m.emissiveIntensity = 0.38
    } else if (state === 'hover') {
      m.emissive = new THREE.Color('#60a5fa')
      m.emissiveIntensity = 0.22
    }
  }
  cache.set(id, m)
  return m
}
