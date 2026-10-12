import { useEffect, useRef, useState, type ComponentType } from 'react'

/**
 * Renders the homepage sections below the first screen without making them
 * part of the initial load. Rendering all 18 sections at once was a single
 * ~1.1 s task on a throttled mobile profile and put their code in the entry
 * bundle; here they ship as a separate chunk that is fetched once the page
 * has loaded and the browser is idle, and are then mounted one per idle tick
 * so no single task gets long.
 *
 * Nothing is lost for visitors:
 *  - Any sign the visitor is engaging (scroll, wheel, touch, key press,
 *    pointer down, a hash change, or loading the page with a #hash) loads and
 *    mounts every section immediately.
 *  - A click on an in-page anchor whose target is not mounted yet (e.g. the
 *    nav's "#contact") mounts everything, then scrolls to that target.
 *  - The sections still end up in the DOM without any interaction, so
 *    find-in-page, crawlers and anchors behave as before; they simply arrive a
 *    moment after the first paint instead of with it.
 */
type Phase = 'waiting' | 'loading' | 'ready'

const IDLE_TIMEOUT_MS = 2000
const TICK_TIMEOUT_MS = 120
const ENGAGEMENT_EVENTS = ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown', 'hashchange'] as const

function whenIdle(callback: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(callback, { timeout })
    return () => cancelIdleCallback(id)
  }
  const id = window.setTimeout(callback, 50)
  return () => window.clearTimeout(id)
}

/** `instant` for a deep link on page load (nobody wants to watch a 12,000 px smooth scroll); clicks keep the page's own smooth scrolling. */
function scrollToHash(id: string, instant: boolean) {
  const target = id ? document.getElementById(id) : null
  target?.scrollIntoView(instant ? { behavior: 'instant' } : undefined)
}

export function DeferredHomeSections() {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [sections, setSections] = useState<ComponentType[]>([])
  const [visible, setVisible] = useState(0)
  const [urgent, setUrgent] = useState(() => window.location.hash.length > 1)
  // The anchor the visitor asked for, scrolled to once everything is mounted (a ref: nothing renders from it).
  const pendingAnchor = useRef<{ id: string; instant: boolean } | null>(
    window.location.hash.length > 1 ? { id: window.location.hash.slice(1), instant: true } : null,
  )

  // 1. Decide when to start fetching the chunk.
  useEffect(() => {
    if (phase !== 'waiting') return
    let cancelIdle: (() => void) | undefined
    const start = () => setPhase('loading')
    const scheduleIdle = () => {
      cancelIdle = whenIdle(start, IDLE_TIMEOUT_MS)
    }

    const engage = () => {
      setUrgent(true)
      start()
    }
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]')
      const id = anchor?.getAttribute('href')?.slice(1)
      if (id && !document.getElementById(id)) {
        pendingAnchor.current = { id, instant: false }
        engage()
      }
    }

    if (urgent) start()
    else if (document.readyState === 'complete') scheduleIdle()
    else window.addEventListener('load', scheduleIdle, { once: true })

    for (const name of ENGAGEMENT_EVENTS) window.addEventListener(name, engage, { once: true, passive: true })
    document.addEventListener('click', onClick, true)

    return () => {
      cancelIdle?.()
      window.removeEventListener('load', scheduleIdle)
      for (const name of ENGAGEMENT_EVENTS) window.removeEventListener(name, engage)
      document.removeEventListener('click', onClick, true)
    }
  }, [phase, urgent])

  // 2. Fetch the chunk.
  useEffect(() => {
    if (phase !== 'loading') return
    let cancelled = false
    import('@/sections/belowTheFold').then((module) => {
      if (cancelled) return
      setSections(module.belowTheFoldSections)
      setPhase('ready')
    })
    return () => {
      cancelled = true
    }
  }, [phase])

  // 3. Mount the sections one per idle tick (an engaged visitor skips the
  //    ticks: `shown` below jumps straight to all of them).
  useEffect(() => {
    if (phase !== 'ready' || urgent || visible >= sections.length) return
    return whenIdle(() => setVisible((count) => count + 1), TICK_TIMEOUT_MS)
  }, [phase, visible, sections.length, urgent])

  // Visitors who engage while sections are still arriving get the rest at once.
  useEffect(() => {
    if (phase !== 'ready' || urgent) return
    const engage = () => setUrgent(true)
    for (const name of ENGAGEMENT_EVENTS) window.addEventListener(name, engage, { once: true, passive: true })
    return () => {
      for (const name of ENGAGEMENT_EVENTS) window.removeEventListener(name, engage)
    }
  }, [phase, urgent])

  // 4. Once everything is mounted, honour an anchor the visitor asked for.
  const shown = urgent ? sections.length : visible
  const allMounted = phase === 'ready' && shown >= sections.length
  useEffect(() => {
    if (!allMounted || !pendingAnchor.current) return
    scrollToHash(pendingAnchor.current.id, pendingAnchor.current.instant)
    pendingAnchor.current = null
  }, [allMounted])

  return (
    <>
      {sections.slice(0, shown).map((Section, index) => (
        <Section key={index} />
      ))}
      {/*
        Keeps the footer well below the fold while sections are still arriving.
        It (and the footer, see index.css) opts out of scroll anchoring: without
        that, a visitor who reached the bottom of the still-short page would be
        carried to the footer of the full page when the sections mount above it.
      */}
      {!allMounted ? <div aria-hidden="true" style={{ minHeight: '100svh', overflowAnchor: 'none' }} /> : null}
    </>
  )
}
