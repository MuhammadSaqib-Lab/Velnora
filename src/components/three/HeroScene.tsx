import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { services } from '@/data/services'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'

/**
 * Performance notes (measured on a throttled mobile profile, see the
 * optimization report): the original scene spent roughly half of every frame
 * in style/layout recalculation (drei <Html> badges rewritten each frame),
 * issued ~30 draw calls (14 fat-line meshes + 14 sphere meshes) and ran an
 * uncapped 60 fps loop. The look is unchanged; the cost is not:
 *   - spokes: one LineSegments2 built once (same fat-line material, one draw call)
 *   - nodes: one InstancedMesh (one draw call)
 *   - badges: plain DOM, one `transform` write each per frame, no layout reads
 *   - loop: `frameloop="demand"` driven at <=30 fps, paused when the canvas is
 *     offscreen or the tab is hidden
 */

const FPS_CAP = 30
const MAX_DELTA = 0.1 // clamp so resuming after a pause doesn't jump the rotation

function useNetworkNodes(count: number, radius: number) {
  return useMemo(() => {
    const nodes: THREE.Vector3[] = []
    for (let i = 0; i < count; i += 1) {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      nodes.push(
        new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi),
        ),
      )
    }
    return nodes
  }, [count, radius])
}

/** Drives the demand-mode render loop at a capped rate, and only while visible. */
function FrameLimiter() {
  const invalidate = useThree((state) => state.invalidate)
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    let onScreen = true
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
    })
    observer.observe(canvas)
    const timer = window.setInterval(() => {
      if (onScreen && !document.hidden) invalidate()
    }, 1000 / FPS_CAP)
    invalidate()
    return () => {
      window.clearInterval(timer)
      observer.disconnect()
    }
  }, [canvas, invalidate])

  return null
}

/** All 14 hub-to-node spokes as a single fat-line object, built once. */
function Spokes({ nodes }: { nodes: THREE.Vector3[] }) {
  const size = useThree((state) => state.size)
  const { line, material, geometry } = useMemo(() => {
    const positions: number[] = []
    for (const node of nodes) positions.push(0, 0, 0, node.x, node.y, node.z)
    const geo = new LineSegmentsGeometry()
    geo.setPositions(positions)
    const mat = new LineMaterial({ color: '#10b981', linewidth: 1, transparent: true, opacity: 0.18 })
    return { line: new LineSegments2(geo, mat), material: mat, geometry: geo }
  }, [nodes])

  useEffect(() => {
    material.resolution.set(size.width, size.height)
  }, [material, size.width, size.height])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <primitive object={line} />
}

/** All 14 node spheres as one instanced mesh. */
function NodeSpheres({ nodes }: { nodes: THREE.Vector3[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    const dummy = new THREE.Object3D()
    nodes.forEach((node, i) => {
      dummy.position.copy(node)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
    })
    target.instanceMatrix.needsUpdate = true
  }, [nodes])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, nodes.length]}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshBasicMaterial color="#6ee7b7" />
    </instancedMesh>
  )
}

function NetworkCore() {
  const group = useRef<THREE.Group>(null)
  const nodes = useNetworkNodes(14, 2.5)

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += Math.min(delta, MAX_DELTA) * 0.1
  })

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.9, 1]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.5}
        />
      </mesh>

      <NodeSpheres nodes={nodes} />
      <Spokes nodes={nodes} />

      <Sparkles count={50} scale={5.2} size={1.6} speed={0.25} color="#34d399" opacity={0.5} />
    </group>
  )
}

const BADGE_ORBIT_SPEED = 0.055

interface BadgePlacement {
  x: number
  y: number
  z: number
}

/** Imperative DOM write for one badge; only touches styles whose value changed. */
function placeBadge(el: HTMLElement, prev: BadgePlacement | undefined, x: number, y: number, z: number): BadgePlacement {
  if (!prev) el.style.opacity = '1'
  if (!prev || prev.x !== x || prev.y !== y) el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  if (!prev || prev.z !== z) el.style.zIndex = String(z)
  return { x, y, z }
}

/**
 * Moves the service badges (real DOM, rendered by HeroScene next to the
 * canvas) along the same orbit the old <Html> badges followed: a ring around
 * the Y axis, projected through the scene camera each frame. It writes only
 * `transform` (and a z-index when the depth order changes) and never reads
 * layout, so the page's layout is not invalidated 30 times a second.
 */
function BadgeDriver({ overlay, radius }: { overlay: React.RefObject<HTMLDivElement | null>; radius: number }) {
  const angle = useRef(0)
  const projected = useMemo(() => new THREE.Vector3(), [])
  const world = useMemo(() => new THREE.Vector3(), [])
  const last = useRef<BadgePlacement[]>([])

  useFrame(({ camera, size }, delta) => {
    angle.current -= Math.min(delta, MAX_DELTA) * BADGE_ORBIT_SPEED
    const cos = Math.cos(angle.current)
    const sin = Math.sin(angle.current)
    const count = services.length
    camera.updateMatrixWorld()

    for (let i = 0; i < count; i += 1) {
      const el = overlay.current?.children[i] as HTMLElement | undefined
      if (!el) continue
      const a = (i / count) * Math.PI * 2
      const lx = Math.cos(a) * radius
      const lz = Math.sin(a) * radius
      const ly = Math.sin(a * 2.5) * 0.55
      // Rotation about Y, as the original orbit group did.
      world.set(lx * cos + lz * sin, ly, -lx * sin + lz * cos)
      const distance = camera.position.distanceTo(world)
      projected.copy(world).project(camera)
      // Whole pixels: fractional offsets on a compositor layer soften the text.
      const x = Math.round((projected.x * 0.5 + 0.5) * size.width)
      const y = Math.round((-projected.y * 0.5 + 0.5) * size.height)
      const z = Math.round((14 - distance) * 10) // nearer badges paint on top

      last.current[i] = placeBadge(el, last.current[i], x, y, z)
    }
  })

  return null
}

export function HeroScene() {
  const isCompact = useIsCompactViewport(768)
  const overlay = useRef<HTMLDivElement>(null)
  // Wider spread on mobile: the canvas itself is smaller there, so the
  // fixed-pixel badge chips would otherwise crowd into each other more
  // than they do on desktop at the same world-space radius.
  const radius = isCompact ? 3.2 : 2.75

  return (
    <div className="relative h-full w-full">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 10.4], fov: isCompact ? 58 : 42 }}
      >
        <FrameLimiter />
        <ambientLight intensity={0.5} />
        <pointLight position={[4, 4, 5]} intensity={45} color="#34d399" />
        <pointLight position={[-4, -3, -4]} intensity={12} color="#38bdf8" />
        <Suspense fallback={null}>
          <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7}>
            <NetworkCore />
          </Float>
          <BadgeDriver overlay={overlay} radius={radius} />
        </Suspense>
      </Canvas>

      {/*
        Real service names as DOM badges (not WebGL text), so they render with
        the site's actual type, colors and responsive classes. Each wrapper is
        positioned by BadgeDriver; `contain: layout style` keeps their updates
        from invalidating the rest of the page, and they start invisible so
        nothing flashes at the top-left before the first frame.
      */}
      <div ref={overlay} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {services.map((service) => {
          const Icon = service.icon
          return (
            <div
              key={service.title}
              className="absolute top-0 left-0 will-change-transform"
              style={{ opacity: 0, contain: 'layout style' }}
            >
              <div className="flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-canvas)]/85 px-2 py-0.5 text-[8px] font-medium text-[var(--color-accent-soft)] shadow-[0_0_18px_-6px_rgba(16,185,129,0.6)] backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px]">
                <Icon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" strokeWidth={2} />
                {service.title}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HeroScene
