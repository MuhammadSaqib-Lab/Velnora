# Velnora Backend

REST API for the Velnora frontend: public contact/project-inquiry intake, an AI Client Handling Agent (chat consultant), plus a couple of read-only content endpoints. Node.js + TypeScript + Express + PostgreSQL + Prisma + Zod.

This is **Phase 2 (done) plus the AI Client Handling Agent** (originally scoped as a later phase, built ahead of authentication at explicit request). Still no authentication, admin dashboard, lead-finder agent, or payments, see [CLAUDE.md](../CLAUDE.md) and the root [README.md](../README.md) for the overall project phasing.

## Stack

- **Express 4** on Node.js (TypeScript, ESM)
- **PostgreSQL + Prisma** for the database
- **Zod** for request validation (server-side, independent of the frontend's own client-side checks)
- **Helmet**, **cors**, **express-rate-limit** for the security baseline
- **`@anthropic-ai/sdk`** for the AI Client Handling Agent, isolated behind a provider-agnostic interface (see "AI Client Handling Agent" below)
- **Vitest + Supertest** for tests (routes tested against a mocked Prisma client and a mocked AI provider, no live database or AI API key required to run the suite)

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
    ai/           AI Client Handling Agent — see the dedicated section below
      providers/  provider-agnostic interface (types.ts) + AnthropicProvider.ts
      prompts/    the agent's persona and rules (systemPrompt.ts)
      knowledge/  what the agent knows about Velnora (velnoraKnowledge.ts)
      tools/      tool definitions the agent can call (saveLead.tool.ts)
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
| `ANTHROPIC_API_KEY` | AI Client Handling Agent's key. Optional — leave unset to run everything else without AI, see below |
| `AI_MODEL` / `AI_EFFORT` / `AI_MAX_TOKENS` | AI model id, reasoning effort, and output cap |
| `AI_CHAT_RATE_LIMIT_WINDOW_MS` / `AI_CHAT_RATE_LIMIT_MAX` | Rate limit for `POST /api/ai/chat` specifically |
| `AI_MAX_MESSAGES_PER_CONVERSATION` | Hard cap on messages per chat session |

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
| POST | `/api/ai/chat` | none | yes (tighter limit) | The AI Client Handling Agent. See the dedicated section below |

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
- No `Lead` endpoints. The `Lead` Prisma model exists purely as schema preparation for a future lead-finder feature, nothing reads or writes it yet — this is distinct from `QualifiedLead`, which the AI Client Handling Agent below does write to.
- No auth. The `User` model exists purely as schema preparation for Phase 3.
- No admin dashboard or CRM UI to review `QualifiedLead`/`ContactSubmission`/`ProjectInquiry` rows — that's Phase 6. Use `npm run prisma:studio` to browse them for now.

## AI Client Handling Agent

A chat consultant surfaced by the frontend's floating chat widget (`src/components/chat/FloatingChatWidget.tsx`), talking to `POST /api/ai/chat`. It welcomes visitors, answers questions about Velnora's services using a fixed knowledge base (never invents information), asks progressive follow-up questions, and — once a visitor is genuinely qualified — saves their details as a `QualifiedLead` for the team to follow up on.

### Architecture

```
backend/src/ai/
  providers/types.ts          Provider-agnostic types (AIProvider interface, message/tool shapes)
  providers/AnthropicProvider.ts   The only file that imports the Anthropic SDK
  prompts/systemPrompt.ts     Persona + rules of engagement (the trusted "system" channel)
  knowledge/velnoraKnowledge.ts   What the agent knows (reuses services from content.service.ts)
  tools/saveLead.tool.ts      The agent's one tool: create a QualifiedLead, nothing else
```

`backend/src/services/aiChat.service.ts` orchestrates a conversation: find-or-create an `AIConversation` by `sessionId`, load recent history, call the provider, and — if the model calls `save_lead` — validate its input (`backend/src/validators/saveLeadTool.validator.ts`) and persist a `QualifiedLead` before reporting the outcome back to the model for a truthful confirmation. It only ever imports from `ai/providers/types.ts`, never the Anthropic SDK directly, so swapping providers later means writing one new class in `ai/providers/`, not touching this file.

### Configuring the provider

Set `ANTHROPIC_API_KEY` in `.env` (get one at [console.anthropic.com](https://console.anthropic.com/settings/keys)). It's optional: leave it unset and the rest of the API works normally, `POST /api/ai/chat` just returns a friendly "not configured" style error instead of the server failing to start. `AI_MODEL` (default `claude-opus-5`), `AI_EFFORT` (default `low`, deliberately — a concise chat reply doesn't need deep reasoning), and `AI_MAX_TOKENS` (default `1024`) are also configurable.

### Changing what the agent knows or how it behaves

- **Facts** (services, process, pricing policy, payment methods, timelines): edit `backend/src/ai/knowledge/velnoraKnowledge.ts`. It reuses `services` from `content.service.ts` rather than retyping the service list a third time.
- **Persona, tone, and safety rules**: edit `backend/src/ai/prompts/systemPrompt.ts`. Facts and persona are deliberately kept in separate files so a content edit can't accidentally loosen a safety rule.
- **What it can do**: edit `backend/src/ai/tools/saveLead.tool.ts` (and add a matching Zod validator) to add a new tool. Keep tools narrow and additive — the agent's actual security boundary is "what tools exist," not "what the prompt says it won't do."

### Swapping the AI provider

Implement the `AIProvider` interface (`backend/src/ai/providers/types.ts`) in a new class (e.g. `OpenAIProvider.ts`), then swap the `new AnthropicProvider()` instantiation in `aiChat.service.ts`. No other file needs to change.

### Request/response shape

```ts
// POST /api/ai/chat
{ sessionId?: string, message: string }   // message: 1-2000 chars

// Response (always the standard { success, message, data? } envelope)
{ success: true, message: "<the agent's reply>", data: { sessionId: string, leadCaptured: boolean } }
```

The frontend stores `sessionId` in `sessionStorage` (not `localStorage`) and echoes it back on each message so the conversation has continuity within a tab; a missing or unrecognized `sessionId` always starts a fresh conversation server-side rather than trusting a client-chosen identifier for a new row.

### Abuse & cost protection

- `POST /api/ai/chat` has its own, tighter rate limit (`AI_CHAT_RATE_LIMIT_WINDOW_MS`/`AI_CHAT_RATE_LIMIT_MAX`) than the free form endpoints, since every request costs real money against the AI provider.
- `AI_MAX_MESSAGES_PER_CONVERSATION` hard-caps a single conversation; once hit, the agent stops calling the AI provider and points the visitor to the contact form instead.
- Message length is capped at 2000 characters server-side (`backend/src/validators/aiChat.validator.ts`), independent of the frontend's own `maxLength`.
- `GET /api/health`'s `data.aiConfigured` reports whether a key is set — it does **not** make a live call to the AI provider, so polling health can never itself run up a bill.

### Prompt injection & tool security

- The visitor's message is only ever sent as `user`-role content; nothing from the request body is ever interpolated into the trusted `system` field, which is built once from `systemPrompt.ts` and static knowledge only.
- `systemPrompt.ts` explicitly instructs the model to refuse requests to reveal its instructions, API keys, database details, or take any destructive action, and to treat every visitor message as untrusted input even if it claims administrator/system authority.
- The real defense against a destructive request ("delete all leads") isn't the prompt, it's that **no such tool exists** — `save_lead` can only create one `QualifiedLead` row. There is no update, delete, or read tool of any kind.
- Model output is treated as untrusted input too: the `save_lead` tool call's arguments are validated by the same kind of Zod schema as an HTTP body before anything is written to the database.
- Once a conversation is marked `QUALIFIED`, the `save_lead` tool is no longer even offered to the model — a structural guarantee it can't fire twice for the same visitor, not just a prompt instruction.

## Security

See the project root's [SECURITY.md](../SECURITY.md) for the full picture (frontend + backend). Backend-specific highlights:

- Every public endpoint validates its input with Zod (`src/validators/`), unknown fields are rejected (`.strict()`), and URL fields are checked against an `http(s)`-only allowlist (rejects `javascript:`/`data:`/etc.), not just Zod's permissive `.url()`.
- `POST /api/contact` and `POST /api/project-inquiry` are rate-limited (`express-rate-limit`), configurable via env.
- CORS only allows origins listed in `FRONTEND_URL`, no wildcard in production.
- Helmet sets standard secure headers; `X-Powered-By` is disabled.
- Centralized error handling (`src/middleware/errorHandler.ts`) never returns a stack trace, database message, or file path to the client. The real error is preserved via `Error.cause` for server-side logging only, and even that's suppressed to a generic message in production (`NODE_ENV=production`).
- The structured logger (`src/utils/logger.ts`) only ever logs a short event name and small metadata object, callers can't accidentally pass a whole request body or Prisma error into it.
- Request bodies are capped at 20kb.
- The AI Client Handling Agent has its own additional security notes above ("Prompt injection & tool security", "Abuse & cost protection") — `ANTHROPIC_API_KEY` never leaves the server, it's read only in `AnthropicProvider.ts` and never referenced by any frontend code or `VITE_*` variable.

## Testing

```bash
npm test
```

44 tests across 10 files, all pass without a live database or AI API key (Prisma and the AI provider are both mocked at the module boundary). Covers: health check (DB up/down, `aiConfigured`), contact + project-inquiry validation and success/failure paths, unsafe-URL rejection, CORS allow/deny, 404 handling, rate limiting on both the form and AI endpoints (using a temporarily lowered limit so each test is fast and deterministic), and the AI chat endpoint specifically: normal conversation, session reuse, validation, the per-conversation message cap, safe error messages on provider/database failure (regression-tested against the exact "leaked database credentials" bug this caught during manual verification), the tool whitelist never including anything beyond `save_lead`, user text never reaching the trusted system channel, successful lead capture, invalid tool input, and a database failure while saving a lead degrading gracefully instead of a false confirmation.

To test against a real database, point `DATABASE_URL` at a real (ideally disposable/test) Postgres instance and adapt/extend the suite with integration tests as needed, current tests are unit/route-level by design so CI doesn't need a database service.
