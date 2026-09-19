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
  // BOTH signals required: a narrow viewport alone doesn't mean weak
  // hardware (most modern phones report >4 cores and render this scene
  // fine — it's a wireframe icosahedron + 14 small badges + a capped
  // pixel ratio, not a heavy scene), and disabling on viewport width
  // alone blanket-hid the 3D hero on every phone, which is a real,
  // user-visible regression from the intended design, not just a
  // Lighthouse number. Only treat a device as low-power when it's
  // narrow AND reports a low core count (genuinely old/weak hardware).
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
