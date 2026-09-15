# Security

Velnora is now **Phase 2 (frontend + backend/database/API) plus the AI Client Handling Agent** (see [CLAUDE.md](CLAUDE.md)). This document covers the original frontend-only audit (still accurate except where an "as of the AI agent" note below says otherwise), the backend added in Phase 2, and a dedicated section on the AI agent's own attack surface (prompt injection, tool security, cost abuse). There is still no authentication, admin dashboard, or payments, see "Future backend security requirements" below for what's still missing before this handles real user data at scale.

**Frontend security cannot replace backend security.** The frontend section below reduces the frontend's own attack surface (XSS, unsafe links, dependency risk, information leakage). The backend section covers what now actually enforces validation, rate limiting, and safe error handling server-side, the frontend's own checks remain UX-only and are not a security boundary by themselves; a malicious client can always send raw HTTP requests directly to the API with `curl` or DevTools, bypassing the browser entirely. The AI agent section covers a third, distinct attack surface: an adversarial *conversation partner* rather than an adversarial *request*, see "AI Client Handling Agent security" below.

## Audit summary

A full-project audit was performed against: `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write`, unsafe URL schemes, `target="_blank"` usage, `localStorage`/`sessionStorage`/cookies, hardcoded secrets/API keys, `console.*` calls, `@ts-ignore`/`@ts-nocheck`/`any`, iframe usage, external script/resource hosts, `.env`/public asset exposure, and `npm audit`.

**Result at the time of this audit:** no XSS sinks, no hardcoded secrets, no `console.*` calls, no `any`/`@ts-ignore`, no iframes, no `localStorage`/`sessionStorage`/cookie usage, and `npm audit` reports 0 vulnerabilities across 189 resolved packages. The fixes below are hardening on top of an already clean baseline, not emergency patches. (One line item has since changed deliberately: the AI Client Handling Agent added a single, narrow `sessionStorage` use, see "Storage" below, everything else in this summary still holds.)

## What was found and fixed

| Area | Finding | Fix |
|---|---|---|
| Form validation | No max-length caps on any text field (name, email, message, company, phone, URLs, quick-chat message) | Added `MAX_LENGTHS` constants and matching `maxLength` HTML attributes + validation checks (`src/lib/validation.ts`) |
| URL validation | `repoLink` (Contact) and `url` (Free Audit) were checked with a loose regex (`/^https?:\/\//`) that doesn't reject malformed values as robustly as a real parser | Added `isSafeHttpUrl()` using the native `URL` constructor with an `http:`/`https:` protocol allowlist, explicitly rejecting `javascript:`, `data:`, `vbscript:`, and any other scheme |
| `.gitignore` | No explicit `.env*` patterns | Added `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production` (with `.env.example` explicitly un-ignored) |
| Secret hygiene | No `.env.example` existed | Added one; the project currently uses zero environment variables, so it documents the `VITE_*`-is-public convention for when one is needed, rather than inventing placeholder variables that don't exist |
| CSP / security headers | No headers configured anywhere | Added `vercel.json` with a full header set (see below), scoped to the resources this site actually loads |
| Structured data + CSP | Inline `<script type="application/ld+json">` in `index.html` would be blocked by a strict `script-src` without a hash or `unsafe-inline` | Computed and pinned the exact `sha256-` hash for that script in `vercel.json`; left a comment in `index.html` pointing back to this doc so it isn't silently invalidated by a future edit |

Everything else the audit checked (see the full command list at the bottom) came back clean and required no code change.

## XSS

- No `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval`, or `new Function(...)` anywhere in `src/`.
- All user-visible text (names, messages, form values, the JSON-LD structured data, and — as of the AI Client Handling Agent — both the visitor's own chat messages and the AI's replies in `FloatingChatWidget.tsx`) is rendered through JSX, which auto-escapes. Nothing renders raw HTML from user input, a URL parameter, an AI response, or anywhere else.
- If a genuine HTML-rendering need ever appears (e.g. rich text from a future CMS), sanitize with [DOMPurify](https://github.com/cure53/DOMPurify) before rendering, don't add it speculatively now, it isn't needed by anything in this codebase today.

## URL and link safety

- No `target="_blank"` links exist anywhere in the app today, so there is currently no `rel="noopener noreferrer"` gap. **If an external-tab link is added later, it must include `rel="noopener noreferrer"`.**
- No `window.open`, no dynamic redirects, no route or query parameters are used to construct a URL that the app then navigates to. `FloatingChatWidget.tsx`'s "Jump to Contact" control is a plain `<a href="#contact">`, a hardcoded literal, never anything derived from user or URL input or from the AI's own reply text.
- User-entered URLs (Contact's optional repo link, Free Audit's website URL) are validated with `isSafeHttpUrl()` (`src/lib/validation.ts`), which parses with the native `URL` constructor and only accepts `http:`/`https:`. These values are currently only ever displayed as plain text, never used as an `href`, `src`, or navigation target, so there is no live open-redirect or `javascript:`-URL execution path even before this validation existed, but the check is in place for when a backend starts using these values.

## Forms

Two forms exist: Contact and Free Audit. **Contact** (`src/sections/Contact.tsx`) submits for real, via `apiPost` (`src/lib/api.ts`) to the backend's `POST /api/project-inquiry`, and is independently re-validated server-side (see "Backend / API security" below). **Free Audit remains a frontend-only stub** (`src/lib/audit.ts`), it simulates a network delay and resolves successfully; nothing is sent anywhere yet, this is intentional scope, not an oversight. The floating chat widget is a separate, third submission surface, covered in its own "AI Client Handling Agent security" section below rather than here, its input isn't a traditional form field with a fixed schema, it's free text sent to an AI provider.

Client-side validation covers, per field: required-ness, format (email regex, URL parsing), and a maximum length (`src/lib/validation.ts`). This remains UX validation, not a security boundary by itself, **any client-side check can still be bypassed by calling the API directly**, which is exactly why Contact's submissions are now also validated server-side. See "Backend / API security" for what's enforced there today, and "Future backend security requirements" below for what's still missing (auth, CSRF, etc.).

- No form data is logged to the console (verified, no `console.*` calls anywhere).
- No form data is written to `localStorage`/`sessionStorage`/cookies.
- File uploads (Contact's project handover) are staged in memory only (a `File[]` in React state, never sent anywhere yet) and are checked client-side by extension and size (`ACCEPTED_HANDOVER_EXTENSIONS`, `MAX_HANDOVER_FILE_SIZE_BYTES` in `src/lib/contact.ts`). **Extension-based checks are spoofable** (a file can be renamed to `.zip`), a real upload endpoint must validate file content/magic bytes and size server-side, not trust the filename.

## Storage

No `localStorage` or `document.cookie` usage exists anywhere in the codebase. **`sessionStorage` has one deliberate use as of the AI Client Handling Agent:** `FloatingChatWidget.tsx` stores a single key, a server-minted random UUID identifying the chat session, so a conversation has continuity across messages within one tab. Nothing else is stored, it's cleared when the tab closes (unlike `localStorage`, which would persist it), and the value itself is meaningless without the backend's own `AIConversation` row, it's a lookup key, not a credential or any visitor-identifying data. Access is wrapped in try/catch (`readStoredSessionId`/`storeSessionId`) so the widget still works if the browser blocks storage (private windows, strict cookie/storage settings). If authentication is added in a later phase, it must use a secure, server-managed session mechanism (e.g. `httpOnly`, `Secure`, `SameSite=Lax/Strict` cookies issued by the backend), not tokens stored in `localStorage`/`sessionStorage`.

## Third-party resources

Everything the production build actually loads was enumerated directly from the built bundle, not guessed:

- **Fonts:** self-hosted via `@fontsource/geist-sans` / `@fontsource/geist-mono`, bundled at build time. No Google Fonts `<link>`, no external font host.
- **Images:** `https://cdn.simpleicons.org` (real technology logos) and `https://picsum.photos` (placeholder imagery for concept portfolio pieces). Both HTTPS, both read-only image GETs, no scripts.
- **Scripts:** none. There is exactly one `<script type="module">` (the app's own bundle) and one inline `<script type="application/ld+json">` (static structured data). No analytics, no tag managers, no ads, no chat widgets from third parties, no CDNs for JS libraries, everything is bundled.
- No iframes exist anywhere in the app. None should be added without a clear need, and if one ever is, it must use `sandbox`, restrict `allow`/permissions, and only point at a trusted HTTPS origin.

## Dependencies

- `npm audit`: **0 vulnerabilities** (117 prod, 23 dev, 69 optional, 189 total).
- No dependency was upgraded as part of this audit, there was nothing to fix. Re-run `npm audit` periodically and after adding any new package; only apply major-version upgrades deliberately, after checking changelogs and testing the build.

## TypeScript / React

- No `any`, `@ts-ignore`, or `@ts-nocheck` anywhere in `src/`.
- `noUnusedLocals` / `noUnusedParameters` are enabled in `tsconfig.app.json`.
- No unsafe `dangerouslySetInnerHTML`, no unvalidated state flowing into DOM APIs.

## Content Security Policy

A CSP is only meaningful as a **real HTTP response header** (a `<meta http-equiv>` tag cannot enforce `frame-ancestors`, and this project deliberately does not ship a `<meta>` CSP alongside the header version, running both at once risks the two policies silently conflicting). Headers require a hosting layer; a static Vite build has none of its own. [`vercel.json`](vercel.json) configures the following for **Vercel deployments** (verify the same policy is applied at whatever host is actually used):

```
default-src 'self';
script-src 'self' 'sha256-AMF9NWirfteRBbBSJP8/7HbFqu7GbL51JVCdkQkyBN0=';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://cdn.simpleicons.org https://picsum.photos;
font-src 'self';
connect-src 'self' https://api.velnora.com;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

Notes on the choices that aren't obvious:

- **`script-src` uses a hash, not `'unsafe-inline'`.** The one inline script is the static JSON-LD block in `index.html` (as of Phase 2, an `@graph` of `ProfessionalService`/`WebSite`/`Service` entries, still 100% static and developer-controlled, no fake reviews or ratings). If you edit that JSON, regenerate the hash and update `vercel.json`:
  ```bash
  node -e "const fs=require('fs');const c=require('crypto');const m=fs.readFileSync('index.html','utf8').match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/);console.log('sha256-'+c.createHash('sha256').update(m[1],'utf8').digest('base64'))"
  ```
  If you forget, the structured data silently stops rendering in browsers that enforce the CSP, it fails closed, not open, so this is a correctness bug to catch in review, not a security hole.
- **`style-src` needs `'unsafe-inline'`.** Two components (`BrandMark.tsx`'s spinning ring, `SceneFallback.tsx`'s computed badge positions) use React's `style={{...}}` with runtime-computed values. These can't be hashed (the values differ per render) and can't use a nonce on a static site (nonces require per-request server generation). This is a low-risk accommodation: neither style is ever derived from user input, both are computed from hardcoded constants or a fixed data array, so there is no injection path an attacker could use even with `'unsafe-inline'` in play.
- **`connect-src` now also allows `https://api.velnora.com`.** As of Phase 2 the frontend calls a separately-hosted backend API (`src/lib/api.ts`, via `VITE_API_URL`), a bare `connect-src 'self'` would silently block every `fetch()` to that origin once deployed (the browser's CSP layer, not the app, would drop the request). `https://api.velnora.com` is a **placeholder** consistent with this project's placeholder domain convention, replace it with the real production backend origin before going live, and keep it as an exact origin, never a wildcard.
- **`frame-ancestors 'none'`** blocks this site from being embedded in an iframe anywhere, full clickjacking protection. `X-Frame-Options: DENY` is included alongside it for older browsers that don't read `frame-ancestors`.
- **`upgrade-insecure-requests`** is a safety net; every resource this site loads is already HTTPS (verified against the built bundle, see Third-party resources above).

## Other security headers (`vercel.json`)

| Header | Value | Why |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Stops browsers from MIME-sniffing responses into an executable type |
| `X-Frame-Options` | `DENY` | Clickjacking protection for browsers predating `frame-ancestors` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Avoids leaking full URLs (including any future query params) to third-party origins |
| `Permissions-Policy` | camera/microphone/geolocation/payment/usb/interest-cohort/browsing-topics all denied | None of these APIs are used; deny by default |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Vercel serves all deployments over HTTPS by default, so this is safe there. **If this project is ever deployed to a different host, confirm HTTPS is correctly configured before enabling HSTS**, an incorrect HSTS header on a host that sometimes serves plain HTTP can lock users out of the site for the `max-age` duration. |

`X-XSS-Protection` is intentionally **not** set: it's a deprecated legacy header, modern browsers ignore it, and it has historically introduced its own vulnerabilities in older IE when misconfigured. Current best practice is to rely on CSP instead.

If this project deploys to a host other than Vercel, translate the same header set into that platform's config (Netlify `_headers` file, Cloudflare Pages `_headers`, Nginx `add_header` directives, etc.), `vercel.json`'s `headers` block only takes effect on Vercel.

## Clickjacking

Covered by `frame-ancestors 'none'` and `X-Frame-Options: DENY` above. This site has no legitimate embedding use case, so the strictest setting was used. If a future requirement needs this site embedded by a specific trusted partner domain, change `frame-ancestors` to name that origin explicitly, never `*`.

## Mixed content / HTTPS

Every resource URL in the codebase and in the built JS bundle was checked. The only non-HTTPS string is the SVG XML namespace (`http://www.w3.org/2000/svg`), which is an identifier, not a network request, and must be exactly that string per spec. There are no other `http://` resource references.

## SEO (unaffected)

None of the above changes touch page titles, meta descriptions, canonical URLs, `robots.txt`, `sitemap.xml`, Open Graph/Twitter metadata, semantic heading structure, or image `alt` text. The CSP was specifically shaped around the resources this site's SEO/structured-data setup actually needs (`img-src` covers the real logo/portfolio images; the JSON-LD script is allowlisted by hash rather than removed).

## Information leakage

- No `console.log`/`console.error`/`console.warn`/`console.debug` calls anywhere in `src/` (verified by full-project search).
- No stack traces, internal file paths, or debug output are ever rendered to the page.
- Error states shown to users (form validation errors, the chat widget's fallback copy) are plain, user-facing text with no internal detail.

## Public assets

`public/` contains exactly three files: `favicon.svg`, `robots.txt`, `sitemap.xml`. No `.env` files, credentials, private keys, backups, or debug files are present anywhere in the repo (verified by search).

## Git

- `git status` is clean of untracked secret-shaped files; `npm audit` and the codebase search found nothing to remove.
- **If a real secret is ever accidentally committed in the future:** removing it from the current working tree or a new commit is not sufficient, it remains in git history and can be recovered by anyone with repo access (including anyone who already cloned it). The correct process is: rotate/revoke the credential at its source immediately, then separately deal with purging history (e.g. `git filter-repo`) if the repo is or was public. This document does not perform credential rotation, that must be done by whoever owns the exposed credential.

## Backend / API security (Phase 2)

The backend (`backend/`, see [backend/README.md](backend/README.md)) is a separate Express + PostgreSQL + Prisma service. It is what now actually enforces the checks the frontend can only suggest.

- **Server-side validation, not just client-side.** Every public POST body (`/api/contact`, `/api/project-inquiry`) is validated by a Zod schema (`backend/src/validators/`) before a controller ever sees it, independent of and stricter than the frontend's own `src/lib/validation.ts` checks. Schemas use `.strict()`, so unknown fields are rejected outright rather than silently dropped or persisted. URL fields (`repoLink`) are checked with the same `isSafeHttpUrl()`-style `http(s)`-only allowlist approach as the frontend (reimplemented server-side in `backend/src/validators/shared.ts`, since backend code never imports frontend code), not Zod's permissive built-in `.url()`, which would accept `javascript:`/`data:`/etc.
- **Rate limiting.** `POST /api/contact` and `POST /api/project-inquiry` are rate-limited via `express-rate-limit` (`backend/src/middleware/rateLimiter.ts`), window and max request count configurable via `CONTACT_RATE_LIMIT_WINDOW_MS`/`CONTACT_RATE_LIMIT_MAX` env vars so limits can be tuned per environment without a code change.
- **CORS allowlist.** The API only responds to origins listed in `FRONTEND_URL` (comma-separated, `backend/src/config/env.ts`); there is no wildcard `*` origin, and a disallowed origin gets a clean `403 {"success": false, ...}` JSON response rather than a raw CORS error or a silently-missing header.
- **Helmet + baseline headers.** `helmet()` sets standard secure headers on every response; `X-Powered-By` is explicitly disabled (`app.disable('x-powered-by')`) so the framework/version isn't advertised.
- **No leaked error detail.** The centralized error handler (`backend/src/middleware/errorHandler.ts`) never returns a stack trace, raw database error, or file path in an API response, expected failures (validation, not-found, rate limit) return a safe typed message, and unexpected failures return a generic message in production. The real underlying error is preserved via the native `Error.cause` chain so it can still be logged server-side for debugging, this is deliberately a logging-only channel, it never reaches the HTTP response. One honest caveat: Prisma's own driver-level console logging (`log: ['error']` in `backend/src/database/prisma.ts`) can surface the database *username* in a connection-failure message during local development, never the password, and this is server-side console output only, not something returned to a client; a hardened production setup should still route that log through a log aggregator with access controls rather than a raw console, that's listed under "Future backend security requirements" below.
- **Safe structured logging.** `backend/src/utils/logger.ts` only accepts a short event-name string and a small metadata object, there's no code path that lets a caller accidentally log an entire request body or a raw `Error` object, which is what would otherwise risk writing PII (names, emails, message contents) into logs.
- **Request size limits.** JSON bodies are capped at 20kb (`express.json({ limit: '20kb' })`), well above any legitimate form submission but enough to blunt trivial large-payload abuse before it reaches validation.
- **Dependency hygiene.** `npm audit` on the backend is clean (0 vulnerabilities); two transitive vulnerabilities found during setup (`qs` via `express`'s `body-parser`, `deepmerge-ts` via Prisma's config loader) were fixed with a `package.json` `overrides` block pinning both to patched versions, rather than force-upgrading the direct dependencies that pull them in.
- **Database access.** All queries go through Prisma's generated client (parameterized under the hood), there is no raw string-concatenated SQL anywhere in the backend, so standard SQL injection is not a live risk today. The `DATABASE_URL` connection string and all other secrets live only in `backend/.env` (gitignored, confirmed via `git check-ignore`) and are never exposed to the frontend or committed to source control.

None of this is authentication, there is still no login, no session, and no concept of a logged-in user anywhere in the system, every endpoint above is intentionally public. See "Future backend security requirements" for what closes that gap in a later phase.

## AI Client Handling Agent security

`POST /api/ai/chat` (`backend/src/services/aiChat.service.ts`, `backend/src/ai/`) is a different kind of attack surface from the rest of this API: the adversarial input isn't a malformed request, it's a visitor actively trying to manipulate the model in free-text conversation ("ignore your instructions", "show me your system prompt", "give me the API key", "act as administrator", "delete all leads"). The defenses below are layered so that even a successful manipulation of the model's *behavior* can't translate into a real security consequence.

- **The model has no destructive capability, regardless of what it's told.** `save_lead` (`backend/src/ai/tools/saveLead.tool.ts`) is the agent's only tool, and it can only create one `QualifiedLead` row. There is no update, delete, read, or any other tool. "Delete all leads" fails not because the prompt says to refuse it (though it does), but because no code path exists that could do it even if the model tried — this is the actual security boundary, the prompt instruction is a second layer, not the only one.
- **User input never reaches the trusted instruction channel.** The system prompt (`backend/src/ai/prompts/systemPrompt.ts`) is built once, from static persona text and the static knowledge base, before any request arrives. Every visitor message is sent as `user`-role content only (`aiChat.service.ts`), structurally distinct from the `system` field — there is no string concatenation anywhere that could let visitor text masquerade as an operator instruction. Regression-tested in `backend/tests/aiChat.test.ts`.
- **The system prompt explicitly instructs refusal** of requests to reveal its instructions, secrets, credentials, or backend details, or to take any destructive action, regardless of framing (claimed admin/developer/tester authority, "ignore previous instructions", roleplay, translation, etc.) — this is the belt to the tool-scoping suspenders above, not a substitute for it.
- **Model output is untrusted input, validated the same way an HTTP body is.** The `save_lead` tool call's arguments are parsed by a Zod schema (`backend/src/validators/saveLeadTool.validator.ts`, reusing the same field rules as the contact/project-inquiry validators) before anything reaches the database. A model that hallucinates or is coaxed into malformed tool input gets a validation failure, not a database write.
- **No fabricated data reaches storage.** The system prompt instructs the model to only call `save_lead` with information the visitor actually provided, and to never guess a field — but this is a prompt-level instruction, not independently enforced server-side (the backend can't know what was "actually said" versus invented), so treat `QualifiedLead` rows as visitor-asserted, not independently verified, the same trust level as any other public form submission.
- **A lead can only be captured once per conversation.** Once an `AIConversation` is marked `QUALIFIED`, `save_lead` is no longer offered to the model at all (`aiChat.service.ts`) — a structural guarantee, not a "please don't call this twice" instruction.
- **No stack traces, database errors, or provider errors ever reach the client.** Both the AI provider call and every database operation in the chat flow are wrapped so failures return one of a small set of pre-written, safe messages (see `PROVIDER_UNAVAILABLE_MESSAGE`/`DB_UNAVAILABLE_MESSAGE` in `aiChat.service.ts`); this was tightened after manual testing caught a gap where a database connection failure during conversation setup fell through to the generic error handler's dev-mode detail output (now regression-tested).
- **Cost and abuse limits, since every message is a billable AI request** (unlike a free database write): `POST /api/ai/chat` has its own tighter rate limit (`AI_CHAT_RATE_LIMIT_WINDOW_MS`/`AI_CHAT_RATE_LIMIT_MAX`, default 10/minute per IP) than the contact/project-inquiry forms; a hard per-conversation message cap (`AI_MAX_MESSAGES_PER_CONVERSATION`, default 40) stops the AI provider from being called at all once hit; messages are capped at 2000 characters server-side regardless of what the frontend sends; and `GET /api/health`'s `aiConfigured` field never makes a live (billable) call to the AI provider.
- **The API key never leaves the server.** `ANTHROPIC_API_KEY` is read only in `backend/src/ai/providers/AnthropicProvider.ts`, is optional (the app runs fine without it, `POST /api/ai/chat` just degrades to a friendly error), and has no `VITE_*` equivalent — there is no code path that could put it in a frontend bundle.
- **Known, accepted limitation:** conversation transcripts (`AIMessage` rows) are stored in plaintext in the database with no separate encryption-at-rest beyond whatever the hosting Postgres instance provides, and there is no automated data-retention/deletion policy yet (visitor conversations persist indefinitely). This is the same posture as `ContactSubmission`/`ProjectInquiry` today, tracked as a shared future improvement, not treated as more urgent just because an AI is involved.

## Known limitations (Phase 2: frontend + backend, no auth yet)

- There is still no authentication, no sessions, no CSRF protection, and no admin/user role separation anywhere in the system, every existing API endpoint is intentionally public (see `backend/README.md`'s "What's deliberately NOT built here"). The `User` Prisma model exists only as schema preparation for Phase 3, no route reads or writes it yet.
- Client-side validation, file-type/size checks, and URL parsing remain UX conveniences on the frontend. They are no longer the only line of defense (the backend now independently re-validates everything), but they still don't guarantee anything on their own, always assume a request can bypass the browser entirely.
- File uploads (`FileHandover.tsx`) are still staged client-side only, there is no upload endpoint; when one is built it must validate file content by inspecting bytes, not the filename or extension, and enforce size limits server-side.
- The CSP and headers in `vercel.json` only cover the frontend's static deployment. The backend, deployed separately, needs its own equivalent security headers reviewed at deployment time (Phase 7).
- `frame-ancestors` and other frontend headers cannot be verified from a static Vite dev server, they must be checked against the real deployed response headers (e.g. via browser DevTools' Network tab or `curl -I`) after deployment.
- The backend currently runs against a local development database with placeholder credentials; production deployment needs a real, least-privilege database user and a strong unique password (see `backend/README.md`'s Database setup section), never reuse the local dev password.
- The AI Client Handling Agent has its own limitations documented in "AI Client Handling Agent security" above — most notably no automated retention/deletion policy for stored conversation transcripts yet, and lead data is visitor-asserted, not independently verified.

## Future backend security requirements (do not implement yet)

Now that the backend exists, some of this list has shrunk, ~~server-side validation and sanitization~~ and ~~rate limiting~~ are implemented (see "Backend / API security" above). Still needed, in a later phase:

- Authentication and authorization (including admin role separation, if an admin dashboard is added). The `User` Prisma model is already prepared for this (Phase 3).
- Password hashing with a modern algorithm (e.g. argon2id/bcrypt), never plaintext or reversible encryption.
- Secure server-managed sessions (`httpOnly`, `Secure`, `SameSite` cookies) rather than client-stored tokens.
- CSRF protection on any state-changing endpoint reachable from an authenticated browser session (today's two public POST endpoints don't carry session/cookie auth, so classic CSRF doesn't apply to them yet, this becomes necessary once sessions exist).
- API authentication for any endpoint not meant to be fully public (e.g. future admin-only routes over `ContactSubmission`/`ProjectInquiry`/`Lead`).
- Database access controls beyond parameterized queries: a least-privilege production DB user (separate from a migration/admin user), connection-level TLS in production, and periodic credential rotation.
- Server-side secret management appropriate for the deployment target (a proper secrets manager or platform-injected environment variables), the current `.env` file approach is fine for local development but should not be how production secrets are managed long-term.
- File upload handling that validates content type by inspecting bytes, not filenames, enforces size limits server-side, and stores uploads outside of any web-executable path, once a real upload endpoint is built.
- Audit logging for sensitive actions once there are any (admin actions, data exports, auth events).
- Routing the structured logger's output to a proper log aggregation/monitoring service with access controls, rather than plain stdout/console (Phase 7).
- A data-retention/deletion policy for stored AI conversation transcripts (`AIMessage`) and captured leads (`QualifiedLead`), and independent verification of AI-captured lead data before it's treated as trusted (both noted in "AI Client Handling Agent security" above).

## Reporting a security issue

This is a Phase 2 project (frontend + backend, no auth yet) without a public bug bounty program. If you find a security issue, contact the project owner directly at `muhammadsaqib9117994@gmail.com` rather than filing a public issue, especially given the backend is still pre-authentication and any report could reference infrastructure that isn't fully hardened yet.

## Commands used for this audit

```bash
npm audit
npm run lint
npm run build   # includes tsc -b, the TypeScript check
```

Plus full-project text searches (not reproduced here) for: `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval(`, `document.write`, `console.*`, `localStorage`/`sessionStorage`/`cookie`, `@ts-ignore`/`@ts-nocheck`/`any`, `target="_blank"`, `iframe`, `window.open`/`window.location`, `javascript:`/`data:`/`vbscript:`, API-key/secret/token-shaped strings, and `http://` resource references, cross-checked against the actual built JS bundle's external references.

---

**Frontend hardening, a backend security foundation, and a scoped AI agent security model are all in place.** This is not a claim that the system is "100% secure", no audit can make that claim, especially before authentication exists, and an AI agent's behavior can't be exhaustively proven safe the way a fixed API contract can. It reflects a deliberate defense-in-depth design: server-side validation, rate limiting, a CORS allowlist, and safe error handling on the REST API; a narrow, additive-only tool surface and a structurally-isolated instruction channel on the AI agent, so that even a successful prompt manipulation has no destructive capability to exploit. Remaining gaps (auth, CSRF, sessions, admin protection, AI conversation data retention) are explicitly tracked above rather than glossed over.
