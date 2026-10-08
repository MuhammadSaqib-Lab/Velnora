/**
 * Frontend feature switches. These only decide what the UI SHOWS — they are
 * never a security boundary (the backend independently enforces every
 * feature; see backend/src/aiAssistant/featureFlag.ts).
 *
 * Deliberately a hard-coded constant, not an environment variable: nothing
 * in the browser, the URL, localStorage or a public env var can turn the AI
 * Assistant UI back on — re-enabling it is a code change that goes through
 * review and a redeploy.
 *
 * AI_ASSISTANT_ENABLED — the Admin Dashboard's AI Assistant / Command
 * Center / voice console is TEMPORARILY DISABLED. While false: no nav entry,
 * no route (a bookmarked /internal/admin/ai-assistant redirects to the
 * dashboard overview), and the page's code is never requested by the app
 * (the lazy import in App.tsx is only created when this is true, so the
 * main bundle holds no reference to it; the bundler may still emit the
 * assistant's chunk as an unreferenced static file, which nothing loads and
 * which contains no secrets). The implementation under
 * src/components/internal/aiAssistant/ and src/pages/internal/admin/
 * AiAssistant.tsx is intentionally kept intact for the future phase.
 *
 * To reactivate: see backend/README.md → "AI Assistant (temporarily
 * disabled)". Flip this to true AND set AI_ASSISTANT_ENABLED=true on the
 * backend (both are required; the backend one is the real gate).
 */
export const AI_ASSISTANT_ENABLED = false as boolean
