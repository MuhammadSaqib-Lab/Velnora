import { useState } from 'react'

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function isLikelyLowPower(): boolean {
  const cores = navigator.hardwareConcurrency ?? 4
  const isNarrowViewport = window.innerWidth < 640
  // Either signal alone is enough to skip the 3D scene: a narrow viewport
  // means a phone regardless of reported core count (many phones report
  // 6-8 cores but still choke on R3F/three.js), and a low core count means
  // a weak device regardless of viewport width. Previously this required
  // BOTH conditions (AND), so most modern phones — which report >4 cores —
  // slipped through and loaded the ~250KB gzipped 3D bundle on mobile,
  // driving up TBT/long tasks/main-thread time there.
  return cores <= 4 || isNarrowViewport
}

/**
 * Gates heavy WebGL rendering behind a capability + power check so the
 * hero degrades gracefully to a static/CSS visual instead of tanking
 * performance on low-power or unsupported devices.
 */
export function useCanRender3D() {
  const [canRender] = useState<boolean>(() => hasWebGL() && !isLikelyLowPower())
  return canRender
}
