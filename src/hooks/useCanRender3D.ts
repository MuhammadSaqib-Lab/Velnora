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
  return cores <= 4 && isNarrowViewport
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
