import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Line, Sparkles } from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

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
  const nodes = useNetworkNodes(14, 1.9)

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.1
  })

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.25, 1]} />
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
            <sphereGeometry args={[0.035, 8, 8]} />
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

      <Sparkles count={50} scale={4.2} size={1.6} speed={0.25} color="#34d399" opacity={0.5} />
    </group>
  )
}

const panels = [
  { position: [-2.3, 1.1, 0.4] as const, rotation: [0, 0.3, 0.05] as const },
  { position: [2.4, -0.8, -0.3] as const, rotation: [0, -0.25, -0.04] as const },
  { position: [-1.8, -1.4, 0.8] as const, rotation: [0.1, 0.15, 0.02] as const },
]

function FloatingPanels() {
  return (
    <>
      {panels.map((panel, i) => (
        <Float key={i} speed={1.1 + i * 0.2} rotationIntensity={0.25} floatIntensity={0.9}>
          <mesh position={panel.position} rotation={panel.rotation}>
            <planeGeometry args={[0.85, 0.52]} />
            <meshStandardMaterial
              color="#0f2e24"
              emissive="#10b981"
              emissiveIntensity={0.15}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </Float>
      ))}
    </>
  )
}

export function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 5.4], fov: 42 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 5]} intensity={45} color="#34d399" />
      <pointLight position={[-4, -3, -4]} intensity={12} color="#38bdf8" />
      <Suspense fallback={null}>
        <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7}>
          <NetworkCore />
        </Float>
        <FloatingPanels />
      </Suspense>
    </Canvas>
  )
}

export default HeroScene
