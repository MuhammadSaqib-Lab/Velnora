import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from 'motion/react'
import { canRender3DNow } from '@/hooks/useCanRender3D'
import { SceneFallback } from './SceneFallback'

const HeroScene = lazy(() => import('./HeroScene'))

/**
 * True from the first moment the element is (almost) entirely on screen, and
 * stays true. On a desktop the hero visual is fully visible on first paint, so
 * nothing changes there. On a phone it sits under the headline and buttons with
 * only its top edge on the first screen: the ~900 kB of 3D code and ~2 s of
 * CPU (on a throttled mobile profile) are then spent only if the visitor
 * actually scrolls to it. Until then they see the CSS visual, exactly as they
 * already do during the idle wait.
 */
function useFullyVisibleOnce(ref: RefObject<HTMLElement | null>, minRatio = 0.95): boolean {
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || seen || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio >= minRatio) setSeen(true)
      },
      { threshold: [minRatio] },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, seen, minRatio])

  // Browsers without IntersectionObserver keep the previous behavior (always eligible).
  return seen || typeof IntersectionObserver === 'undefined'
}

/**
 * Decides, once the page has finished loading and the browser is idle,
 * whether the 3D upgrade should happen at all. Nothing here runs during the
 * first render: the WebGL capability probe creates a real GPU context, and
 * the 3D bundle is ~900 kB of JavaScript that would otherwise compete with
 * the page's own scripts and images for the same CPU and bandwidth.
 *
 * It waits for the window `load` event (so the 3D chunk is never fetched
 * while the page's critical resources are still in flight), then for an idle
 * period (falling back to a short timeout where requestIdleCallback is
 * missing, e.g. Safari). The CSS fallback is already visible in the meantime,
 * so this only delays the upgrade to 3D, never any visible content.
 */
function useCan3DWhenIdle(eligible: boolean): boolean {
  const [can3D, setCan3D] = useState(false)

  useEffect(() => {
    if (!eligible) return
    let cancelled = false
    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const decide = () => {
      if (!cancelled) setCan3D(canRender3DNow())
    }
    const schedule = () => {
      if (typeof requestIdleCallback === 'function') idleId = requestIdleCallback(decide, { timeout: 1500 })
      else timeoutId = setTimeout(decide, 200)
    }

    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })

    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (idleId !== undefined) cancelIdleCallback(idleId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [eligible])

  return can3D
}

/**
 * Chooses between the R3F scene and the CSS fallback based on WebGL
 * support, estimated device power, and prefers-reduced-motion. The 3D
 * bundle is only fetched when we've confirmed it's worth loading.
 */
export function HeroVisual() {
  const reduceMotion = useReducedMotion()
  const container = useRef<HTMLDivElement>(null)
  const onScreen = useFullyVisibleOnce(container)
  const can3D = useCan3DWhenIdle(onScreen)
  const shouldRender3D = can3D && !reduceMotion

  return (
    <div ref={container} className="relative aspect-square w-full max-w-xl">
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
