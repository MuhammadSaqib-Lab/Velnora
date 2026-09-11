import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Html, Line, Sparkles } from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { services } from '@/data/services'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'

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

function NetworkCore() {
  const group = useRef<THREE.Group>(null)
  const nodes = useNetworkNodes(14, 2.5)

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.1
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

      {nodes.map((position, i) => (
        <group key={i}>
          <mesh position={position}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color="#6ee7b7" />
          </mesh>
          <Line
            points={[[0, 0, 0], position.toArray()]}
            color="#10b981"
            transparent
            opacity={0.18}
            lineWidth={1}
          />
        </group>
      ))}

      <Sparkles count={50} scale={5.2} size={1.6} speed={0.25} color="#34d399" opacity={0.5} />
    </group>
  )
}

/**
 * Real service names orbiting the wireframe core as HTML badges (via
 * drei's <Html>), not WebGL text, so they render with the site's actual
 * type, colors, and responsive Tailwind classes instead of a baked-in
 * canvas font. <Html> billboards to the camera by default (no `transform`
 * prop set), so the badges themselves never rotate or skew, only their
 * position orbits, keeping the labels legible at every angle.
 */
function OrbitingServiceBadges() {
  const group = useRef<THREE.Group>(null)
  const isCompact = useIsCompactViewport(768)

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y -= delta * 0.055
  })

  // Wider spread on mobile: the canvas itself is smaller there, so the
  // fixed-pixel badge chips would otherwise crowd into each other more
  // than they do on desktop at the same world-space radius.
  const radius = isCompact ? 3.2 : 2.75
  const count = services.length

  return (
    <group ref={group}>
      {services.map((service, i) => {
        const angle = (i / count) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = Math.sin(angle * 2.5) * 0.55
        const Icon = service.icon

        return (
          <Html key={service.title} position={[x, y, z]} center occlude={false} zIndexRange={[10, 0]}>
            <div className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-canvas)]/85 px-2 py-0.5 text-[8px] font-medium text-[var(--color-accent-soft)] shadow-[0_0_18px_-6px_rgba(16,185,129,0.6)] backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px]">
              <Icon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" strokeWidth={2} />
              {service.title}
            </div>
          </Html>
        )
      })}
    </group>
  )
}

export function HeroScene() {
  const isCompact = useIsCompactViewport(768)

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 10.4], fov: isCompact ? 58 : 42 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 5]} intensity={45} color="#34d399" />
      <pointLight position={[-4, -3, -4]} intensity={12} color="#38bdf8" />
      <Suspense fallback={null}>
        <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7}>
          <NetworkCore />
        </Float>
        <OrbitingServiceBadges />
      </Suspense>
    </Canvas>
  )
}

export default HeroScene
