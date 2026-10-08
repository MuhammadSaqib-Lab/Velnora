import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

/**
 * AI Assistant kill switch — the single source of truth for whether the
 * Admin Dashboard's AI Assistant / Command Center / voice console may run.
 *
 * The assistant is TEMPORARILY DISABLED (default: off). Its code is kept
 * intact so it can be re-enabled in a future phase; see backend/README.md's
 * "AI Assistant (temporarily disabled)" for the reactivation steps.
 *
 * The flag is server-side deployment configuration (the AI_ASSISTANT_ENABLED
 * environment variable). It is deliberately not readable or settable from
 * any request, and there is no VITE_/public counterpart: the browser cannot
 * switch it on, and the frontend's own hide-the-UI switch
 * (src/config/features.ts) is only cosmetic — this flag is the enforcement.
 *
 * It is checked at three independent layers, so no single mistake re-opens
 * the feature: the route gate (requireAiAssistantEnabled), the controller
 * (which only loads the assistant modules once this passes), and the
 * service entry points (orchestrator.service.ts, elevenLabs.service.ts).
 */
export const AI_ASSISTANT_DISABLED_MESSAGE = 'AI Assistant is currently disabled.'

export function isAiAssistantEnabled(): boolean {
  return env.AI_ASSISTANT_ENABLED
}

/** Throws the standard "disabled" error (503). Safe to call at the top of any assistant entry point. */
export function assertAiAssistantEnabled(): void {
  if (!isAiAssistantEnabled()) {
    throw new AppError(503, AI_ASSISTANT_DISABLED_MESSAGE)
  }
}
