# Velnora

Velnora is a premium AI-powered web development agency site. The frontend communicates web development, AI-powered solutions, SEO, UI/UX design, and business automation services, built as a fast, accessible, SEO-ready single-page marketing site, backed by a REST API for form intake.

This is **Phase 2: frontend + backend/database/API**. Still no authentication, admin dashboard, or AI agent integration, see [CLAUDE.md](CLAUDE.md) for the full phase breakdown.

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
npm run prisma:migrate
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
    layout/     Navbar, MobileMenu, Footer
    three/      R3F hero scene + CSS fallback
    ui/         Button, GlassPanel, Reveal, SectionHeading, Field
  data/         Nav items, services, process steps, projects, tech stack
  hooks/        useCanRender3D (WebGL/power capability gate)
  lib/          utils (cn), SEO metadata, api.ts (backend client), form validation
  pages/        Home
  sections/     One component per landing-page section

backend/                     (API, see backend/README.md)
  src/          config, controllers, routes, services, middleware, validators
  prisma/       schema.prisma, seed data
  tests/        Vitest + Supertest suite
```

## Backend integration

The Contact section (`src/sections/Contact.tsx`) posts to the backend's `POST /api/project-inquiry` via `src/lib/api.ts`. It handles four distinct outcomes: success, field-level validation errors (shown inline, same as client-side errors), a general server error (shown as a banner), and a network failure (backend unreachable), each with its own user-facing message, none of them ever surface raw error detail from the server.

The Free Audit form and the floating chat's quick-message box remain frontend-only for this phase (no backend endpoint exists for them yet), this is intentional scope, not an oversight, see `backend/README.md`'s "What's deliberately NOT built here".

## SEO

SEO work is ongoing alongside the backend, not deferred to "later." Current state: unique title/description/canonical/OG/Twitter metadata (`index.html`, `src/lib/seoConfig.ts`), a single semantic `<h1>` per page with a logical heading hierarchy, `robots.txt` + `sitemap.xml`, and `Organization`/`ProfessionalService` JSON-LD structured data. All core textual content (headings, service descriptions, portfolio copy) lives in real DOM/HTML, not inside the WebGL canvas, so it stays crawlable regardless of 3D rendering support.

The architecture is ready for future SEO expansion (dedicated `/services/*`, `/industries/*`, `/locations/*` pages) without a redesign: add a route in `src/App.tsx`, a matching entry in `src/lib/seoConfig.ts`, and a `<url>` entry in `public/sitemap.xml`. No placeholder/thin pages have been added speculatively, that would hurt SEO rather than help it.

## Before Going Live

- `velnora.com` domain references in `index.html`, `src/lib/seoConfig.ts`, `public/robots.txt`, `public/sitemap.xml`, and `backend/.env`'s `FRONTEND_URL`
- `public/og-image.png` referenced by Open Graph/Twitter tags does not exist yet, add a real 1200x630 image
- `vercel.json`'s CSP `connect-src` currently allowlists the placeholder `https://api.velnora.com`, replace it with the real backend origin (exact origin, no wildcard) once it's deployed, or the frontend's API calls will be silently blocked by the browser's CSP in production
- Provision a real production PostgreSQL database and set a strong, unique `DATABASE_URL` (never reuse the local dev password)
- Set `NODE_ENV=production` and a real `FRONTEND_URL` (no wildcard, no localhost) for the backend in production
- See `backend/README.md`'s "What's deliberately NOT built here" and [SECURITY.md](SECURITY.md)'s "Future backend security requirements" for what's still needed before this handles real user data at scale (auth, CSRF, file upload validation, etc.)

## Deployment

**Frontend** deploys cleanly to [Vercel](https://vercel.com) or any static host as a Vite SPA build (`npm run build` outputs to `dist/`). `vercel.json` includes recommended security headers.

**Backend** needs a Node host with a persistent PostgreSQL connection (e.g. a Vercel/Render/Railway Node service + a managed Postgres instance). Run `npm run build && npm run prisma:deploy && npm start` in production; `prisma:deploy` applies existing migrations without generating new ones (safe for CI/CD).

## License

Proprietary, all rights reserved.
