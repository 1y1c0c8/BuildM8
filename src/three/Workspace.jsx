import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  TransformControls,
  Grid,
  Environment,
  Lightformer,
  GizmoHelper,
  GizmoViewport,
} from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { getPackage } from '../data/packages'
import { PartsLayer } from './PartMesh'
import { applySnap, worldAnchors } from './snapping'
import { registry } from './registry'
import { S } from './geometry'
import { normalizeJoints, resolveJoints } from '../data/parts'
import { useBreakpoint } from '../hooks/useBreakpoint'

const RAD = 180 / Math.PI

export default function Workspace() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [70, 55, 90], fov: 38, near: 0.5, far: 4000 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={(e) => {
        if (e.type !== 'click') return
        if (registry.transform?.axis || registry.dragging || performance.now() - registry.lastDragEnd < 250) return
        useStore.getState().select(null)
      }}
    >
      <Scene />
    </Canvas>
  )
}

function Scene() {
  const gridStep = useStore((s) => s.gridStep)
  const bp = useBreakpoint()
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[60, 120, 50]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />
      {/* 離線可用的攝影棚燈光（不需下載 HDR） */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 6, -8]} scale={[12, 4, 1]} />
        <Lightformer intensity={1.4} position={[-8, 3, 2]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer intensity={1.2} position={[8, 2, 4]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} color="#ffd9a0" />
        <Lightformer intensity={0.8} position={[0, -4, 6]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
      </Environment>

      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <shadowMaterial opacity={0.28} />
      </mesh>
      <Grid
        position={[0, -0.005, 0]}
        args={[400, 400]}
        cellSize={gridStep || 1}
        cellThickness={0.55}
        cellColor="#2a313a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#3d4652"
        fadeDistance={420}
        fadeStrength={1.4}
        infiniteGrid
      />
      <Axes />

      <PartsLayer />
      <SelectedTransform />
      <JointDragger />
      <SnapHint />
      <DropBridge />
      <CameraRig />

      <OrbitControls
        ref={(c) => (registry.controls = c)}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.495}
        minDistance={8}
        maxDistance={900}
      />
      <GizmoHelper alignment={bp === 'desktop' ? 'bottom-right' : 'top-left'} margin={bp === 'desktop' ? [72, 72] : [52, 104]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#0b0d10" />
      </GizmoHelper>
    </>
  )
}

function Axes() {
  return (
    <group position-y={0.02}>
      <mesh position={[25, 0, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 50, 6]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0, 25]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 50, 6]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

/** 選取物件的 TransformControls + 磁吸 */
function SelectedTransform() {
  const bp = useBreakpoint()
  const selectedId = useStore((s) => s.selectedId)
  const mode = useStore((s) => s.mode)
  const items = useStore((s) => s.items)
  const [obj, setObj] = useState(null)
  const targetsRef = useRef([])
  const hintKey = useRef('')
  const autoRef = useRef(null) // 腳輪拖曳中的自動轉向 / 滾動

  useEffect(() => {
    if (!selectedId) return setObj(null)
    let raf
    const find = () => {
      const o = registry.objects.get(selectedId)
      if (o) setObj(o)
      else raf = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(raf)
  }, [selectedId, items.length])

  if (!obj || !selectedId) return null
  const item = items.find((i) => i.uid === selectedId)
  if (!item) return null
  const pkg = getPackage(useStore.getState().packageId)
  const def = pkg.parts.find((p) => p.id === item.partId)

  const onStart = () => {
    registry.dragging = true
    useStore.getState().hover(null)
    targetsRef.current = useStore
      .getState()
      .items.filter((i) => i.uid !== selectedId)
      .flatMap((i) => {
        const o = registry.objects.get(i.uid)
        const d = pkg.parts.find((p) => p.id === i.partId)
        return o && d ? worldAnchors(o, d, i.params, i.joints) : []
      })
    const follow = mode === 'translate' ? resolveJoints(def, item.params).filter((j) => j.follow) : []
    autoRef.current = follow.length ? { joints: follow, last: obj.position.clone(), values: { ...item.joints } } : null
  }
  const onChange = () => {
    if (!registry.dragging || mode !== 'translate') return
    const { gridStep, magnet, setSnapHint } = useStore.getState()
    const hint = applySnap(obj, { def, params: item.params, joints: item.joints }, targetsRef.current, { grid: gridStep, magnet })
    if (autoRef.current) followMotion(autoRef.current)
    const key = hint ? hint.position.map((v) => v.toFixed(2)).join(',') : ''
    if (key !== hintKey.current) {
      hintKey.current = key
      setSnapHint(hint)
    }
  }
  const onEnd = () => {
    registry.dragging = false
    registry.lastDragEnd = performance.now()
    const { updateItem, setSnapHint } = useStore.getState()
    setSnapHint(null)
    hintKey.current = ''
    const e = new THREE.Euler().setFromQuaternion(obj.quaternion, 'XYZ')
    const auto = autoRef.current
    autoRef.current = null
    registry.liveJoints.delete(selectedId)
    updateItem(selectedId, {
      position: obj.position.toArray().map((v) => v / S),
      rotation: [e.x * RAD, e.y * RAD, e.z * RAD],
      ...(auto ? { joints: normalizeJoints(def, auto.values) } : {}),
    })
  }
  /** 腳輪：輪子朝移動方向轉（swivel）並依移動距離 / 半徑滾動（roll） */
  const followMotion = (auto) => {
    const delta = obj.position.clone().sub(auto.last)
    const local = delta.applyQuaternion(obj.quaternion.clone().invert())
    const dist = Math.hypot(local.x, local.z) // cm
    if (dist < 0.05) return
    auto.last.copy(obj.position)
    for (const j of auto.joints) {
      if (j.follow === 'heading') auto.values[j.id] = Math.atan2(local.x, local.z) * RAD
      else if (j.follow === 'roll' && j.radius) auto.values[j.id] = (auto.values[j.id] ?? 0) + (dist / S / j.radius) * RAD
    }
    auto.values = normalizeJoints(def, auto.values)
    registry.liveJoints.set(selectedId, auto.values)
  }

  return (
    <TransformControls
      ref={(t) => (registry.transform = t)}
      object={obj}
      mode={mode}
      size={bp === 'mobile' ? 1.25 : bp === 'tablet' ? 1.05 : 0.85}
      rotationSnap={THREE.MathUtils.degToRad(15)}
      onMouseDown={onStart}
      onObjectChange={onChange}
      onMouseUp={onEnd}
    />
  )
}

/**
 * 在畫布上直接拖曳可動群組（鉸鏈葉片、腳輪叉架 / 輪子）：
 * 指標射線與「垂直關節軸、通過軸心」的平面求交點，累加相鄰兩點對軸心的夾角。
 * 拖曳中停用 OrbitControls，零件本身不移動；若 TransformControls 搶到這次拖曳則放棄。
 */
function JointDragger() {
  const { camera, gl } = useThree()
  const [gizmo, setGizmo] = useState(null)

  useEffect(() => {
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    registry.startJointDrag = (uid, joint, e) => {
      const pivot = registry.joints.get(`${uid}:${joint.id}`)
      if (!pivot) return
      pivot.updateMatrixWorld(true)
      const origin = pivot.getWorldPosition(new THREE.Vector3())
      const axis = new THREE.Vector3(...joint.axis).applyQuaternion(pivot.getWorldQuaternion(new THREE.Quaternion())).normalize()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(axis, origin)
      const hit = (cx, cy) => {
        const r = gl.domElement.getBoundingClientRect()
        ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
        return ray.ray.intersectPlane(plane, new THREE.Vector3())
      }
      const ne = e.nativeEvent ?? e
      let prev = hit(ne.clientX, ne.clientY) ?? plane.projectPoint(e.point, new THREE.Vector3())
      const startVec = prev.clone().sub(origin)
      // 環的半徑：可動群組離軸最遠的距離
      const box = new THREE.Box3().setFromObject(pivot)
      let radius = 1
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(x, y, z).sub(origin)
        radius = Math.max(radius, v.addScaledVector(axis, -v.dot(axis)).length())
      }
      radius = Math.min(radius * 1.08, 40)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis)
      const qi = q.clone().invert()
      const loc = startVec.clone().applyQuaternion(qi)
      const start = Math.atan2(loc.y, loc.x)
      const [lo, hi] = joint.range
      const st = useStore.getState()
      let raw = st.items.find((i) => i.uid === uid)?.joints?.[joint.id] ?? joint.default
      let swept = 0
      let recorded = false

      registry.dragging = true
      registry.jointDrag = { uid, id: joint.id }
      if (registry.controls) registry.controls.enabled = false
      document.body.style.cursor = 'grabbing'
      setGizmo({ origin: origin.toArray(), q: q.toArray(), radius, start, swept: 0 })

      const finish = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        registry.dragging = false
        registry.jointDrag = null
        registry.lastDragEnd = performance.now()
        if (registry.controls) registry.controls.enabled = true
        document.body.style.cursor = ''
        setGizmo(null)
      }
      const move = (ev) => {
        if (registry.transform?.dragging) return finish()
        const p = hit(ev.clientX, ev.clientY)
        if (!p) return
        const v0 = prev.clone().sub(origin)
        const v1 = p.clone().sub(origin)
        if (v1.lengthSq() < 1e-6 || v0.lengthSq() < 1e-6) return
        const d = Math.atan2(axis.dot(v0.clone().cross(v1)), v0.dot(v1))
        prev = p
        swept += d
        raw += d * RAD
        if (!joint.wrap) raw = Math.min(hi, Math.max(lo, raw))
        const s = useStore.getState()
        const it = s.items.find((i) => i.uid === uid)
        if (!it) return finish()
        const def = getPackage(s.packageId).parts.find((x) => x.id === it.partId)
        const joints = normalizeJoints(def, { ...it.joints, [joint.id]: raw })
        if (joints[joint.id] !== it.joints?.[joint.id]) {
          if (!recorded) s._record()
          recorded = true
          s.updateItem(uid, { joints }, { record: false })
        }
        setGizmo((g) => g && { ...g, swept })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
    }
    return () => (registry.startJointDrag = null)
  }, [camera, gl])

  if (!gizmo) return null
  const len = Math.max(0.001, Math.abs(gizmo.swept))
  const thetaStart = gizmo.swept < 0 ? gizmo.start + gizmo.swept : gizmo.start
  return (
    <group position={gizmo.origin} quaternion={gizmo.q}>
      <mesh renderOrder={11}>
        <torusGeometry args={[gizmo.radius, Math.max(0.05, gizmo.radius * 0.02), 10, 72]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh renderOrder={11}>
        <ringGeometry args={[gizmo.radius * 0.25, gizmo.radius, 48, 1, thetaStart, Math.min(len, Math.PI * 2)]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
      <mesh renderOrder={11}>
        <sphereGeometry args={[Math.max(0.12, gizmo.radius * 0.05), 12, 8]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} />
      </mesh>
    </group>
  )
}

/** 磁吸目標的脈動光圈 */
function SnapHint() {
  const hint = useStore((s) => s.snapHint)
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const k = 1 + Math.sin(clock.elapsedTime * 10) * 0.15
    ref.current.scale.setScalar(k)
  })
  if (!hint) return null
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...hint.dir))
  return (
    <group position={hint.position} quaternion={q}>
      <mesh ref={ref} renderOrder={10}>
        <torusGeometry args={[hint.kind === 'port' ? 1.6 : 0.9, 0.09, 12, 48]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh renderOrder={10}>
        <circleGeometry args={[hint.kind === 'port' ? 1.4 : 0.7, 32]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** 讓 HTML 拖放可以把螢幕座標轉成地面座標 */
function DropBridge() {
  const { camera } = useThree()
  useEffect(() => {
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    registry.dropAt = (cx, cy, rect) => {
      const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const p = new THREE.Vector3()
      if (!ray.ray.intersectPlane(plane, p)) return null
      return [p.x / S, 0, p.z / S]
    }
    return () => (registry.dropAt = null)
  }, [camera])
  return null
}

/** AI 生成後，鏡頭平滑移動到作品 */
function CameraRig() {
  const lastAssembly = useStore((s) => s.lastAssembly)
  const { camera } = useThree()
  const goal = useRef(null)

  useEffect(() => {
    if (!lastAssembly) return
    const items = useStore.getState().items
    if (!items.length) return
    const box = new THREE.Box3()
    items.forEach((i) => box.expandByPoint(new THREE.Vector3(...i.position).multiplyScalar(S)))
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length()
    // 直式手機的水平視角比垂直窄，用兩者中較小的那個來算距離，避免作品左右被裁掉
    const vfov = (camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const fov = Math.min(vfov, hfov)
    const dist = Math.max(45, ((size / 2 + 12) / Math.tan(fov / 2)) * 1.05)
    const dir = new THREE.Vector3(0.75, 0.55, 1).normalize()
    goal.current = { target: center, pos: center.clone().addScaledVector(dir, dist), t: 0 }
  }, [lastAssembly])

  useFrame((_, dt) => {
    const g = goal.current
    const c = registry.controls
    if (!g || !c) return
    g.t += dt
    const k = 1 - Math.pow(0.02, dt)
    camera.position.lerp(g.pos, k)
    c.target.lerp(g.target, k)
    c.update()
    if (g.t > 1.8 || camera.position.distanceTo(g.pos) < 0.2) goal.current = null
  })
  return null
}
