# Velnora

Velnora is a premium AI-powered web development agency site. The frontend communicates web development, AI-powered solutions, SEO, UI/UX design, and business automation services, built as a fast, accessible, SEO-ready single-page marketing site, backed by a REST API for form intake, an AI Client Handling Agent (chat consultant), and an AI Lead Finder Agent (outbound research + Gmail drafts, human-reviewed).

**Phase 2 (frontend + backend/database/API) is done, the AI Client Handling Agent and the AI Lead Finder Agent are built, and an internal Admin Dashboard now ties both together.** Still no real multi-user authentication or payments, see [CLAUDE.md](CLAUDE.md) for the full phase breakdown.

## Stack

**Frontend**
- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** for styling
- **Motion** (`motion/react`) for animation
- **React Three Fiber + drei** for the hero's 3D visual, with an automatic CSS fallback for devices without WebGL, low-power hardware, or `prefers-reduced-motion`
- **React Router** (single route today, ready for more pages)
- **react-helmet-async** for per-page SEO metadata
- **Lucide React** for icons

**Backend** (see [backend/README.md](backend/README.md) for full details)
- **Node.js + TypeScript + Express**
- **PostgreSQL + Prisma**
- **Zod** for server-side validation
- **Helmet, cors, express-rate-limit** for the API security baseline
- **`@anthropic-ai/sdk`** powering the AI Client Handling Agent and the Lead Finder's email generation, behind a provider-agnostic interface (`backend/src/ai/`)
- **`googleapis`** for Gmail draft creation, **`cheerio`** for website analysis (`backend/src/leadFinder/`)

## Getting Started

This is two separate projects sharing one repo: the frontend at the root, the backend in `backend/`. Run both for the full experience.

```bash
# Frontend
npm install
npm run dev              # http://localhost:5173

# Backend (separate terminal)
cd backend
npm install
cp .env.example .env      # fill in a real DATABASE_URL, see backend/README.md
npm run prisma:generate
npm run prisma:deploy     # applies the already-generated migration
npm run dev                # http://localhost:4000
```

The frontend calls the backend via `VITE_API_URL` (see [.env.example](.env.example)), defaulting to `http://localhost:4000/api` if unset.

Other frontend scripts:

```bash
npm run build     # type-check and production build
npm run preview   # serve the production build locally
npm run lint      # oxlint
```

## Project Structure

```
src/                        (frontend)
  components/
    chat/       FloatingChatWidget — the AI Consultant UI, talks to POST /api/ai/chat
    layout/     Navbar, MobileMenu, Footer
    three/      R3F hero scene + CSS fallback
    ui/         Button, GlassPanel, Reveal, SectionHeading, Field
  data/         Nav items, services, process steps, projects, tech stack
  hooks/        useCanRender3D (WebGL/power capability gate)
  lib/          utils (cn), SEO metadata, api.ts (backend client), form validation
  pages/        Home
  pages/internal/          Lead Finder test interface (not linked publicly, noindex, lazy-loaded)
  pages/internal/admin/    Admin Dashboard — overview, client leads, lead finder leads, detail pages
  components/internal/     AdminTokenGate, StatCard, StatusBadge, Pagination, loading/empty/error states
  sections/     One component per landing-page section

backend/                     (API, see backend/README.md)
  src/          config, controllers, routes, services, middleware, validators
  src/ai/       AI Client Handling Agent — providers, prompts, knowledge, tools
  src/leadFinder/  AI Lead Finder Agent — search, analysis, scoring, email, Gmail
  prisma/       schema.prisma, seed data
  tests/        Vitest + Supertest suite
```

## Backend integration

The Contact section (`src/sections/Contact.tsx`) posts to the backend's `POST /api/project-inquiry` via `src/lib/api.ts`. It handles four distinct outcomes: success, field-level validation errors (shown inline, same as client-side errors), a general server error (shown as a banner), and a network failure (backend unreachable), each with its own user-facing message, none of them ever surface raw error detail from the server.

The floating chat widget (`src/components/chat/FloatingChatWidget.tsx`) is a real AI consultant, not a stub — it talks to `POST /api/ai/chat` and can qualify a visitor and save their details as a lead for the team. See `backend/README.md`'s "AI Client Handling Agent" section for the full architecture, and [SECURITY.md](SECURITY.md) for its prompt-injection and abuse-protection design.

The Free Audit form remains frontend-only for this phase (no backend endpoint exists for it yet), this is intentional scope, not an oversight, see `backend/README.md`'s "What's deliberately NOT built here".

The AI Lead Finder Agent is a separate, internal-only feature — it researches businesses that may need Velnora's services and drafts (never sends) a personalized outreach email to Gmail for human review. It's reachable at `/internal/lead-finder` (a minimal, lazy-loaded testing interface, not linked from the public site, excluded from `robots.txt`, and marked `noindex`), gated by the same shared admin token the backend's `/api/leads/*` routes require. See `backend/README.md`'s "AI Lead Finder Agent" section for the full architecture and the one-time Gmail OAuth setup.

The **Admin Dashboard** (`/internal/admin`, login at `/admin/login`) is the internal, protected home for managing both AI agents' leads in one place: real-time overview stats, Client Handling Agent leads (status, qualification, conversation review), and Lead Finder leads (research findings, scoring breakdown, outreach email review, Gmail draft creation) with server-side search/filter/sort/pagination. It's gated by a real email+password login with server-side sessions (`AdminUser`/`AdminSession`, an `httpOnly` cookie, bcrypt-hashed passwords) — not the shared token `/internal/lead-finder` still uses. Both `/admin/` and `/internal/` are `noindex`/excluded from `robots.txt`, and everything is lazy-loaded so it adds nothing to the public site's bundle. It never sends email automatically, drafting into Gmail always requires an explicit human click, and review/send always happens in Gmail itself. See `backend/README.md`'s "Admin Dashboard" and "Admin Dashboard authentication" sections for the full architecture, and [SECURITY.md](SECURITY.md)'s "Admin Dashboard security" section for its threat model.

## SEO

SEO work is ongoing alongside the backend, not deferred to "later." Current state: unique title/description/canonical/OG/Twitter metadata (`index.html`, `src/lib/seoConfig.ts`), a single semantic `<h1>` per page with a logical heading hierarchy, `robots.txt` + `sitemap.xml`, and `Organization`/`ProfessionalService` JSON-LD structured data. All core textual content (headings, service descriptions, portfolio copy) lives in real DOM/HTML, not inside the WebGL canvas, so it stays crawlable regardless of 3D rendering support.

The architecture is ready for future SEO expansion (dedicated `/services/*`, `/industries/*`, `/locations/*` pages) without a redesign: add a route in `src/App.tsx`, a matching entry in `src/lib/seoConfig.ts`, and a `<url>` entry in `public/sitemap.xml`. No placeholder/thin pages have been added speculatively, that would hurt SEO rather than help it.

## Before Going Live

- `velnora.com` domain references in `index.html`, `src/lib/seoConfig.ts`, `public/robots.txt`, `public/sitemap.xml`, and `backend/.env`'s `FRONTEND_URL`
- `public/og-image.png` referenced by Open Graph/Twitter tags does not exist yet, add a real 1200x630 image
- `vercel.json`'s `rewrites` proxies `/api/*` to the real deployed backend (`https://velnora-41qv.onrender.com`) so the browser only ever calls the frontend's own origin (`connect-src 'self'` in the CSP is enough) — if the backend ever moves to a different host, update the rewrite's destination URL here. This isn't just tidiness: the frontend calling the backend cross-origin directly broke the Admin Dashboard's session cookie twice in production (browsers won't attach `SameSite=Lax` to a cross-site request at all, and `SameSite=None` then hit third-party-cookie blocking), which is why this proxy exists rather than a plain cross-origin `fetch()`.
- Provision a real production PostgreSQL database and set a strong, unique `DATABASE_URL` (never reuse the local dev password)
- Set `NODE_ENV=production` and a real `FRONTEND_URL` on the backend (Render) matching the exact deployed Vercel origin — a mismatch here causes a CORS `403` on every request from the live site (this exact symptom was hit and confirmed once, `FRONTEND_URL` must be updated in Render's dashboard, it isn't something a git push alone can fix)
- Set a real `ANTHROPIC_API_KEY` in the backend's production environment for the AI Consultant to actually respond (it degrades to a friendly "not configured" message without one, the rest of the site still works)
- Set a real, strong `LEAD_FINDER_ADMIN_TOKEN` (still used by the standalone `/internal/lead-finder` page), and optionally `GOOGLE_PLACES_API_KEY` and the Gmail OAuth variables, for the Lead Finder to be usable in production — see `backend/README.md`'s "AI Lead Finder Agent" section for the one-time Gmail setup flow
- Set `ADMIN_EMAIL`/`ADMIN_PASSWORD` once to bootstrap the first Admin Dashboard login account (a strong, unique password, not reused from anywhere else), then remove them from the production environment afterward, they're not needed again unless recreating that account — see `backend/README.md`'s "Admin Dashboard authentication" section
- See `backend/README.md`'s "What's deliberately NOT built here" and [SECURITY.md](SECURITY.md)'s "Future backend security requirements" for what's still needed before this handles real user data at scale (auth, CSRF, file upload validation, etc.)

## Deployment

**Frontend** deploys cleanly to [Vercel](https://vercel.com) or any static host as a Vite SPA build (`npm run build` outputs to `dist/`). `vercel.json` includes recommended security headers.

**Backend** needs a Node host with a persistent PostgreSQL connection (e.g. a Vercel/Render/Railway Node service + a managed Postgres instance). Run `npm run build && npm run prisma:deploy && npm start` in production; `prisma:deploy` applies existing migrations without generating new ones (safe for CI/CD).

## License

Proprietary, all rights reserved.
