import { lazy, Suspense, useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useCanRender3D } from '@/hooks/useCanRender3D'
import { SceneFallback } from './SceneFallback'

const HeroScene = lazy(() => import('./HeroScene'))

/**
 * Waits for the browser to be idle (falling back to a short timeout on
 * browsers without requestIdleCallback, e.g. Safari) before returning
 * true. The 3D scene's WebGL/Three.js setup is real, synchronous
 * main-thread work — mounting it immediately would compete with page
 * hydration for the same window Lighthouse counts as Total Blocking
 * Time. The CSS fallback is already visible in the meantime, so this
 * only delays the upgrade to 3D, not any visible content.
 */
function useIsIdle() {
  const [isIdle, setIsIdle] = useState(false)

  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setIsIdle(true), { timeout: 1500 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(() => setIsIdle(true), 200)
    return () => clearTimeout(id)
  }, [])

  return isIdle
}

/**
 * Chooses between the R3F scene and the CSS fallback based on WebGL
 * support, estimated device power, and prefers-reduced-motion. The 3D
 * bundle is only fetched when we've confirmed it's worth loading.
 */
export function HeroVisual() {
  const canRender3D = useCanRender3D()
  const reduceMotion = useReducedMotion()
  const isIdle = useIsIdle()
  const shouldRender3D = canRender3D && !reduceMotion && isIdle

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
