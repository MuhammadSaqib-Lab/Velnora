import type { AssistantState } from './assistantState'

/**
 * Visual parameters an avatar renderer needs, independent of HOW it's
 * drawn. A procedural face reads these to drive shader uniforms and
 * mesh transforms (see avatar/GltfFaceAvatar.tsx); a future real VRM avatar would
 * read the exact same shape to drive its expression manager/blendshapes
 * instead — swapping the renderer never requires touching the AI
 * orchestration, voice, or chat logic that calls setState().
 */
export interface ExpressionParams {
  /** Rim/glow color for this state, as a hex string. */
  glowColor: string
  /** 0-1 glow intensity multiplier. */
  glowIntensity: number
  /** 0-1 baseline mouth openness before any speaking amplitude is added. */
  mouthBase: number
  /** Mouth corner curl: -1 (concerned/frown) to 1 (positive/smile), 0 neutral. */
  mouthCurl: number
  /** Eyelid narrowing / squint: 0 (relaxed, fully open) to 1 (focused/narrow). */
  eyeFocus: number
  /** Eyebrow lift: -1 (furrowed/lowered) to 1 (raised), 0 neutral. */
  browRaise: number
  /** Subtle head tilt in radians applied once on state entry. */
  headTilt: number
  /** How fast idle micro-motion (breathing/gaze) plays in this state. */
  restlessness: number
}

/**
 * Tuned for a premium, restrained "digital human employee" read rather
 * than a neon mascot — glow intensities stay low (peak 0.75) and the
 * emerald family is the ONLY accent color (see CLAUDE.md's single-
 * accent rule); amber is used for concerned/caution as a semantic
 * warning color, matching status colors used elsewhere in the admin
 * dashboard, not as a second brand accent.
 */
const STATES: Record<AssistantState, ExpressionParams> = {
  idle: { glowColor: '#34d399', glowIntensity: 0.32, mouthBase: 0.04, mouthCurl: 0.08, eyeFocus: 0, browRaise: 0, headTilt: 0, restlessness: 0.5 },
  listening: { glowColor: '#6ee7b7', glowIntensity: 0.48, mouthBase: 0.03, mouthCurl: 0.05, eyeFocus: 0.1, browRaise: 0.25, headTilt: 0.02, restlessness: 0.3 },
  attentive: { glowColor: '#6ee7b7', glowIntensity: 0.5, mouthBase: 0.03, mouthCurl: 0.08, eyeFocus: 0.15, browRaise: 0.35, headTilt: 0.03, restlessness: 0.2 },
  thinking: { glowColor: '#a7f3d0', glowIntensity: 0.4, mouthBase: 0.02, mouthCurl: -0.05, eyeFocus: 0.55, browRaise: -0.15, headTilt: -0.05, restlessness: 0.15 },
  speaking: { glowColor: '#34d399', glowIntensity: 0.55, mouthBase: 0.09, mouthCurl: 0.18, eyeFocus: 0.1, browRaise: 0.15, headTilt: 0, restlessness: 0.6 },
  working: { glowColor: '#10b981', glowIntensity: 0.45, mouthBase: 0.03, mouthCurl: 0, eyeFocus: 0.35, browRaise: 0.05, headTilt: 0, restlessness: 0.4 },
  success: { glowColor: '#34d399', glowIntensity: 0.65, mouthBase: 0.05, mouthCurl: 0.6, eyeFocus: 0.05, browRaise: 0.4, headTilt: 0.05, restlessness: 0.5 },
  positive: { glowColor: '#6ee7b7', glowIntensity: 0.55, mouthBase: 0.05, mouthCurl: 0.45, eyeFocus: 0.05, browRaise: 0.3, headTilt: 0.03, restlessness: 0.5 },
  concerned: { glowColor: '#fbbf24', glowIntensity: 0.4, mouthBase: 0.03, mouthCurl: -0.4, eyeFocus: 0.4, browRaise: -0.45, headTilt: -0.05, restlessness: 0.2 },
  caution: { glowColor: '#fbbf24', glowIntensity: 0.5, mouthBase: 0.02, mouthCurl: -0.3, eyeFocus: 0.5, browRaise: -0.3, headTilt: -0.03, restlessness: 0.15 },
}

/**
 * Adapter interface: anything that can turn an AssistantState into
 * ExpressionParams. ProceduralExpressionController is the only
 * implementation today; a VRMExpressionController implementing the same
 * interface (mapping states to real blendshape weights instead) is the
 * intended future swap-in.
 */
export interface FacialExpressionController {
  setState(state: AssistantState): ExpressionParams
}

export class ProceduralExpressionController implements FacialExpressionController {
  setState(state: AssistantState): ExpressionParams {
    return STATES[state]
  }
}
