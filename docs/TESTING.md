# Testing

## Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run test:watch` starts Vitest in watch mode for local development.

## Current Test Coverage

Unit tests cover:

- YouTube URL parsing and rejection of lookalike hosts
- Date-only normalization and display formatting
- Song submission validation
- API auth/error helper behavior
- Reminder date-window, message, cron auth, and Google Chat client behavior

Test files live beside the code they cover as `*.test.ts` files.
Realtime engagement and comment permissions are currently verified through the
manual checks below rather than dedicated automated tests.

## Manual Smoke Tests

After larger changes, verify these flows in a browser:

1. Signed-out homepage shows the playlist and Clerk sign-in button; likes,
   saves, comments, and submissions remain mutation-gated.
2. Allowed-domain user can view the playlist.
3. Forbidden-domain user sees the account restriction message and can switch
   accounts.
4. Search filters submitter, title, artist, and description.
5. Month/year filters stay valid when search changes result sets.
6. Add Track accepts valid YouTube URLs and updates the playlist immediately.
7. Add Track rejects invalid URLs and overlong descriptions visibly.
8. Liking and unliking a song updates the count immediately and stays in sync
  after the server response.
9. Opening the engagement dialog loads the liker list, top-level comments, and
  one-level replies for the selected song.
10. Posting a top-level comment and a reply updates counts and thread content.
11. Editing and deleting your own comments works, while another account cannot
  edit or delete them.
12. When one user comments on another user's song, the submitter sees an
  in-app notification and can open the related track from it.
13. Mobile, tablet, and desktop layouts do not overlap.

## API Checks

With a running app, verify:

- `GET /api/health` returns 200 without authentication.
- `GET /api/songs` is available without authentication, while `POST /api/songs`
  rejects unauthenticated users.
- `POST /api/songs` rejects malformed JSON, invalid YouTube URLs, and
  forbidden-domain users.
- Allowed users can submit a valid YouTube URL.
- `GET /api/songs/[songId]/likes` returns `{ summary, likers }` for an
  authenticated song.
- `POST /api/songs/[songId]/likes` likes the song, and
  `DELETE /api/songs/[songId]/likes` removes that like.
- `GET /api/songs/[songId]/comments` returns `{ comments, summary }` and keeps
  replies attached to top-level comments only.
- `POST /api/songs/[songId]/comments` rejects malformed JSON, empty comments,
  replies-to-replies, and the sixth comment within one minute.
- `PATCH /api/comments/[commentId]` and `DELETE /api/comments/[commentId]`
  reject non-owners and refresh the thread summary for owners.
- `GET /api/engagement/events` stays open as `text/event-stream` for an
  authenticated user and receives engagement updates after likes/comments.
- `POST /api/reminders/monday` rejects missing or invalid cron bearer tokens.
- `POST /api/reminders/monday` sends one Google Chat message and skips a
  duplicate retry for the same date window.
- `POST /api/reminders/friday` lists recent submitter names, and sends the
  no-submitters nudge when the seven-date window is empty.

## CI

`.github/workflows/ci.yml` runs install, lint, typecheck, tests, and build on
pushes to `main` and pull requests.

The build step requires GitHub Actions secrets named
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Use CI-safe Clerk
credentials and keep literal key values out of the workflow file.
