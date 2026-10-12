import { useState } from 'react'

let webglSupport: boolean | undefined

/**
 * Probed once and cached. This is a synchronous call into the GPU process, so
 * WHEN it runs matters: at startup the GPU is idle and it takes ~15 ms, but
 * once the page is painting (blurred header, blended noise overlay, a WebGL
 * canvas) the same call waited ~0.4-1 s on the main thread in measurements.
 * The module-level call at the bottom of this file therefore probes during
 * app start; everything later only reads the cached answer.
 */
function hasWebGL(): boolean {
  if (webglSupport === undefined) webglSupport = probeWebGL()
  return webglSupport
}

function probeWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    // Release the probe context right away: browsers cap live WebGL contexts
    // (~16), and creating one is real work, so it shouldn't linger.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
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
 * The same capability + power check as the hook below, as a plain function
 * so a caller can run it at a moment of its choosing (the public hero decides
 * once the page is idle). It never touches the GPU itself: WebGL support was
 * probed and cached at startup (see hasWebGL).
 */
export function canRender3DNow(): boolean {
  return !prefersLessData() && hasWebGL() && !isLikelyLowPower()
}

/**
 * The visitor asked the browser to save data (or is on a 2G-class connection):
 * don't spend ~900 kB on a decorative upgrade. The CSS visual is shown instead.
 * Network Information API support is partial (Chromium only), so a missing
 * value never blocks the 3D hero.
 */
function prefersLessData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return connection?.saveData === true || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g'
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

// Probe at module load (app start), while the GPU process is idle. See hasWebGL.
if (typeof document !== 'undefined') hasWebGL()
