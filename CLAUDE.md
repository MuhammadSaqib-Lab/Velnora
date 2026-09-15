# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Velnora, a premium AI-powered web development agency site. The agency builds high-performance websites, SEO solutions, AI-powered digital solutions, and business automation for growing businesses. This repo is the agency's own marketing site.

**Phase 2 (frontend + backend/database/API) is done. The AI Client Handling Agent is now built** (originally scoped as "Phase 4" below, built ahead of Phase 3 at explicit request — the numbering in "Future phases" below still reflects the original plan). Still no auth, admin dashboard, lead-finder agent, payments, or CRM. The architecture is deliberately structured so those can be layered on later without a redesign, see "Future phases" below.

## Stack (decided, do not re-litigate without reason)

- **React 19 + TypeScript + Vite**, not Next.js, chosen explicitly for this project over the platform's usual Next.js default.
- **Tailwind CSS v4** via `@tailwindcss/vite`. Theme tokens live in `src/index.css` under `@theme`.
- **Motion** (`motion/react`, the Framer Motion successor) for animation, plus a couple of scroll-reveal/whileInView patterns. No GSAP.
- **React Three Fiber + drei** for the hero's 3D visual only, lazy-loaded and gated behind `src/hooks/useCanRender3D.ts` (WebGL support + rough low-power heuristic) with a CSS/DOM fallback (`SceneFallback.tsx`) for everything else, including `prefers-reduced-motion`.
- **React Router**, one route today (`/`), kept so additional pages (e.g. a dedicated `/seo` page) can be added without restructuring.
- **react-helmet-async** for per-page SEO metadata. Add new pages' metadata to `src/lib/seoConfig.ts`, not inline in components.
- **Lucide React** for icons (single icon family, do not mix in another).
- **oxlint** for linting (`npm run lint`), not eslint.

**Backend** (`backend/`, a separate Node project, see `backend/README.md`): Express 4 + TypeScript + Prisma/PostgreSQL + Zod. Controllers thin, business logic in `services/`, every public POST body validated by a Zod schema in `validators/` before a controller sees it. Don't import backend code into the frontend or vice versa, they're separately deployable; shared concepts (e.g. the allowed `projectType`/`budgetRange` values) are intentionally duplicated in both places rather than cross-imported, keep both in sync by hand if you change one (frontend: `src/sections/Contact.tsx`'s `<select>` options; backend: `backend/src/validators/shared.ts`).

**AI Client Handling Agent** (`backend/src/ai/`, see backend/README.md's "AI Client Handling Agent" section): a chat consultant surfaced via `src/components/chat/FloatingChatWidget.tsx`, talking to `POST /api/ai/chat`. Provider-agnostic by design — business logic (`backend/src/services/aiChat.service.ts`) only imports from `backend/src/ai/providers/types.ts`, never the Anthropic SDK directly (that's isolated to `AnthropicProvider.ts`). To change what the agent knows, edit `backend/src/ai/knowledge/velnoraKnowledge.ts`; to change its tone/rules, edit `backend/src/ai/prompts/systemPrompt.ts`. Its only tool (`save_lead`) can create exactly one new `QualifiedLead` row and nothing else — no update, delete, or read access — that's the actual defense against prompt-injected destructive requests, not just prompt wording.

## Design system

- Single accent color: emerald (`--color-accent` family), deliberately chosen over the generic "AI purple" look. Do not introduce a second accent color.
- Neutral base is off-black (`--color-canvas` `#09090b`), never pure `#000`.
- Font: Geist Sans + Geist Mono (self-hosted via `@fontsource/geist-sans` and `@fontsource/geist-mono`), not Inter.
- Radius lock: `--radius-panel` (cards/panels) and `--radius-field` (inputs) plus `rounded-full` for buttons/pills. Don't introduce other radius values ad hoc.
- **Naming gotcha:** Tailwind v4 auto-generates color utilities from any `--color-*` key in `@theme`. Never name a theme color token the same as a built-in Tailwind scale key (this project hit exactly this bug: `--color-base` silently redefined the `text-base` font-size utility into a color utility, blacking out text). Check new token names against Tailwind's default font-size/spacing/radius scale before adding them.

## Conventions

- One component per file under `src/sections/` per landing-page section; `src/pages/Home.tsx` just assembles them in order.
- Reusable primitives live in `src/components/ui/`; layout chrome (Navbar/MobileMenu/Footer) in `src/components/layout/`; the 3D scene and its fallback in `src/components/three/`.
- Copy/content data (services, process steps, projects, nav items, tech stack) lives in `src/data/*.ts`, not inline in JSX, so it's easy to edit without touching layout code.
- No fabricated client logos, fake testimonials, or invented statistics. The portfolio section uses clearly-labeled concept projects; the tech-stack strip under the hero shows real technologies this site is actually built on (via Simple Icons), not client logos.
- Prefer real, provisioned integrations (via the Vercel Marketplace) over mocked services once a backend is introduced, check the `vercel:marketplace` skill before wiring one up.

## Future phases (do not build yet, but keep the door open)

- **Phase 4, client-handling AI agent: done** (see "AI Client Handling Agent" above), built ahead of Phase 3 at explicit request. Kept for history: it originally read "chat, lead qualification, extend the Contact form's `apiPost` call rather than rewriting it" — the agent is a separate `POST /api/ai/chat` endpoint instead, since it needed its own conversation/tool-call round trips that don't fit the single-shot `POST /api/project-inquiry` shape; the Contact form itself is untouched.
- Phase 3: authentication (the `User` Prisma model already exists as preparation, no endpoint uses it yet), CSRF protection, secure sessions. Still not built, despite being numbered before the now-done Phase 4.
- Phase 5: lead-finder agent. The `Lead` Prisma model already exists as preparation (`backend/prisma/schema.prisma`), distinct from the AI Client Handling Agent's own `QualifiedLead` model — no route/controller reads or writes `Lead` yet, don't add one until this phase.
- Phase 6: admin dashboard (to triage `ContactSubmission`/`ProjectInquiry`/`Lead`/`QualifiedLead` rows).
- Phase 7: deployment, monitoring, final security audit.

## Before going live

See the "Before Going Live" checklist in [README.md](README.md), placeholder domain, email, and OG image need real values.
