import type { AssistantState } from '../assistantState'
import type { MouthShape } from '../useAudioAnalyser'

/**
 * The contract every avatar renderer must satisfy. AiFaceVisual.tsx is
 * the adapter seam: it picks ONE renderer implementing this exact prop
 * shape and mounts it, so nothing else in the app — the AI
 * orchestration, voice pipeline, chat log, or backend — ever knows
 * which underlying 3D asset or technique is driving the face on screen.
 *
 * Today: GltfFaceAvatar.tsx is the implementation — it loads a real
 * human facial-capture rig (public/models/facecap.glb, 52 ARKit
 * blendshapes) via GLTFLoader and drives its morph targets directly.
 * An earlier ProceduralHumanAvatar.tsx (hand-sculpted primitive
 * geometry, no real facial topology) was replaced outright rather than
 * kept as a fallback — it had a hard ceiling on looking human that no
 * amount of shader/geometry tuning could cross.
 *
 * Future swap-in: a VRMAvatarAdapter.tsx implementing this SAME
 * interface would load a .vrm via `@pixiv/three-vrm`, map `state` to
 * that model's expression presets (via VRMExpressionManager) instead of
 * raw morph target names, drive its lookAt target from the same gaze
 * logic GltfFaceAvatar's Face component uses, and drive its viseme
 * blendshapes from `amplitudeRef`/`mouthShapeRef` exactly like
 * GltfFaceAvatar does now. Swapping it in is a one-line change to the
 * lazy import in AiFaceVisual.tsx — no other file needs to change,
 * because nothing else imports the renderer directly.
 */
export interface AvatarRendererProps {
  state: AssistantState
  amplitudeRef: React.RefObject<number>
  mouthShapeRef: React.RefObject<MouthShape>
  isSpeaking: boolean
  reducedMotion: boolean
}
