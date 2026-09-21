import type { AssistantState } from './assistantState'

/**
 * Visual parameters an avatar renderer needs, independent of HOW it's
 * drawn. A procedural face reads these to drive shader uniforms and
 * mesh transforms (see AiFaceScene.tsx); a future real VRM avatar would
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
  /** Brow/eye narrowing: -1 (relaxed/wide) to 1 (focused/narrow). */
  eyeFocus: number
  /** Subtle head tilt in radians applied once on state entry. */
  headTilt: number
  /** How fast idle micro-motion (breathing/gaze) plays in this state. */
  restlessness: number
}

const STATES: Record<AssistantState, ExpressionParams> = {
  idle: { glowColor: '#34d399', glowIntensity: 0.5, mouthBase: 0.05, mouthCurl: 0.1, eyeFocus: 0, headTilt: 0, restlessness: 0.5 },
  listening: { glowColor: '#6ee7b7', glowIntensity: 0.75, mouthBase: 0.04, mouthCurl: 0.05, eyeFocus: 0.3, headTilt: 0.02, restlessness: 0.3 },
  attentive: { glowColor: '#6ee7b7', glowIntensity: 0.8, mouthBase: 0.04, mouthCurl: 0.1, eyeFocus: 0.5, headTilt: 0.03, restlessness: 0.2 },
  thinking: { glowColor: '#a7f3d0', glowIntensity: 0.65, mouthBase: 0.03, mouthCurl: -0.05, eyeFocus: 0.6, headTilt: -0.04, restlessness: 0.15 },
  speaking: { glowColor: '#34d399', glowIntensity: 1, mouthBase: 0.1, mouthCurl: 0.2, eyeFocus: 0.2, headTilt: 0, restlessness: 0.6 },
  working: { glowColor: '#10b981', glowIntensity: 0.7, mouthBase: 0.04, mouthCurl: 0, eyeFocus: 0.4, headTilt: 0, restlessness: 0.4 },
  success: { glowColor: '#34d399', glowIntensity: 1.1, mouthBase: 0.06, mouthCurl: 0.6, eyeFocus: 0.1, headTilt: 0.05, restlessness: 0.5 },
  positive: { glowColor: '#6ee7b7', glowIntensity: 0.9, mouthBase: 0.06, mouthCurl: 0.45, eyeFocus: 0.1, headTilt: 0.03, restlessness: 0.5 },
  concerned: { glowColor: '#fbbf24', glowIntensity: 0.6, mouthBase: 0.04, mouthCurl: -0.4, eyeFocus: 0.5, headTilt: -0.05, restlessness: 0.2 },
  caution: { glowColor: '#fbbf24', glowIntensity: 0.75, mouthBase: 0.03, mouthCurl: -0.3, eyeFocus: 0.6, headTilt: -0.03, restlessness: 0.15 },
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
