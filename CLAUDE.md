# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Velnora, a premium AI-powered web development agency site. The agency builds high-performance websites, SEO solutions, AI-powered digital solutions, and business automation for growing businesses. This repo is the agency's own marketing site.

**Phase 1 (current): frontend only.** No backend, database, auth, admin dashboard, AI agents, payments, or CRM. The architecture is deliberately structured so those can be layered on later without a redesign, see "Future phases" below.

## Stack (decided, do not re-litigate without reason)

- **React 19 + TypeScript + Vite**, not Next.js, chosen explicitly for this project over the platform's usual Next.js default.
- **Tailwind CSS v4** via `@tailwindcss/vite`. Theme tokens live in `src/index.css` under `@theme`.
- **Motion** (`motion/react`, the Framer Motion successor) for animation, plus a couple of scroll-reveal/whileInView patterns. No GSAP.
- **React Three Fiber + drei** for the hero's 3D visual only, lazy-loaded and gated behind `src/hooks/useCanRender3D.ts` (WebGL support + rough low-power heuristic) with a CSS/DOM fallback (`SceneFallback.tsx`) for everything else, including `prefers-reduced-motion`.
- **React Router**, one route today (`/`), kept so additional pages (e.g. a dedicated `/seo` page) can be added without restructuring.
- **react-helmet-async** for per-page SEO metadata. Add new pages' metadata to `src/lib/seoConfig.ts`, not inline in components.
- **Lucide React** for icons (single icon family, do not mix in another).
- **oxlint** for linting (`npm run lint`), not eslint.

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

- Client-handling AI agent (chat, lead qualification) and a lead-finder agent are planned. Nothing in the frontend should assume their absence in a way that would require a rewrite (e.g. the Contact form's `submitContactForm` in `src/lib/contact.ts` is already isolated behind a single function so it can be swapped for a real API call, or extended with an agent handoff, without touching the UI).
- Backend/CMS/auth: none yet. When one is added, wire it in behind existing function boundaries (`src/lib/contact.ts`, `src/lib/seoConfig.ts`) rather than rewriting sections.

## Before going live

See the "Before Going Live" checklist in [README.md](README.md), placeholder domain, email, and OG image need real values.
