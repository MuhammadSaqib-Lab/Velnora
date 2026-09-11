# Velnora

Velnora is a premium AI-powered web development agency site. The frontend communicates web development, AI-powered solutions, SEO, UI/UX design, and business automation services, built as a fast, accessible, SEO-ready single-page marketing site.

This is **Phase 1: frontend only**. There is no backend, database, authentication, or AI agent integration yet. Everything here is built so those can be added later without a redesign (see [CLAUDE.md](CLAUDE.md) for details).

## Stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** for styling
- **Motion** (`motion/react`) for animation
- **React Three Fiber + drei** for the hero's 3D visual, with an automatic CSS fallback for devices without WebGL, low-power hardware, or `prefers-reduced-motion`
- **React Router** (single route today, ready for more pages)
- **react-helmet-async** for per-page SEO metadata
- **Lucide React** for icons

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

Other scripts:

```bash
npm run build     # type-check and production build
npm run preview   # serve the production build locally
npm run lint      # oxlint
```

## Project Structure

```
src/
  components/
    layout/     Navbar, MobileMenu, Footer
    three/      R3F hero scene + CSS fallback
    ui/         Button, GlassPanel, Reveal, SectionHeading, Field
  data/         Nav items, services, process steps, projects, tech stack
  hooks/        useCanRender3D (WebGL/power capability gate)
  lib/          utils (cn), SEO metadata + component, contact form logic
  pages/        Home
  sections/     One component per landing-page section
```

## Before Going Live

A few placeholders need real values before this ships:

- `velnora.com` domain references in `index.html`, `src/lib/seoConfig.ts`, `public/robots.txt`, and `public/sitemap.xml`
- `public/og-image.png` referenced by Open Graph/Twitter tags does not exist yet, add a real 1200x630 image
- The Contact form is frontend-only (see `src/lib/contact.ts`) and needs a real backend endpoint

## Deployment

This project deploys cleanly to [Vercel](https://vercel.com) or any static host as a Vite SPA build (`npm run build` outputs to `dist/`).

## License

Proprietary, all rights reserved.
