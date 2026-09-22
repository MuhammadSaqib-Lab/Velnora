import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ProceduralExpressionController } from '../expressionController'
import type { AvatarRendererProps } from './AvatarAdapter'

/**
 * A real human face/head rig — `public/models/facecap.glb`, a facial
 * capture model by Face Cap (bannaflak.com/face-cap), reused from
 * three.js's own official `webgl_morphtargets_face` example under the
 * same attribution three.js itself gives it (see README.md's
 * "Third-party assets"). This replaces the earlier hand-coded
 * procedural geometry, which had a hard ceiling on looking human —
 * primitive-sculpted geometry cannot match real facial topology.
 *
 * The mesh ships with 52 ARKit-standard blendshapes (browInnerUp,
 * jawOpen, mouthSmile_L/R, eyeBlink_L/R, etc.) driven entirely by this
 * component from AssistantState + live audio data — the SAME contract
 * (AvatarRendererProps) the old procedural version implemented, so
 * nothing upstream (AiFaceVisual.tsx, the AI orchestration, voice, or
 * backend) changed. Gaze is driven by rotating the eyeLeft/eyeRight
 * mesh nodes directly (they carry no blendshapes of their own — ARKit's
 * eyeLookX blendshapes are secondary correctives, not the primary gaze
 * mechanism, and node rotation is what real face rigs use for the big
 * look-direction movement).
 *
 * The file's own baked-in AnimationClip (a fixed demo performance
 * capture) is intentionally never played — see the effect below, which
 * zeroes every morph influence on load — since a canned clip would
 * ignore our actual AssistantState entirely.
 */

const MODEL_URL = '/models/facecap.glb'
const controller = new ProceduralExpressionController()

interface MorphMesh extends THREE.Mesh {
  morphTargetDictionary: Record<string, number>
  morphTargetInfluences: number[]
}

function isMorphMesh(object: THREE.Object3D | undefined): object is MorphMesh {
  return !!object && (object as THREE.Mesh).isMesh === true && !!(object as MorphMesh).morphTargetDictionary
}

/**
 * Deliberately not `useLoader` — its suspense-cache integration hung
 * indefinitely for this file during development, so this loads
 * imperatively and surfaces success/failure as plain React state
 * instead of relying on a Suspense boundary that never settled.
 *
 * public/models/facecap.glb is a plain, uncompressed re-export (see its
 * generation note in the repo history): the original upstream asset
 * used KTX2/Basis-compressed textures and meshopt-compressed geometry,
 * and Basis transcode target format selection is GPU-dependent — it
 * decoded fine in this project's own testing but came back blank on at
 * least one real deployed browser, rendering the whole face as a single
 * blown-out white surface. Re-exporting with the same decoded texture
 * embedded as a plain PNG (no KTX2Loader/MeshoptDecoder needed at all
 * now) trades ~325KB for ~2.1MB in exchange for identical, reliable
 * rendering on every GPU — the right trade for a lazy-loaded,
 * admin-only asset.
 */
function useFaceCapGltf() {
  const [gltf, setGltf] = useState<GLTF | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      MODEL_URL,
      (result) => {
        if (!cancelled) setGltf(result)
      },
      undefined,
      (err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed to load facecap.glb'))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (error) throw error
  return gltf
}

function Face({ state, amplitudeRef, mouthShapeRef, isSpeaking, reducedMotion }: AvatarRendererProps) {
  const gltf = useFaceCapGltf()
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<MorphMesh | null>(null)
  const eyeLeftRef = useRef<THREE.Object3D | null>(null)
  const eyeRightRef = useRef<THREE.Object3D | null>(null)

  const breathT = useRef(0)
  const nodT = useRef(0)
  const blinkPhase = useRef(0)
  const nextBlink = useRef(2 + Math.random() * 3)
  const gazeTarget = useRef(new THREE.Vector2(0, 0))
  const nextGazeChange = useRef(0)

  useEffect(() => {
    if (!gltf) return
    const head = gltf.scene.getObjectByName('mesh_2')
    headRef.current = isMorphMesh(head) ? head : null
    eyeLeftRef.current = gltf.scene.getObjectByName('eyeLeft') ?? null
    eyeRightRef.current = gltf.scene.getObjectByName('eyeRight') ?? null
    // Never let the file's own baked demo clip drive this rig — it has no
    // idea what AssistantState is, so every influence starts at rest and
    // is driven entirely by the useFrame loop below instead.
    headRef.current?.morphTargetInfluences.fill(0)

    // The model's own baked texture (a real, verified-intact 1024x1024
    // diffuse map — see the re-export note above) carries all the actual
    // facial detail — eyebrows, lip line, cheek color, socket shading —
    // and is deliberately never removed or replaced. But on its own it's
    // a notably low-saturation, neutral-grey capture-rig texture (this
    // rig was built for motion/blendshape capture, not as a finished
    // character asset), which combined with fully-matte roughness (1,
    // authored in the source file) and pure image-based lighting reads
    // as flat and mannequin-like. Two small, honest adjustments — a
    // gentle warm multiply tint (shifts the existing texture's color
    // balance without hiding or repainting it) and a touch less
    // roughness (a little real specular life instead of a totally dead-
    // matte surface) — combined with the key/fill/rim lights below, are
    // what make it read as skin rather than plaster.
    gltf.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      const material = mesh.material as THREE.MeshStandardMaterial
      if (!mesh.isMesh || !material || !('envMapIntensity' in material)) return
      material.envMapIntensity = 0.45
      if (mesh === headRef.current) {
        material.color.set('#ffdcc2')
        material.roughness = 0.8
      }
    })
  }, [gltf])

  useEffect(() => {
    if (state === 'success' || state === 'positive') nodT.current = 0.0001
  }, [state])

  useFrame((_, delta) => {
    const params = controller.setState(state)
    const head = headRef.current
    const dict = head?.morphTargetDictionary
    const influences = head?.morphTargetInfluences

    if (dict && influences) {
      const set = (name: string, value: number, speed = 8) => {
        const idx = dict[name]
        if (idx === undefined) return
        influences[idx] = THREE.MathUtils.damp(influences[idx], THREE.MathUtils.clamp(value, 0, 1), speed, delta)
      }

      nextBlink.current -= delta
      if (nextBlink.current <= 0 && blinkPhase.current === 0) {
        blinkPhase.current = 0.0001
        nextBlink.current = 2.5 + Math.random() * 4
      }
      let blinkClose = 0
      if (blinkPhase.current > 0) {
        blinkPhase.current += delta * 9
        const t = Math.min(1, blinkPhase.current)
        blinkClose = t < 0.5 ? t * 2 : 2 - t * 2
        if (t >= 1) blinkPhase.current = 0
      }
      const restingClose = params.eyeFocus * 0.3
      set('eyeBlink_L', Math.max(restingClose, blinkClose), 14)
      set('eyeBlink_R', Math.max(restingClose, blinkClose), 14)
      set('eyeSquint_L', params.eyeFocus * 0.4)
      set('eyeSquint_R', params.eyeFocus * 0.4)

      const raise = Math.max(0, params.browRaise)
      const furrow = Math.max(0, -params.browRaise)
      set('browInnerUp', raise)
      set('browOuterUp_L', raise * 0.7)
      set('browOuterUp_R', raise * 0.7)
      set('browDown_L', furrow)
      set('browDown_R', furrow)

      const live = isSpeaking ? mouthShapeRef.current : { openness: 0, width: 0 }
      const amp = isSpeaking ? amplitudeRef.current : 0
      const openness = THREE.MathUtils.clamp(params.mouthBase + live.openness * 0.9 + amp * 0.35, 0, 1)
      set('jawOpen', openness * 0.55, 10)
      set('mouthFunnel', live.width * 0.25, 10)
      set('mouthClose', Math.max(0, 0.12 - openness) * 2)

      const smile = Math.max(0, params.mouthCurl)
      const frown = Math.max(0, -params.mouthCurl)
      set('mouthSmile_L', smile)
      set('mouthSmile_R', smile)
      set('mouthFrown_L', frown)
      set('mouthFrown_R', frown)
    }

    nextGazeChange.current -= delta
    if (nextGazeChange.current <= 0) {
      gazeTarget.current.set((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.2)
      nextGazeChange.current = 1.5 + Math.random() * 2.5
    }
    for (const eye of [eyeLeftRef.current, eyeRightRef.current]) {
      if (!eye) continue
      eye.rotation.y = THREE.MathUtils.damp(eye.rotation.y, gazeTarget.current.x, 4, delta)
      eye.rotation.x = THREE.MathUtils.damp(eye.rotation.x, gazeTarget.current.y, 4, delta)
    }

    const group = groupRef.current
    if (group) {
      const restlessness = reducedMotion ? 0 : params.restlessness
      breathT.current += delta
      group.position.y = Math.sin(breathT.current * 0.55) * 0.006 * restlessness
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, Math.sin(breathT.current * 0.14) * 0.04 * restlessness, 2, delta)

      let nod = 0
      if (nodT.current > 0 && !reducedMotion) {
        nodT.current += delta * 3.4
        nod = Math.sin(Math.min(1, nodT.current) * Math.PI) * 0.05
        if (nodT.current >= 1) nodT.current = 0
      }
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, params.headTilt * 0.35 + nod, 3, delta)
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, params.headTilt, 3, delta)
    }
  })

  if (!gltf) return null

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

/** A sparse, subtle particle halo around the face — kept well clear of
 * the face itself so it reads as ambient "AI" atmosphere rather than
 * competing with the now much more detailed real face for attention. */
function useHaloPositions(count: number) {
  return useMemo(() => {
    const positions: THREE.Vector3[] = []
    for (let i = 0; i < count; i += 1) {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      const r = 2.05 + 0.12 * Math.sin(i * 12.9898)
      positions.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta) * 0.95, r * Math.sin(phi) * Math.sin(theta) * 1.1 + 0.2, r * Math.cos(phi) * 0.9 - 0.3))
    }
    return positions
  }, [count])
}

function Halo({ state }: { state: AvatarRendererProps['state'] }) {
  const positions = useHaloPositions(28)
  const colorRef = useRef(new THREE.Color('#34d399'))
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const targetColor = useMemo(() => new THREE.Color(controller.setState(state).glowColor), [state])

  useFrame(() => {
    colorRef.current.lerp(targetColor, 0.04)
    const mesh = meshRef.current
    if (!mesh) return
    positions.forEach((pos, i) => {
      dummy.position.copy(pos)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).color = colorRef.current
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.018, 6, 6]} />
      <meshBasicMaterial transparent opacity={0.5} />
    </instancedMesh>
  )
}

export function GltfFaceAvatar({ state, amplitudeRef, mouthShapeRef, isSpeaking, reducedMotion }: AvatarRendererProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0.9, 3.5], fov: 45 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        const pmrem = new THREE.PMREMGenerator(gl)
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        scene.environmentIntensity = 0.55
      }}
    >
      <ambientLight intensity={0.2} />
      {/* Portrait-style key/fill so facial structure (nose bridge, cheekbones,
          brow ridge, chin) actually reads via shadow/highlight contouring —
          pure image-based lighting alone renders too flat. The rim light is
          the ONLY place the brand's emerald accent touches the face itself,
          kept low and positioned behind/aside so it grazes the silhouette
          edge rather than washing across it. */}
      <directionalLight position={[0.6, 1.3, 1.6]} intensity={1.15} color="#fff2e2" />
      <directionalLight position={[-1, 0.2, 1]} intensity={0.3} color="#dce8ff" />
      <pointLight position={[-1.3, 0.6, -1.4]} intensity={0.5} color="#34d399" />
      <Face state={state} amplitudeRef={amplitudeRef} mouthShapeRef={mouthShapeRef} isSpeaking={isSpeaking} reducedMotion={reducedMotion} />
      <Halo state={state} />
      {reducedMotion ? null : (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.3} luminanceThreshold={0.92} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette offset={0.4} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
