import { useState } from 'react'

/**
 * Read once at mount (like useCanRender3D) rather than watched reactively,
 * since this only feeds the hero 3D scene's initial camera FOV, a
 * decorative choice that doesn't need to react to live window resizing.
 */
export function useIsCompactViewport(breakpoint = 640): boolean {
  const [isCompact] = useState(() => window.innerWidth < breakpoint)
  return isCompact
}
