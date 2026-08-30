# Security

## Authentication And Authorization

Clerk handles authentication. The app enforces authorization in server code:

- `src/lib/auth.ts` checks the primary Clerk email address against
  `ALLOWED_EMAIL_DOMAIN`.
- `src/app/page.tsx` serves read-only playlist content to unauthenticated users
  and identifies forbidden-domain users.
- `src/app/api/songs/route.ts` leaves `GET` public and protects `POST`.
- Read-only `GET` likes/comments routes are public. Like/comment mutations,
  bookmarks, notifications, and the engagement event stream use the same
  server-side auth gate.
- `GET /api/health` is intentionally public for orchestrators.

Keep Clerk dashboard restrictions aligned with `ALLOWED_EMAIL_DOMAIN`.

## Secrets

Required secrets and private values:

- `CLERK_SECRET_KEY`
- `POSTGRES_PASSWORD` or `DATABASE_URL`
- `GOOGLE_CHAT_WEBHOOK_URL`, when Google Chat reminders are enabled
- `REMINDER_CRON_SECRET`, when scheduled reminder endpoints are enabled

Local `.env` files are ignored by Git and Docker build context rules. Leave
`.env.example` as placeholders only.

CI treats values copied from local env files as secrets too. Configure
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` as GitHub Actions
secrets; do not hardcode Clerk keys in workflow YAML.

Rotate provider tokens when they are committed, copied into a shared channel,
attached to a ticket, or discovered in a build artifact. Rotation happens in
Clerk and the deployment host, not in code.

Google Chat webhook URLs are bearer credentials. Do not paste production
webhook URLs into source files, tickets, logs, or shared chat messages. If a
webhook URL is exposed, revoke or recreate it in Google Chat and update the
deployment environment variable.

Scheduled reminder endpoints use `Authorization: Bearer <REMINDER_CRON_SECRET>`
instead of Clerk, because cron calls are not user sessions. Use a long random
secret, keep it out of client-visible variables, and rotate it if scheduler
configuration is shared too broadly. Verification of this token is timing-safe
(via a SHA-256 hash comparison using `crypto.timingSafeEqual`) to prevent timing-based side-channel leaks.

## Input Validation

- Song submissions are validated with Zod before insertion.
- YouTube URLs are parsed with `URL` and accepted only for supported YouTube
  hosts and paths.
- Descriptions are trimmed and limited to 500 characters.
- Comment bodies are trimmed, limited to 500 characters, and checked for
  one-level reply structure.
- Comment creation is rate-limited to 5 comments per user per minute.
- Comment edits and deletes require comment ownership and reject cross-user
  mutations.
- DB constraints enforce source, month, year, and YouTube video ID validity for
  new writes.

## Transport And Headers

`next.config.ts` disables the powered-by header and adds baseline browser
headers:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Use HTTPS in production through the deployment host.

Reverse proxies should also preserve long-lived `text/event-stream` responses
for the authenticated engagement SSE route.

## Dependency And Container Checks

Run before releases:

```bash
npm audit --audit-level=high
npm run lint
npm run typecheck
npm run test
npm run build
```

Also run the deployment platform's container scanner against the built image.
