# Deployment Guide

The app can run as a two-service Docker Compose stack or as an app container
connected to managed Postgres. The app image uses Node 22 on Alpine and Next.js
standalone output.

## Local Or Self-Hosted Compose

```bash
cp .env.example .env
# Edit .env - set Clerk keys and POSTGRES_PASSWORD at minimum.
docker compose up -d --build
```

The app is served at http://localhost:3000. Postgres is reachable inside the
compose network at `db:5432` and is not published to the host by default.

To reset local state and wipe the DB volume:

```bash
docker compose down -v
```

## Required Environment Variables

See [../.env.example](../.env.example) for the full list.

- **Clerk:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is inlined into the client bundle at
  build time, so set it as both a build-time and runtime variable.
- **Postgres:** compose uses `POSTGRES_DB`, `POSTGRES_USER`, and
  `POSTGRES_PASSWORD` to build `DATABASE_URL`. Managed deployments can set
  `DATABASE_URL` directly.
- **Domain allowlist:** `ALLOWED_EMAIL_DOMAIN` defaults to `favoritemedium.com`.
  Keep it aligned with Clerk's own sign-in restrictions.
- **Google Chat reminders:** `SERVICE_URL_APP`, `GOOGLE_CHAT_WEBHOOK_URL`, and
  `REMINDER_CRON_SECRET` are required only when scheduled reminders are enabled.
  `REMINDER_TIME_ZONE` defaults to `Asia/Singapore`.

## Engagement Realtime

Likes and comments use Server-Sent Events at `GET /api/engagement/events`.
The app keeps one Postgres `LISTEN` connection per Node.js process and fans out
events in-process to connected browsers. Mutating like/comment routes publish
compact `NOTIFY` payloads through Postgres; no Redis, queue, WebSocket server,
or sticky session setup is required for the current deployment model.

The stream currently emits two event types:

- `song_engagement_updated` for like/comment count changes on a song.
- `song_comment_notification` for new comments, filtered so only the song
  submitter receives the notification event.

Operational notes:

- SSE connections are authenticated with the same Clerk/domain checks as the
  rest of the playlist app.
- Load balancers or reverse proxies should allow long-lived HTTP responses and
  avoid buffering `text/event-stream` responses.
- Each running app process opens one extra Postgres connection for engagement
  events after the first browser subscribes.
- In-app submitter notifications are delivered over SSE only. There is no email
  or push notification provider in v1.
- If the app later moves to a heavily serverless runtime, reassess this design;
  Postgres `LISTEN` works best in long-lived Node.js processes.

## Google Chat Reminders

Reminder jobs are HTTP endpoints protected by `REMINDER_CRON_SECRET`. Configure
an external scheduler in Singapore time:

| Job | Schedule | Endpoint |
|---|---|---|
| Monday song prompt | `0 9 * * 1` | `POST /api/reminders/monday` |
| Friday submitter thanks | `0 17 * * 5` | `POST /api/reminders/friday` |

Each request must include:

```text
Authorization: Bearer <REMINDER_CRON_SECRET>
```

The routes also accept `GET` for schedulers that cannot send `POST` requests,
but `POST` is preferred. Friday messages thank everyone with songs whose
`submitted_date` falls in the last seven local dates including Friday. If no
one submitted, the app sends a gentle nudge instead.

Reminder sends are recorded in the `reminder_runs` table with an idempotency
key, so retries for the same job/window do not send duplicate Space messages.

## Coolify Or Managed Hosts

### Option A: Docker Compose

1. Create a Docker Compose resource pointed at this repo.
2. Set variables from `.env.example` in the host UI.
3. Assign a domain to the `app` service and enable TLS.

### Option B: App Container Plus Managed Postgres

1. Create a managed Postgres resource and copy its connection string.
2. Create a Docker build resource using the root `Dockerfile`.
3. Set `DATABASE_URL` and Clerk keys.
4. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as a build variable too.
5. Set `SERVICE_URL_APP` to the public app URL. In Coolify this value is often
  already available as the app service URL.
6. Assign a domain and deploy.

`ensureSchema()` creates or updates the app tables on first access.

## Clerk Production Setup

- Add `https://<your-domain>` as an allowed production domain.
- Enable Google sign-in for the production instance.
- Restrict sign-ups/sign-ins to the allowed email domain in Clerk.
- Use production Clerk keys only in production.
- Existing Auth0 sessions do not migrate; users sign in again with Clerk.

## Health Check

`GET /api/health` is public and returns `{"ok": true}`. Docker Compose uses it
as the app container liveness check.

`GET /api/songs`, the likes/comments routes, the comment mutation route, and
`GET /api/engagement/events` are protected and should not be used as
orchestration health checks.

## Operations

- Keep `.env` and `.env.local` out of Git. They are ignored by Git and Docker
  build context rules.
- Rotate Clerk credentials if they are copied into a shared place,
  committed by accident, or exposed by build artifacts.
- Rotate `GOOGLE_CHAT_WEBHOOK_URL` if it is copied into a shared place,
  committed by accident, or posted in chat/tickets.
- Back up Postgres before destructive maintenance. For compose deployments,
  data lives in the `postgres_data` volume.
- Watch logs for engagement listener errors if SSE updates stop. Clients can
  still use the REST APIs, but realtime updates require the Postgres listener.
- Run `npm audit --audit-level=high` and your container scanner before
  releases.

## Troubleshooting

- **`DATABASE_URL is not set`** - the app requires Postgres. Compose wires it
  automatically; managed hosts must set it explicitly.
- **App starts before DB is ready** - compose waits for Postgres health, but
  outside compose the first request can fail until Postgres accepts connections.
- **Clerk keys missing or mixed** - use publishable and secret keys from the
  same Clerk instance.
- **Unexpected account can sign in** - check Clerk restrictions and confirm
  `ALLOWED_EMAIL_DOMAIN` matches the intended domain.
- **Empty playlist after DB failure** - this should no longer happen. DB
  outages should surface as app/API errors.
- **Build cannot find Clerk key** - set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at
  build time, not only runtime.
- **Reminder cron returns 401** - confirm the scheduler sends
  `Authorization: Bearer <REMINDER_CRON_SECRET>`.
- **Reminder cron returns 500** - set `SERVICE_URL_APP`,
  `GOOGLE_CHAT_WEBHOOK_URL`, and `REMINDER_CRON_SECRET` in the app runtime env.
- **Reminder cron returns 502** - Google Chat rejected the webhook call. Rotate
  or recreate the webhook if the URL is expired or was exposed.
- **Clerk logs `secure-context: false`** - the app is being served over HTTP.
  Configure TLS and use the HTTPS URL for deployed Clerk auth flows.
