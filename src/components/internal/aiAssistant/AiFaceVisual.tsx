import { Suspense, lazy, useEffect, useState } from 'react'
import { useCanRender3D } from '@/hooks/useCanRender3D'
import type { AssistantState } from './assistantState'
import type { MouthShape } from './useAudioAnalyser'

const AiFaceScene = lazy(() => import('./AiFaceScene').then((m) => ({ default: m.AiFaceScene })))

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
    <Suspense fallback={<FaceFallback state={state} />}>
      <AiFaceScene
        state={state}
        amplitudeRef={amplitudeRef}
        mouthShapeRef={mouthShapeRef}
        isSpeaking={isSpeaking}
        reducedMotion={reducedMotion}
      />
    </Suspense>
  )
}
