# Velnora Backend

REST API for the Velnora frontend: public contact/project-inquiry intake, plus a couple of read-only content endpoints. Node.js + TypeScript + Express + PostgreSQL + Prisma + Zod.

This is **Phase 2**. No authentication, admin dashboard, AI agents, or payments yet, see [CLAUDE.md](../CLAUDE.md) and the root [README.md](../README.md) for the overall project phasing.

## Stack

- **Express 4** on Node.js (TypeScript, ESM)
- **PostgreSQL + Prisma** for the database
- **Zod** for request validation (server-side, independent of the frontend's own client-side checks)
- **Helmet**, **cors**, **express-rate-limit** for the security baseline
- **Vitest + Supertest** for tests (routes tested against a mocked Prisma client, no live database required to run the suite)

## Architecture

```
backend/
  src/
    config/       env loading + validation (Zod), CORS origin list
    controllers/  thin HTTP handlers, no business logic
    routes/       Express routers, wire middleware -> controller
    services/     business logic + Prisma calls
    middleware/   validateBody, rateLimiter, errorHandler
    validators/   Zod schemas (shared field rules + per-endpoint schemas)
    database/     Prisma client singleton
    utils/        AppError, asyncHandler, logger
    types/        shared API response types
    app.ts        Express app construction (no listening)
    server.ts     starts the HTTP server, graceful shutdown
  prisma/
    schema.prisma
    seed/seed.ts
  tests/
```

Controllers stay thin (parse `req`, call a service, shape the response). Business logic and Prisma access live in `services/`. Every public POST body is validated by a Zod schema in `validators/` before a controller ever sees it.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then fill in real values
npm run prisma:generate
npm run prisma:migrate    # creates tables in your database
npm run prisma:seed       # optional: sample (non-real) data for local dev
npm run dev                # starts on http://localhost:4000
```

### Database

You need a running PostgreSQL instance and a database/user for this app. Example (run as a Postgres superuser):

```sql
CREATE USER velnora_app WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE velnora OWNER velnora_app;
```

Then set `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://velnora_app:choose-a-strong-password@localhost:5432/velnora?schema=public"
```

## Environment variables

See [.env.example](.env.example) for the full list with descriptions. Never commit `.env`, it's covered by the repo's root `.gitignore`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string |
| `PORT` | API listen port (default 4000) |
| `NODE_ENV` | `development` / `test` / `production` |
| `FRONTEND_URL` | Comma-separated list of allowed CORS origins |
| `JWT_SECRET` | Reserved for Phase 3 auth, not read by any code yet |
| `CONTACT_RATE_LIMIT_WINDOW_MS` / `CONTACT_RATE_LIMIT_MAX` | Rate limit for the two public form endpoints |

## Commands

```bash
npm run dev             # dev server with auto-reload (tsx watch)
npm run build            # type-check + compile to dist/
npm run start             # run the compiled build (dist/server.js)
npm run lint              # oxlint (same linter as the frontend, see CLAUDE.md)
npm test                  # run the test suite once
npm run test:watch        # watch mode
npm run prisma:generate   # regenerate the Prisma client after a schema change
npm run prisma:migrate    # create + apply a new migration (dev)
npm run prisma:deploy     # apply existing migrations (production/CI)
npm run prisma:seed       # run prisma/seed/seed.ts
npm run prisma:studio     # open Prisma's DB browser UI
```

## API

All responses are JSON in the shape:

```json
{ "success": true, "message": "...", "data": "...optional..." }
{ "success": false, "message": "...", "errors": { "field": "reason" } }
```

| Method | Path | Auth | Rate limited | Notes |
|---|---|---|---|---|
| GET | `/api/health` | none | no | `data.databaseConnected` reflects a live `SELECT 1`; returns 503 if the DB is unreachable |
| POST | `/api/contact` | none | yes | General contact intake. No frontend form posts here yet, see below |
| POST | `/api/project-inquiry` | none | yes | The site's main "Start a Project" form (`src/sections/Contact.tsx`) posts here |
| GET | `/api/services` | none | no | Static list mirroring `src/data/services.ts` |
| GET | `/api/projects` | none | no | Static list mirroring `src/data/projects.ts` |

### Why two nearly-identical endpoints?

`ContactSubmission` and `ProjectInquiry` are separate tables with the same shape by design. The current frontend's one detailed form (name/email/company/phone/projectType/budgetRange/message/repoLink) is wired to `POST /api/project-inquiry`, since it originates from "Start a Project" CTAs across the site. `POST /api/contact` is fully implemented and tested but not yet wired to a frontend form, it's there for a simpler future contact touchpoint without needing a new table or endpoint later.

### Request bodies

```ts
// POST /api/contact and /api/project-inquiry share these fields:
{
  name: string          // required, 1-100 chars
  email: string         // required, valid email, max 254 chars
  company?: string       // max 150 chars
  phone?: string          // max 30 chars, digits/spaces/+()-. only
  projectType?: 'new-website' | 'redesign' | 'ai-solution' | 'seo' | 'other'
  budgetRange?: 'under-500' | '500-1k' | '1k-2.5k' | '2.5k-plus' | 'not-sure'
  message: string        // required, 10-2000 chars
  repoLink?: string       // project-inquiry only, must be http(s), max 500 chars
}
```

`projectType`/`budgetRange` values must exactly match the frontend's `<select>` options (`src/sections/Contact.tsx`) and the shared constants in `src/validators/shared.ts`, if the frontend's options ever change, update both.

### What's deliberately NOT built here

- No file upload endpoint. `FileHandover.tsx` on the frontend stages files client-side only; a real upload flow (presigned URLs or multipart, with content-based type validation) is a future phase.
- No `Lead` endpoints. The `Lead` Prisma model exists purely as schema preparation for a future lead-finder feature, nothing reads or writes it yet.
- No auth. The `User` model exists purely as schema preparation for Phase 3.

## Security

See the project root's [SECURITY.md](../SECURITY.md) for the full picture (frontend + backend). Backend-specific highlights:

- Every public endpoint validates its input with Zod (`src/validators/`), unknown fields are rejected (`.strict()`), and URL fields are checked against an `http(s)`-only allowlist (rejects `javascript:`/`data:`/etc.), not just Zod's permissive `.url()`.
- `POST /api/contact` and `POST /api/project-inquiry` are rate-limited (`express-rate-limit`), configurable via env.
- CORS only allows origins listed in `FRONTEND_URL`, no wildcard in production.
- Helmet sets standard secure headers; `X-Powered-By` is disabled.
- Centralized error handling (`src/middleware/errorHandler.ts`) never returns a stack trace, database message, or file path to the client. The real error is preserved via `Error.cause` for server-side logging only, and even that's suppressed to a generic message in production (`NODE_ENV=production`).
- The structured logger (`src/utils/logger.ts`) only ever logs a short event name and small metadata object, callers can't accidentally pass a whole request body or Prisma error into it.
- Request bodies are capped at 20kb.

## Testing

```bash
npm test
```

29 tests across 7 files, all pass without a live database (Prisma is mocked at the module boundary). Covers: health check (DB up/down), contact + project-inquiry validation and success/failure paths, unsafe-URL rejection, CORS allow/deny, 404 handling, and rate limiting (using a temporarily lowered limit so the test is fast and deterministic).

To test against a real database, point `DATABASE_URL` at a real (ideally disposable/test) Postgres instance and adapt/extend the suite with integration tests as needed, current tests are unit/route-level by design so CI doesn't need a database service.
