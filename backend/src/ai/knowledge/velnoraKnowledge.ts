import { services } from '../../services/content.service.js'

/**
 * The AI Consultant's factual ground truth about Velnora. Reuses the
 * existing `services` array from content.service.ts (itself already kept
 * in sync with the frontend's src/data/services.ts) instead of typing the
 * service list a third time. Everything else here is a short, deliberately
 * duplicated fact set — small enough to keep in sync by hand, unlike a
 * whole content model — mirroring src/data/process.ts and src/data/faq.ts.
 *
 * IMPORTANT: only add facts that are actually true and stable. The system
 * prompt built from this file explicitly instructs the model not to
 * invent anything beyond it (see systemPrompt.ts) — treat this file as
 * the single source of truth an editor updates, not the model's own
 * judgment.
 */

export const serviceSummaries = services.map((s) => `- ${s.title}: ${s.description}`).join('\n')

export const processSummary = [
  '1. Discover — map the business, its customers, and what the current site fails to do for either.',
  '2. Strategy — define pages, content, and technical approach for how customers actually search and decide.',
  '3. Design — interfaces designed around real user flows, tested for clarity before development starts.',
  '4. Develop — built on modern, maintainable code with performance, accessibility, and SEO from the first commit.',
  '5. Launch & Grow — ship, monitor real performance data, keep refining as traffic and goals change.',
].join('\n')

export const factsSummary = [
  'A landing page typically takes 2-3 weeks from kickoff to launch; a full business site or e-commerce build typically runs 4-8 weeks. The exact estimate depends on scope and is given after understanding the project, never as a generic range up front.',
  'Projects run on a milestone-based payment schedule: a deposit to begin, then payments tied to milestones. Accepted via Payoneer, Wise, or direct bank wire transfer.',
  'No client account or login is required to work with Velnora — everything runs through direct email and calls.',
  'At launch, clients receive full source code, documentation for anything custom, and a walkthrough call.',
  "The site's Work section shows clearly-labeled CONCEPT projects that demonstrate design/technical range, not real client engagements — never claim they are real clients.",
].join('\n')
