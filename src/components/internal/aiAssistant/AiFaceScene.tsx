import { Canvas, useFrame } from '@react-three/fiber'
import { Line, Sparkles } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking'

const STATE_COLOR: Record<AssistantState, string> = {
  idle: '#10b981',
  listening: '#34d399',
  thinking: '#6ee7b7',
  speaking: '#34d399',
}

/**
 * A stylized wireframe "holographic" head-and-shoulders bust, in the same
 * visual language as the public site's HeroScene (icosahedron wireframe +
 * connecting lines + Sparkles), not a photorealistic rigged face. A true
 * per-phoneme lipsync rig needs a modeled head with mouth-shape blendshapes
 * (like a game character) — that's a real asset-pipeline undertaking, not
 * something proceduralized here. What this DOES do honestly: the mouth
 * cluster's vertical scale is driven by `amplitude` (0-1, from
 * useAudioAnalyser's real-time analysis of the actual reply audio), so the
 * face visibly "speaks" in sync with volume, without pretending to be
 * phoneme-accurate.
 *
 * Colors stay within Velnora's single locked emerald accent (see
 * CLAUDE.md's design system) rather than matching the blue tone of any
 * reference image literally — this is still the Velnora admin dashboard.
 */
function HeadMesh({ state, amplitude }: { state: AssistantState; amplitude: number }) {
  const headGroup = useRef<THREE.Group>(null)
  const mouthGroup = useRef<THREE.Group>(null)
  const targetAmplitude = useRef(0)

  const nodePositions = useMemo(() => {
    // Deterministic Fibonacci-sphere distribution (same technique as the
    // public site's HeroScene.tsx useNetworkNodes) rather than Math.random,
    // so the scatter is stable across re-renders instead of impure/random.
    const positions: THREE.Vector3[] = []
    const count = 60
    for (let i = 0; i < count; i += 1) {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      const r = 1.55 + 0.15 * Math.sin(i * 12.9898)
      positions.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 1.15 + 0.2,
          r * Math.cos(phi) * 0.85,
        ),
      )
    }
    return positions
  }, [])

  const color = STATE_COLOR[state]

  useFrame((_, delta) => {
    if (headGroup.current) {
      headGroup.current.rotation.y += delta * (state === 'idle' ? 0.12 : 0.22)
    }
    // Smoothed toward the real amplitude so mouth movement reads as
    // continuous speech rather than a jittery per-frame snap.
    targetAmplitude.current += (amplitude - targetAmplitude.current) * Math.min(1, delta * 10)
    if (mouthGroup.current) {
      const openness = state === 'speaking' ? 0.15 + targetAmplitude.current * 1.2 : 0.06
      mouthGroup.current.scale.y = openness
    }
  })

  return (
    <group ref={headGroup}>
      {/* Head */}
      <mesh scale={[1, 1.15, 0.95]}>
        <icosahedronGeometry args={[1.6, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Neck + shoulders, hinted with a simple wireframe cone */}
      <mesh position={[0, -2.05, 0]}>
        <coneGeometry args={[1.7, 1.6, 24, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} wireframe transparent opacity={0.3} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.5, 0.15, 1.35]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0.5, 0.15, 1.35]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Mouth: a small scaling cluster, driven by audio amplitude */}
      <group ref={mouthGroup} position={[0, -0.75, 1.3]}>
        <mesh>
          <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Scattered network nodes + connecting lines to the head surface */}
      {nodePositions.map((pos, i) => (
        <group key={i}>
          <mesh position={pos}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Line points={[pos.toArray(), pos.clone().multiplyScalar(0.75).toArray()]} color={color} transparent opacity={0.2} lineWidth={1} />
        </group>
      ))}

      <Sparkles count={70} scale={4.2} size={1.4} speed={0.2} color={color} opacity={0.4} />
    </group>
  )
}

export function AiFaceScene({ state, amplitude }: { state: AssistantState; amplitude: number }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 7.5], fov: 42 }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 4]} intensity={40} color="#34d399" />
      <pointLight position={[-3, -2, -3]} intensity={10} color="#10b981" />
      <HeadMesh state={state} amplitude={amplitude} />
    </Canvas>
  )
}
