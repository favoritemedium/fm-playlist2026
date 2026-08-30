# FM Playlist

Monthly YouTube playlist sharing app for the Favorite Medium team.
Next.js 15 + Clerk + Postgres, deployable with Docker Compose or a managed
Postgres host.

## Features

- **Google sign-in** via Clerk (restricted to `@favoritemedium.com`)
- **Public read-only browsing** — anyone can discover tracks, likes, and comments; sign-in is required to add, like, save, or comment
- **Monthly playlists** — browse by year and month, then sort by newest or most liked
- **Add tracks** — paste a YouTube URL with an optional description
- **Likes and comments** — like songs, add comments, and reply one level deep
- **Realtime engagement** — live like/comment count updates and in-app submitter notifications
- **Google Chat reminders** — scheduled prompts and weekly submitter thanks
- **Search** — filter by submitter, title, artist, or description
- **Responsive** — works on mobile, tablet, and desktop
- **Quality gates** — ESLint, TypeScript, Vitest, and GitHub Actions CI

## Quick start (Docker)

Requires Docker and Docker Compose.

```bash
cp .env.example .env
# Edit .env - set Clerk keys and POSTGRES_PASSWORD at minimum.
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

The schema is auto-provisioned on first startup (see
[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)) — no manual DB setup.

## Quick start (local Node)

Requires Node 20+ and a running Postgres. Set `DATABASE_URL` in `.env.local`.

```bash
npm install
cp .env.example .env.local
# Edit .env.local (including DATABASE_URL)
npm run dev
```

## Environment variables

See [.env.example](.env.example) for the full list.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✔ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✔ | Clerk secret key |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | ✔ (compose) | Postgres credentials. `DATABASE_URL` is derived in `docker-compose.yml` |
| `DATABASE_URL` | ✔ (non-compose) | Full Postgres connection string |
| `ALLOWED_EMAIL_DOMAIN` | — | Server-side fallback allowlist. Defaults to `favoritemedium.com` |
| `SERVICE_URL_APP` | reminders | Public app URL included in Google Chat messages |
| `GOOGLE_CHAT_WEBHOOK_URL` | reminders | Google Chat Space webhook URL |
| `REMINDER_CRON_SECRET` | reminders | Bearer token required by scheduled reminder endpoints |
| `REMINDER_TIME_ZONE` | — | Reminder business timezone. Defaults to `Asia/Singapore` |

Never commit real environment files. `.env`, `.env.local`, and `.env.*.local`
are ignored, and Docker builds also exclude env files from the build context.

## Scripts

```bash
npm run dev     # Start dev server (port 3000)
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Run ESLint
npm run typecheck # Run TypeScript without emitting files
npm run test    # Run unit tests
```

## Runtime behavior

- `GET /api/health` is public and returns `{"ok": true}` for orchestration.
- `GET /api/songs` is public for read-only browsing. `POST /api/songs` requires
  an authenticated Clerk user from the allowed email domain.
- `GET /api/songs/[songId]/likes` and `GET /api/songs/[songId]/comments` are
  public read endpoints. Mutating likes/comments and `/api/notifications`
  require the same allowed-domain Clerk auth.
- `POST` and `DELETE` `/api/songs/[songId]/likes`, `POST`
  `/api/songs/[songId]/comments` plus `PATCH` and `DELETE`
  `/api/comments/[commentId]` require the same auth, support one level
  of replies, limit comment bodies to 500 characters, and enforce a
  5-comments-per-minute rate limit.
- `GET /api/engagement/events` is an authenticated Server-Sent Events stream
  used for live engagement counts and submitter comment notifications.
- `GET` or `POST /api/reminders/monday` and `/api/reminders/friday` require
  `Authorization: Bearer <REMINDER_CRON_SECRET>` and send Google Chat messages
  when reminder env vars are configured.
- Postgres is required and is the source of truth. If Postgres is unavailable,
  the app surfaces an error instead of pretending the playlist is empty.
- New submissions accept YouTube `watch`, `youtu.be`, `embed`, and `shorts`
  URLs only. Descriptions are limited to 500 characters.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project structure

```
src/
  app/
    page.tsx                # Home (server component)
    api/songs/route.ts      # Songs API (GET all, POST new)
    api/songs/[songId]/     # Likes and comments APIs per song
    api/comments/[commentId]/route.ts # Comment edit/delete API
    api/engagement/events/route.ts    # Authenticated SSE engagement stream
    api/health/route.ts     # Unauthenticated health check
    api/reminders/          # Secret-protected Google Chat reminder endpoints
  components/               # UI, playlist, layout, auth
    playlist/EngagementDialog.tsx # Likes/comments UI
    playlist/useEngagementEvents.ts # Client SSE subscription hook
  lib/
    auth.ts                 # Clerk user mapping and domain checks
    db.ts                   # pg.Pool + ensureSchema()
    engagement-db.ts        # Likes/comments queries and rules
    engagement-events.ts    # Postgres LISTEN/NOTIFY fan-out for SSE
    songs-db.ts             # Postgres queries for songs
    reminders*.ts           # Reminder scheduling, messages, Google Chat, DB helpers
    songs.ts                # Playlist data and submission service
    youtube.ts              # YouTube URL utilities
    constants.ts            # Shared constants
  types/song.ts             # TypeScript interfaces
  middleware.ts             # Clerk middleware
db/
  init/001_schema.sql       # Auto-provisioned on first DB startup
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Clerk Setup](docs/CLERK_SETUP.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
