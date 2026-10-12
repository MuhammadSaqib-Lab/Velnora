import { domAnimation, LazyMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Loads only motion's animation features (animate / exit / in-view / hover /
 * tap) and renders the lightweight `m` components. The full `motion`
 * component also ships the layout-projection and drag engines; this site uses
 * neither, but projection nodes were mounted for every animated element and
 * read `window.innerWidth` right after React committed, forcing a synchronous
 * layout of the whole page (measured at ~560 ms per pass on a throttled
 * mobile profile). `strict` makes any accidental `motion.*` import throw in
 * development instead of silently pulling that code back in.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
