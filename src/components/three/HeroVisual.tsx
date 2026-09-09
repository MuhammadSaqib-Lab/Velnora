import { lazy, Suspense } from 'react'
import { useReducedMotion } from 'motion/react'
import { useCanRender3D } from '@/hooks/useCanRender3D'
import { SceneFallback } from './SceneFallback'

const HeroScene = lazy(() => import('./HeroScene'))

/**
 * Chooses between the R3F scene and the CSS fallback based on WebGL
 * support, estimated device power, and prefers-reduced-motion. The 3D
 * bundle is only fetched when we've confirmed it's worth loading.
 */
export function HeroVisual() {
  const canRender3D = useCanRender3D()
  const reduceMotion = useReducedMotion()
  const shouldRender3D = canRender3D && !reduceMotion

  return (
    <div className="relative aspect-square w-full max-w-xl">
      {shouldRender3D ? (
        <Suspense fallback={<SceneFallback />}>
          <HeroScene />
        </Suspense>
      ) : (
        <SceneFallback />
      )}
    </div>
  )
}
