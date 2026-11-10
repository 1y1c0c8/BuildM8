import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { resolveJoints } from '../data/parts'
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
  const joints = useMemo(() => (def ? resolveJoints(def, item.params) : []), [def, item.params])
  const movingGroups = useMemo(() => new Set(joints.map((j) => j.moving)), [joints])
  /** 點到的網格屬於哪個可動關節（選取中的零件才可直接拖曳） */
  const jointAt = (e) => {
    if (!joints.length || useStore.getState().selectedId !== item.uid) return null
    const g = e.object?.userData?.group
    return joints.find((j) => j.moving === g) ?? null
  }
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
      onPointerMove={(e) => {
        if (!joints.length || registry.dragging) return
        document.body.style.cursor = jointAt(e) ? 'grab' : 'pointer'
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (registry.dragging || registry.transform?.axis) return
        const j = jointAt(e)
        if (!j || !registry.startJointDrag) return
        e.stopPropagation()
        registry.startJointDrag(item.uid, j, e)
      }}
      onPointerOut={() => {
        if (useStore.getState().hoveredId === item.uid) useStore.getState().hover(null)
        document.body.style.cursor = ''
      }}
    >
      <group ref={inner}>
        <MeshList meshes={meshes} filter={(m) => !movingGroups.has(m.group)} state={state} />
        {joints
          .filter((j) => !j.parent)
          .map((j) => (
            <JointNode key={j.id} uid={item.uid} joint={j} joints={joints} values={item.joints} meshes={meshes} state={state} />
          ))}
      </group>
    </group>
  )
}

function MeshList({ meshes, filter, state }) {
  return meshes.map((m, i) =>
    filter(m) ? (
      <mesh
        key={i}
        geometry={m.geometry}
        material={getMaterial(m.mat, state, m.threadRepeat)}
        userData={{ group: m.group ?? 'base' }}
        castShadow
        receiveShadow
      />
    ) : null,
  )
}

/**
 * 一個旋轉關節：T(origin)·R(axis, value − zero)·T(−origin)，內含該關節帶動的網格與子關節。
 * 數值改變時以短暫插值平滑轉動；畫布拖曳中則直接跟手。
 */
function JointNode({ uid, joint, joints, values, meshes, state }) {
  const pivot = useRef()
  const rot = useRef()
  const cur = useRef(null)
  const axis = useMemo(() => new THREE.Vector3(...joint.axis), [joint.axis])
  const origin = useMemo(() => joint.origin.map((v) => v * S), [joint.origin])
  const back = useMemo(() => origin.map((v) => -v), [origin])
  const key = `${uid}:${joint.id}`

  useEffect(() => {
    const o = pivot.current
    registry.joints.set(key, o)
    return () => {
      if (registry.joints.get(key) === o) registry.joints.delete(key)
    }
  }, [key])

  useFrame((_, dt) => {
    if (!rot.current) return
    const target = registry.liveJoints.get(uid)?.[joint.id] ?? values?.[joint.id] ?? joint.default
    if (cur.current === null) cur.current = target
    let delta = target - cur.current
    if (joint.wrap) {
      const span = joint.range[1] - joint.range[0]
      delta = ((((delta + span / 2) % span) + span) % span) - span / 2
    }
    const snap = registry.jointDrag?.uid === uid || Math.abs(delta) < 0.05
    cur.current = snap ? cur.current + delta : cur.current + delta * (1 - Math.pow(0.0005, dt))
    rot.current.quaternion.setFromAxisAngle(axis, (cur.current - joint.zero) * DEG)
  })

  return (
    <group ref={pivot} position={origin}>
      <group ref={rot}>
        <group position={back}>
          <MeshList meshes={meshes} filter={(m) => m.group === joint.moving} state={state} />
          {joints
            .filter((c) => c.parent === joint.id)
            .map((c) => (
              <JointNode key={c.id} uid={uid} joint={c} joints={joints} values={values} meshes={meshes} state={state} />
            ))}
        </group>
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
