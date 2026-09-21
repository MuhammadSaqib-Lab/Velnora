import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { AssistantState } from './assistantState'
import { ProceduralExpressionController } from './expressionController'
import type { MouthShape } from './useAudioAnalyser'

/**
 * The procedural "digital human" head. No VRM/photoreal asset is
 * available for this project (see the AI Assistant page's own comment
 * and this feature's commit message for why) — this is the honestly-
 * scoped best version achievable with primitive geometry + custom
 * shaders: a smooth holographic bust with a fresnel rim-light "digital
 * skin" material, a sparse glowing network overlay (echoing the
 * premium reference image's aesthetic without pretending to be a real
 * face mesh), working eyes with gaze + blink, brows, and a mouth driven
 * by both expression state and real audio frequency data.
 *
 * Architecture note: this file only ever reads AssistantState + live
 * refs (amplitude/mouthShape). It has no idea what a "conversation" or
 * "agent" is. A future real VRM avatar replaces exactly this file (and
 * ProceduralExpressionController with a VRM-driving equivalent) without
 * touching AiAssistant.tsx, the orchestration, or the backend at all.
 */

const controller = new ProceduralExpressionController()

const HEAD_FRESNEL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HEAD_FRESNEL_FRAGMENT = /* glsl */ `
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  // Cheap value noise for a very subtle "energy flow" across the surface —
  // kept low-amplitude and slow so it reads as alive, not distracting.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float fresnel = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), 2.4);
    float flow = noise(vNormal.xy * 3.0 + uTime * 0.08) * 0.15;
    vec3 core = vec3(0.02, 0.05, 0.045);
    vec3 color = mix(core, uGlowColor, clamp(fresnel + flow, 0.0, 1.0) * uGlowIntensity);
    gl_FragColor = vec4(color, 0.92);
  }
`

function useFresnelMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uGlowColor: { value: new THREE.Color('#34d399') },
          uGlowIntensity: { value: 0.6 },
          uTime: { value: 0 },
        },
        vertexShader: HEAD_FRESNEL_VERTEX,
        fragmentShader: HEAD_FRESNEL_FRAGMENT,
        transparent: true,
      }),
    [],
  )
}

/** Deterministic Fibonacci-sphere scatter (not Math.random) so it's stable across re-renders. */
function useNetworkPositions(count: number) {
  return useMemo(() => {
    const positions: THREE.Vector3[] = []
    for (let i = 0; i < count; i += 1) {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      const r = 1.5 + 0.12 * Math.sin(i * 12.9898)
      positions.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta) * 0.92,
          r * Math.sin(phi) * Math.sin(theta) * 1.2 + 0.15,
          r * Math.cos(phi) * 0.85,
        ),
      )
    }
    return positions
  }, [count])
}

/** One InstancedMesh draw call instead of N individual <mesh> — see the
 * threejs-performance skill's guidance on instancing being the biggest
 * single win for repeated small geometry like this. */
function NetworkNodes({ positions, color }: { positions: THREE.Vector3[]; color: THREE.Color }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    positions.forEach((pos, i) => {
      dummy.position.copy(pos)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).color = color
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.018, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </instancedMesh>
  )
}

/** A single merged LineSegments geometry (all connection lines in one
 * draw call) instead of one <Line> per node — same instancing-adjacent
 * performance principle as NetworkNodes. */
function NetworkLines({ positions, color }: { positions: THREE.Vector3[]; color: THREE.Color }) {
  const geometry = useMemo(() => {
    const points: number[] = []
    for (const pos of positions) {
      points.push(pos.x, pos.y, pos.z, pos.x * 0.7, pos.y * 0.7, pos.z * 0.7)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [positions])

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }),
    [color],
  )

  return <lineSegments geometry={geometry} material={material} />
}

function Eye({ x }: { x: number }) {
  const group = useRef<THREE.Group>(null)
  const gazeTarget = useRef(new THREE.Vector2(0, 0))
  const nextGazeChange = useRef(0)
  const blinkPhase = useRef(0)
  const nextBlink = useRef(2 + Math.random() * 3)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    nextGazeChange.current -= delta
    if (nextGazeChange.current <= 0) {
      gazeTarget.current.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.04)
      nextGazeChange.current = 1.5 + Math.random() * 2.5
    }
    g.position.x = THREE.MathUtils.damp(g.position.x, x + gazeTarget.current.x, 4, delta)
    g.position.y = THREE.MathUtils.damp(g.position.y, 0.18 + gazeTarget.current.y, 4, delta)

    nextBlink.current -= delta
    if (nextBlink.current <= 0 && blinkPhase.current === 0) {
      blinkPhase.current = 0.0001
      nextBlink.current = 2.5 + Math.random() * 4
    }
    if (blinkPhase.current > 0) {
      blinkPhase.current += delta * 9
      const t = Math.min(1, blinkPhase.current)
      const closeness = t < 0.5 ? t * 2 : 2 - t * 2
      g.scale.y = 1 - closeness * 0.92
      if (t >= 1) blinkPhase.current = 0
    }
  })

  return (
    <group ref={group} position={[x, 0.18, 1.42]}>
      <mesh>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshBasicMaterial color="#eafff5" />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color="#062018" />
      </mesh>
    </group>
  )
}

function Brow({ x, tilt }: { x: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, tilt * (x < 0 ? 1 : -1), 5, delta)
  })
  return (
    <mesh ref={ref} position={[x, 0.38, 1.35]}>
      <capsuleGeometry args={[0.02, 0.22, 4, 8]} />
      <meshBasicMaterial color="#eafff5" transparent opacity={0.8} />
    </mesh>
  )
}

function Mouth({
  color,
  stateOpenness,
  stateCurl,
  mouthShapeRef,
  amplitudeRef,
  isSpeaking,
}: {
  color: THREE.Color
  stateOpenness: number
  stateCurl: number
  mouthShapeRef: React.RefObject<MouthShape>
  amplitudeRef: React.RefObject<number>
  isSpeaking: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const g = group.current
    const m = mesh.current
    if (!g || !m) return

    const live = isSpeaking ? mouthShapeRef.current : { openness: 0, width: 0 }
    const amp = isSpeaking ? amplitudeRef.current : 0
    const targetOpen = stateOpenness + live.openness * 0.9 + amp * 0.3
    const targetWidth = 1 + live.width * 0.35

    m.scale.y = THREE.MathUtils.damp(m.scale.y, 0.4 + targetOpen * 1.8, 8, delta)
    m.scale.x = THREE.MathUtils.damp(m.scale.x, targetWidth, 6, delta)
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, 0, 6, delta)
    g.position.y = THREE.MathUtils.damp(g.position.y, -0.62 + stateCurl * 0.05, 6, delta)
    ;(m.material as THREE.MeshBasicMaterial).color = color
  })

  return (
    <group ref={group} position={[0, -0.62, 1.38]}>
      <mesh ref={mesh}>
        <capsuleGeometry args={[0.06, 0.34, 4, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function Head({
  state,
  amplitudeRef,
  mouthShapeRef,
  isSpeaking,
  reducedMotion,
}: {
  state: AssistantState
  amplitudeRef: React.RefObject<number>
  mouthShapeRef: React.RefObject<MouthShape>
  isSpeaking: boolean
  reducedMotion: boolean
}) {
  const headGroup = useRef<THREE.Group>(null)
  const material = useFresnelMaterial()
  const currentColor = useRef(new THREE.Color('#34d399'))
  const currentIntensity = useRef(0.6)
  const breathT = useRef(0)

  const params = controller.setState(state)
  const targetColor = useMemo(() => new THREE.Color(params.glowColor), [params.glowColor])

  const nodePositions = useNetworkPositions(46)

  useFrame((frameState, delta) => {
    material.uniforms.uTime.value = frameState.clock.elapsedTime
    currentColor.current.lerp(targetColor, Math.min(1, delta * 3))
    currentIntensity.current = THREE.MathUtils.damp(currentIntensity.current, params.glowIntensity, 3, delta)
    material.uniforms.uGlowColor.value = currentColor.current
    material.uniforms.uGlowIntensity.value = currentIntensity.current

    const group = headGroup.current
    if (!group) return

    const restlessness = reducedMotion ? 0 : params.restlessness
    breathT.current += delta
    const breathe = Math.sin(breathT.current * 0.6) * 0.01 * restlessness
    group.position.y = breathe
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      Math.sin(breathT.current * 0.15) * 0.06 * restlessness,
      2,
      delta,
    )
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, params.headTilt, 3, delta)
  })

  return (
    <group ref={headGroup}>
      <mesh scale={[1, 1.18, 0.96]} material={material}>
        <sphereGeometry args={[1.55, 48, 48]} />
      </mesh>

      <mesh position={[0, -2.05, 0]}>
        <coneGeometry args={[1.65, 1.5, 32, 1, true]} />
        <meshStandardMaterial
          color={currentColor.current}
          emissive={currentColor.current}
          emissiveIntensity={0.25}
          wireframe
          transparent
          opacity={0.28}
        />
      </mesh>

      <Eye x={-0.42} />
      <Eye x={0.42} />
      <Brow x={-0.42} tilt={params.eyeFocus * 0.35} />
      <Brow x={0.42} tilt={params.eyeFocus * 0.35} />
      <Mouth
        color={currentColor.current}
        stateOpenness={params.mouthBase}
        stateCurl={params.mouthCurl}
        mouthShapeRef={mouthShapeRef}
        amplitudeRef={amplitudeRef}
        isSpeaking={isSpeaking}
      />

      <NetworkNodes positions={nodePositions} color={currentColor.current} />
      <NetworkLines positions={nodePositions} color={currentColor.current} />
    </group>
  )
}

export function AiFaceScene({
  state,
  amplitudeRef,
  mouthShapeRef,
  isSpeaking,
  reducedMotion,
}: {
  state: AssistantState
  amplitudeRef: React.RefObject<number>
  mouthShapeRef: React.RefObject<MouthShape>
  isSpeaking: boolean
  reducedMotion: boolean
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 7.2], fov: 40 }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 3, 4]} intensity={35} color="#34d399" />
      <pointLight position={[-3, -2, -3]} intensity={8} color="#10b981" />
      <Head
        state={state}
        amplitudeRef={amplitudeRef}
        mouthShapeRef={mouthShapeRef}
        isSpeaking={isSpeaking}
        reducedMotion={reducedMotion}
      />
      {reducedMotion ? null : (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.35} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette offset={0.4} darkness={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
