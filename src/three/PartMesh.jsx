import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { buildPartMeshes, S } from './geometry'
import { getMaterial } from './materials'
import { registry } from './registry'

const DEG = Math.PI / 180
const easeOutBack = (t) => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function PartMeshImpl({ item, state }) {
  const packageId = useStore((s) => s.packageId)
  const def = getPackage(packageId).parts.find((p) => p.id === item.partId)
  const outer = useRef()
  const inner = useRef()

  const meshes = useMemo(() => (def ? buildPartMeshes(def, item.params) : []), [def, item.params])
  // 固定陣列參考，避免重新渲染時覆蓋 TransformControls 拖曳中的位置
  const position = useMemo(() => item.position.map((v) => v * S), [item.position])
  const rotation = useMemo(() => item.rotation.map((v) => v * DEG), [item.rotation])

  useEffect(() => {
    const o = outer.current
    registry.objects.set(item.uid, o)
    return () => {
      if (registry.objects.get(item.uid) === o) registry.objects.delete(item.uid)
    }
  }, [item.uid])

  // AI 拼裝時的逐顆掉落動畫
  const spawn = item.spawn
  useFrame(() => {
    const g = inner.current
    if (!g || !spawn) return
    const t = (performance.now() - spawn.at - spawn.delay) / 520
    if (t < 0) {
      g.visible = false
      return
    }
    g.visible = true
    if (t >= 1) {
      g.position.y = 0
      g.scale.setScalar(1)
      return
    }
    const k = easeOutBack(t)
    g.position.y = (1 - Math.min(1, t * 1.15)) * 26
    g.scale.setScalar(THREE.MathUtils.lerp(0.4, 1, k))
  })

  if (!def) return null

  return (
    <group
      ref={outer}
      name={item.uid}
      position={position}
      rotation={rotation}
      onClick={(e) => {
        if (e.delta > 4 || registry.dragging) return
        e.stopPropagation()
        useStore.getState().select(item.uid)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (!registry.dragging) useStore.getState().hover(item.uid)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (useStore.getState().hoveredId === item.uid) useStore.getState().hover(null)
        document.body.style.cursor = ''
      }}
    >
      <group ref={inner}>
        {meshes.map((m, i) => (
          <mesh key={i} geometry={m.geometry} material={getMaterial(m.mat, state, m.threadRepeat)} castShadow receiveShadow />
        ))}
      </group>
    </group>
  )
}

export const PartMesh = memo(PartMeshImpl)

export function PartsLayer() {
  const items = useStore((s) => s.items)
  const selectedId = useStore((s) => s.selectedId)
  const hoveredId = useStore((s) => s.hoveredId)
  return items.map((it) => (
    <PartMesh
      key={it.uid}
      item={it}
      state={it.uid === selectedId ? 'selected' : it.uid === hoveredId ? 'hover' : 'idle'}
    />
  ))
}
