# Contributor Reconciliation

`/admin` is a temporary, server-rendered tool for reconciling legacy Airtable
submitter names with authenticated app accounts. It is intentionally not linked
from the public interface.

## Before Deployment

Take and verify a full production Postgres backup **before deploying this
schema change**. Use the database provider's protected backup facility or run
`pg_dump` from inside the production database environment. Do not expose the
database publicly and do not copy its connection string into the browser.

The backup should include schema and data. Verify that it is readable before
continuing, and retain it until reconciliation and post-deployment checks are
complete.

## Access Control

- The page and its server action independently require an authenticated Clerk
  account whose email is exactly `chanaka@favoritemedium.com`.
- Every other visitor sees the generic not-found page and receives no admin data.
- Database credentials remain server-only.
- Submitted emails must use the configured allowed email domain.

## Workflow

1. Sign in normally, then visit `/admin` directly.
2. Review the prominently displayed unmatched Airtable name and its associated
   submissions.
3. Confirm the suggested account, select another existing account, or type an
   email manually.
   If the identity is unknown, choose **Skip for now**. Skipping changes no song
   records and advances to the next name.
4. Save. All matching Airtable songs are updated in one transaction.
5. Continue until the page reports that every name is mapped.
6. Review completed mappings using the expandable section and correct any
   mistakes before removing the route.

Skipped names are stored separately from identity mappings and appear in a
review section. Use **Return to queue** if you later identify the person.
Skip and restore are ordinary same-origin links back to the authenticated
`/admin` page, followed by an immediate redirect to a clean `/admin` URL.
This temporary workflow deliberately avoids JavaScript hydration, Server
Actions, and form submission. Legacy names are encoded into the query, and the
page rejects requests that did not originate from the same app page.

The legacy queue includes rows marked as Airtable, rows with an Airtable record
ID, and pre-account rows with neither an email nor an authenticated user ID.
This covers older database imports that did not preserve the latest source
marker. If no legacy submissions are found, `/admin` shows that as a distinct
database-data warning instead of incorrectly reporting that all names are
mapped.

Whitespace-only Airtable names are shown as `(Blank Airtable name)` and placed
at the end of the queue. Their submissions remain visible so the account can be
identified manually if possible.

A manually entered email can be stored before the person has signed in. On that
person's first authenticated visit, their real Clerk user ID and current Google
display name are linked automatically.

## Removal

After reconciliation is checked and backed up again, remove the temporary
`src/app/admin` route, `src/lib/admin-auth.ts`, and the temporary
`contributor_reconciliation_skips` table. Keep
`legacy_submitter_name` and `contributor_identity_mappings` unless there is a
separate, reviewed data-retention migration; they preserve the audit trail and
allow future identity refreshes.
