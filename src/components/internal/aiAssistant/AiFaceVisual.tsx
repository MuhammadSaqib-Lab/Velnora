import { Suspense, lazy } from 'react'
import { useCanRender3D } from '@/hooks/useCanRender3D'
import type { AssistantState } from './AiFaceScene'

const AiFaceScene = lazy(() => import('./AiFaceScene').then((m) => ({ default: m.AiFaceScene })))

const STATE_LABEL: Record<AssistantState, string> = {
  idle: 'Idle',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

function FaceFallback({ state }: { state: AssistantState }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3" role="img" aria-label={`AI Assistant — ${STATE_LABEL[state]}`}>
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
 * Hero's 3D visual does on an unsupported browser, instead of crashing.
 */
export function AiFaceVisual({ state, amplitude }: { state: AssistantState; amplitude: number }) {
  const canRender3D = useCanRender3D()

  if (!canRender3D) return <FaceFallback state={state} />

  return (
    <Suspense fallback={<FaceFallback state={state} />}>
      <AiFaceScene state={state} amplitude={amplitude} />
    </Suspense>
  )
}
