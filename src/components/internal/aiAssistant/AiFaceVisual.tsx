import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useCanRender3D } from '@/hooks/useCanRender3D'
import type { AssistantState } from './assistantState'
import type { MouthShape } from './useAudioAnalyser'

/**
 * This lazy import is the adapter seam described in
 * avatar/AvatarAdapter.ts: swapping in a future VRMAvatarAdapter (once a
 * licensed VRM/GLB human model exists) means changing only this one
 * line — the component it resolves to is the only thing here that knows
 * it's Three.js at all.
 */
const AvatarRenderer = lazy(() => import('./avatar/GltfFaceAvatar').then((m) => ({ default: m.GltfFaceAvatar })))

const STATE_LABEL: Record<AssistantState, string> = {
  idle: 'Idle',
  listening: 'Listening…',
  attentive: 'Attentive',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  working: 'Working…',
  success: 'Done',
  positive: 'Positive',
  concerned: 'Concerned',
  caution: 'Caution',
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function FaceFallback({ state }: { state: AssistantState }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3"
      role="img"
      aria-label={`AI Operations Assistant — ${STATE_LABEL[state]}`}
    >
      <div
        className={
          'h-24 w-24 rounded-full border-2 border-[var(--color-accent)]/50 bg-[var(--color-accent-dim)] ' +
          (state === 'idle' ? '' : 'animate-pulse')
        }
      />
      <span className="text-xs text-[var(--color-ink-faint)]">{STATE_LABEL[state]}</span>
    </div>
  )
}

/**
 * A crashed avatar (a blocked WASM instantiation, a worker CSP
 * violation, a corrupt/unreachable model file, anything) must never
 * take down the whole AI Operations page — only this class component
 * boundary can catch a render-phase throw (Suspense catches thrown
 * promises, not thrown errors; R3F's Canvas internally catches errors
 * from its own reconciler and re-throws them in the outer tree
 * specifically so a boundary like this one can catch them). Falls back
 * to the same FaceFallback used for unsupported WebGL.
 * componentDidCatch is intentionally a no-op beyond setting state,
 * matching src/components/ErrorBoundary.tsx's own convention — this
 * codebase has no console.* calls anywhere (see SECURITY.md's
 * "Information leakage" audit).
 */
class AvatarErrorBoundary extends Component<{ state: AssistantState; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    // Intentionally empty — see class comment.
  }

  render() {
    if (this.state.hasError) return <FaceFallback state={this.props.state} />
    return this.props.children
  }
}

/**
 * Reuses the public site's WebGL-capability gate (src/hooks/useCanRender3D.ts)
 * so this admin-only 3D face degrades the same safe way the public
 * Hero's 3D visual does on an unsupported browser or genuinely weak
 * device, instead of crashing or tanking performance.
 */
export function AiFaceVisual({
  state,
  amplitudeRef,
  mouthShapeRef,
  isSpeaking,
}: {
  state: AssistantState
  amplitudeRef: React.RefObject<number>
  mouthShapeRef: React.RefObject<MouthShape>
  isSpeaking: boolean
}) {
  const canRender3D = useCanRender3D()
  const reducedMotion = useReducedMotion()

  if (!canRender3D) return <FaceFallback state={state} />

  return (
    <AvatarErrorBoundary state={state}>
      <Suspense fallback={<FaceFallback state={state} />}>
        <AvatarRenderer
          state={state}
          amplitudeRef={amplitudeRef}
          mouthShapeRef={mouthShapeRef}
          isSpeaking={isSpeaking}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </AvatarErrorBoundary>
  )
}
