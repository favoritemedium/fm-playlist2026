# Architecture

FM Playlist is a small Next.js App Router application with a server-rendered
home page, a client-side playlist experience, Clerk authentication, Postgres as
the source of truth, and optional Airtable legacy sync.

## Request Flow

1. `src/middleware.ts` installs Clerk middleware and keeps `/api/health` public.
2. `src/app/layout.tsx` wraps the app with `ClerkProvider`.
3. `src/app/page.tsx` calls `getCurrentAppAuth()` on the server.
4. Unauthenticated users can browse read-only playlist content. Forbidden-domain
   users see a switch-account message and cannot mutate content.
5. Authenticated users trigger `getAllSongs()` and receive the playlist UI.
6. `PlaylistView` opens an authenticated SSE connection only for signed-in
  users so likes, comments, and submitter notifications stay in sync.

## Data Flow

```text
Airtable API (optional) ----\
                            -> getAllSongs() -> PlaylistView
Postgres (required) --------/

AddTrackDialog -> POST /api/songs -> createSong() -> Postgres

EngagementDialog / SongCard actions
  -> likes/comments APIs
  -> engagement-db.ts
  -> Postgres
  -> pg_notify(song_engagement_events)
  -> /api/engagement/events (SSE)
  -> useEngagementEvents()
  -> PlaylistView state + submitter notifications
```

Postgres failures are fatal because Postgres is the source of truth. Airtable
failures are non-fatal and degrade to Postgres-only results.

## Server Components And Client Components

- `src/app/page.tsx` is a server component. It handles auth and initial data.
- `src/components/playlist/PlaylistView.tsx` is a client component. It owns the
  local song list, selected month/year, search query, active video, optimistic
  likes, and in-app comment notifications.
- `src/components/playlist/EngagementDialog.tsx` is a client component for
  likes, likers, top-level comments, one-level replies, and comment edits.
- `src/components/playlist/usePlaylistFiltering.ts` derives searchable and
  filterable song sets from local state.
- `src/components/playlist/useEngagementEvents.ts` subscribes to the SSE route
  and applies `song_engagement_updated` and `song_comment_notification` events.
- `src/components/auth/RefreshOnSignIn.tsx` refreshes the server-rendered
  payload after Clerk reports a successful client-side sign-in.

## API Routes

- `GET /api/health` is public and used only for health checks.
- `GET /api/songs` returns public read-only playlist data. `POST /api/songs`
  requires an authenticated user from the allowed domain.
- `POST /api/songs` validates the request body, extracts the YouTube video ID,
  and inserts a new app-sourced row.
- `GET /api/songs/[songId]/likes` returns `{ summary, likers }` publicly.
- `POST /api/songs/[songId]/likes` likes a song and returns `{ summary }`.
- `DELETE /api/songs/[songId]/likes` removes the current user's like and
  returns `{ summary }`.
- `GET /api/songs/[songId]/comments` returns `{ comments, summary }` publicly.
- `POST /api/songs/[songId]/comments` creates a top-level comment or reply,
  enforces the 500-character limit plus 5-comments-per-minute rate limit, and
  returns `{ commentId, comments, summary }`.
- `PATCH /api/comments/[commentId]` edits the current user's comment and
  returns `{ comments, summary }`.
- `DELETE /api/comments/[commentId]` hard-deletes the current user's comment,
  cascades replies via the database relation, and returns `{ comments, summary }`.
- `GET /api/engagement/events` opens an authenticated Server-Sent Events stream
  that emits `song_engagement_updated` for all viewers and
  `song_comment_notification` only to the submitter of the affected song.

API errors use `{ error, code, details? }` JSON bodies.

## Shared Utilities

- `src/lib/auth.ts` maps Clerk users and enforces the allowed domain.
- `src/lib/validation.ts` validates song submissions with Zod.
- `src/lib/youtube.ts` parses supported YouTube URL shapes with `URL` parsing.
- `src/lib/dates.ts` normalizes date-only values and avoids timezone drift.
- `src/lib/songs.ts` merges Postgres and optional Airtable data.
- `src/lib/songs-db.ts` contains Postgres queries.
- `src/lib/engagement-db.ts` owns like/comment persistence, reply rules,
  ownership checks, and comment rate limiting.
- `src/lib/engagement-events.ts` maintains one Postgres `LISTEN` client per
  process and fans engagement events out to SSE subscribers.
- `src/lib/airtable.ts` contains Airtable pagination, retry, and mapping logic.

## Styling And UI

The app uses Tailwind CSS 4, a small set of shadcn-style local UI components,
Radix primitives for dialog/select behavior, lucide icons, and `motion` for
light entrance animations.

## Quality Gates

Local and CI verification run ESLint, TypeScript, Vitest, and a production
Next.js build. See [TESTING.md](TESTING.md).
