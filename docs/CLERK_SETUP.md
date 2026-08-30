# Clerk Setup Guide

The app uses `@clerk/nextjs` with the App Router, `ClerkProvider`,
`clerkMiddleware`, `currentUser`, `SignInButton`, `SignOutButton`, and
`useAuth`.

## 1. Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/).
2. Create an application named `FM Playlist`.
3. Choose the Next.js SDK when prompted.
4. Keep separate development and production instances so local keys are never
   reused in production.

## 2. Enable Google Sign-In

1. Open **Configure > Authentication**.
2. Enable **Google** as a social connection.
3. Disable providers the team should not use.
4. For production, configure Google OAuth credentials in Clerk if prompted.

## 3. Restrict Access To Favorite Medium

Configure Clerk's sign-up or sign-in restrictions so only
`@favoritemedium.com` accounts can create or use accounts for this app.

The app also checks `ALLOWED_EMAIL_DOMAIN` on the server for page access,
playlist APIs, engagement APIs, and the authenticated SSE endpoint. Keep the
Clerk dashboard restriction and the environment variable aligned.

## 4. Get API Keys

From **Configure > API keys**, copy:

- **Publishable key** -> `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **Secret key** -> `CLERK_SECRET_KEY`

Use development keys locally and production keys only in production.

## 5. Environment Variables

Add to `.env.local` for local Node development or `.env` for Docker Compose:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable key>
CLERK_SECRET_KEY=<secret key>
ALLOWED_EMAIL_DOMAIN=favoritemedium.com
```

Keep the existing Postgres variables from
[../.env.example](../.env.example).

## 6. Production Domains

After deploying the app, add the production URL in Clerk's domain settings and
set the production Clerk keys in the host environment.

The app uses Clerk's hosted sign-in modal through `SignInButton`, so there are
no `/auth/login`, `/auth/logout`, or `/auth/callback` routes to register.

After a successful client-side sign-in, `RefreshOnSignIn` calls
`router.refresh()` so the server-rendered homepage refetches the authenticated
state immediately.

## 7. Code Map

- `src/app/layout.tsx` wraps the app with `ClerkProvider`.
- `src/middleware.ts` installs `clerkMiddleware()` and keeps `/api/health`
  public.
- `src/lib/auth.ts` maps Clerk users to the app user shape and enforces the
  allowed email domain.
- `src/app/page.tsx` shows sign-in, forbidden-account, or playlist states.
- `src/app/api/songs/route.ts` explicitly protects both reads and writes.
- `src/app/api/songs/[songId]/likes/route.ts`,
  `src/app/api/songs/[songId]/comments/route.ts`,
  `src/app/api/comments/[commentId]/route.ts`, and
  `src/app/api/engagement/events/route.ts` use the same allowed-domain auth.

## 8. Migration Notes

- Existing song records do not need a database migration. Submitter name and
  email are stored as plain text.
- Existing Auth0 sessions do not migrate. Users will sign in again through
  Clerk after cutover.
- After production cutover, disable the old Auth0 application and rotate any
  Auth0 secret that may have been shared outside ignored local env files.
