import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getContributorAdmin } from "@/lib/admin-auth";
import {
  getContributorReconciliationData,
  restoreContributorGroup,
  skipContributorGroup,
  type LegacyContributorGroup,
} from "@/lib/contributor-reconciliation-db";
import {
  suggestContributorCandidate,
  type ContributorCandidate,
} from "@/lib/contributor-reconciliation";
import { saveContributorMappingAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contributor reconciliation",
  robots: { index: false, follow: false },
};

function queueActionHref(legacyName: string, operation: "defer" | "restore"): string {
  const encodedName = Buffer.from(legacyName, "utf8").toString("base64url");
  return `/admin?queue=${operation === "defer" ? "d" : "r"}.${encodedName}`;
}

function decodeQueueCommand(value: string): {
  operation: "d" | "r";
  legacyName: string;
} | null {
  if (!/^[dr]\.[A-Za-z0-9_-]{1,400}$/.test(value)) return null;

  const operation = value[0];
  const token = value.slice(2);
  if (operation !== "d" && operation !== "r") return null;

  try {
    const legacyName = Buffer.from(token, "base64url").toString("utf8");
    if (Buffer.from(legacyName, "utf8").toString("base64url") !== token) return null;
    return { operation, legacyName };
  } catch {
    return null;
  }
}

async function isSameOriginAdminNavigation(): Promise<boolean> {
  const requestHeaders = await headers();
  const referer = requestHeaders.get("referer");
  if (!referer || requestHeaders.get("sec-fetch-site") !== "same-origin") return false;

  try {
    const refererUrl = new URL(referer);
    const requestHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
    return Boolean(requestHost) && refererUrl.host === requestHost && refererUrl.pathname === "/admin";
  } catch {
    return false;
  }
}

function MappingForm({
  group,
  candidates,
  compact = false,
}: {
  group: LegacyContributorGroup;
  candidates: ContributorCandidate[];
  compact?: boolean;
}) {
  const suggestion = suggestContributorCandidate(group.legacyName, candidates);
  const defaultUserId = group.mapping?.userId || suggestion?.userId || "";
  const manualEmail = group.mapping && !group.mapping.userId ? group.mapping.email : "";

  return (
    <form action={saveContributorMappingAction} className="space-y-3">
      <input type="hidden" name="legacyName" value={group.legacyName} />
      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">
          Which email matches &ldquo;{group.legacyName}&rdquo;?
        </legend>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Select an existing email</span>
          <select
            name="selectedUserId"
            defaultValue={defaultUserId}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select an existing account</option>
            {candidates.map((candidate) => (
              <option key={candidate.userId} value={candidate.userId}>
                {candidate.name} — {candidate.email}
                {suggestion?.userId === candidate.userId ? " (suggested)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Or type an email</span>
          <input
            name="typedEmail"
            type="email"
            defaultValue={manualEmail}
            placeholder="name@favoritemedium.com"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <span className="block text-xs text-neutral-500">
            A typed email overrides the selected account. It will link automatically when that user signs in.
          </span>
        </label>
      </fieldset>
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
      >
        {compact ? "Update mapping" : "Save and continue"}
      </button>
    </form>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-form": "The submitted form was invalid.",
  "missing-email": "Select an existing account or type an email.",
  "invalid-email": "Enter a valid favoritemedium.com email address.",
  "save-failed": "The mapping could not be saved. No partial changes were committed.",
  "skip-failed": "The name could not be skipped.",
  "restore-failed": "The skipped name could not be returned to the queue.",
};

export default async function ContributorAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    updated?: string;
    skipped?: string;
    restored?: string;
    queue?: string;
  }>;
}) {
  const admin = await getContributorAdmin();
  if (!admin) notFound();

  const params = await searchParams;
  if (params.queue) {
    const command = decodeQueueCommand(params.queue);
    if (!command || !(await isSameOriginAdminNavigation())) redirect("/admin?error=invalid-form");

    let outcome: "skipped=1" | "restored=1";
    try {
      if (command.operation === "d") {
        await skipContributorGroup({ legacyName: command.legacyName, adminEmail: admin.email });
        outcome = "skipped=1";
      } else {
        await restoreContributorGroup(command.legacyName);
        outcome = "restored=1";
      }
    } catch (error) {
      console.error("Failed to update contributor reconciliation queue:", error);
      redirect(`/admin?error=${command.operation === "d" ? "skip-failed" : "restore-failed"}`);
    }

    redirect(`/admin?${outcome}`);
  }

  const { candidates, groups } = await getContributorReconciliationData();
  const pending = groups.filter((group) => !group.isApplied && !group.isSkipped);
  const skipped = groups.filter((group) => group.isSkipped);
  const completed = groups.filter((group) => group.isApplied);
  const next = pending[0] || null;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8 text-neutral-900 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">Temporary admin tool</p>
        <h1 className="text-2xl font-bold">Contributor reconciliation</h1>
        <p className="text-sm text-neutral-600">
          Signed in as {admin.email}. Take and verify a production database dump before saving the first mapping.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <strong>{completed.length} of {groups.length} names mapped</strong>
          <span>
            {pending.length} remaining · {skipped.length} skipped · {candidates.length} available accounts
          </span>
        </div>
      </section>

      {errorMessage && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </p>
      )}
      {params.updated && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Updated {params.updated} Airtable song records.
        </p>
      )}
      {params.skipped && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Skipped for now. No song records were changed.
        </p>
      )}
      {params.restored && (
        <p className="rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Returned the name to the matching queue.
        </p>
      )}

      {next ? (
        <section className="space-y-4 rounded-lg border border-neutral-300 bg-white p-5 shadow-sm">
          <div className="rounded-md border-2 border-rose-300 bg-rose-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
              Airtable name to match
            </p>
            <p className="mt-1 break-words text-2xl font-bold text-neutral-950">
              {next.legacyName}
            </p>
          </div>

          {next.songs.length > 0 && (
            <div>
              <p className="text-sm font-semibold">
                Submissions under this Airtable name ({next.songCount})
              </p>
              <ul className="mt-2 divide-y divide-neutral-200 rounded-md border border-neutral-200">
                {next.songs.map((song) => (
                  <li key={song.id} className="px-3 py-2 text-sm">
                    <a
                      href={song.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                    >
                      {song.title}
                    </a>
                    <p className="text-neutral-600">
                      {[song.artist, song.submittedDate].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
              {next.songCount > next.songs.length && (
                <p className="mt-2 text-xs text-neutral-500">
                  Showing the most recent {next.songs.length} of {next.songCount} submissions.
                </p>
              )}
            </div>
          )}
          <MappingForm group={next} candidates={candidates} />
          <a
            href={queueActionHref(next.legacyName, "defer")}
            rel="nofollow"
            className="text-sm font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-950"
          >
            Skip for now — I don&apos;t know this person
          </a>
        </section>
      ) : groups.length === 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-950">No legacy submissions were found in this database.</h2>
          <p className="mt-1 text-sm text-amber-900">
            This page reads the current Postgres database. Confirm that the production data has been imported into
            the database used by this app before starting reconciliation.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-green-300 bg-green-50 p-5">
          <h2 className="font-bold text-green-900">No names remain in the matching queue.</h2>
          <p className="mt-1 text-sm text-green-800">
            Review completed mappings and any skipped names below before removing this route.
          </p>
        </section>
      )}

      {skipped.length > 0 && (
        <details className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <summary className="cursor-pointer font-semibold text-amber-950">
            Review skipped names ({skipped.length})
          </summary>
          <div className="mt-4 space-y-3">
            {skipped.map((group) => (
              <div
                key={group.legacyNameKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-white p-3"
              >
                <p className="text-sm">
                  <strong>{group.legacyName}</strong> · {group.songCount} songs
                </p>
                <a
                  href={queueActionHref(group.legacyName, "restore")}
                  rel="nofollow"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
                >
                  Return to queue
                </a>
              </div>
            ))}
          </div>
        </details>
      )}

      {completed.length > 0 && (
        <details className="rounded-lg border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">Review or correct completed mappings ({completed.length})</summary>
          <div className="mt-4 space-y-4">
            {completed.map((group) => (
              <details key={group.legacyNameKey} className="rounded-md border border-neutral-200 p-3">
                <summary className="cursor-pointer text-sm">
                  <strong>{group.legacyName}</strong> → {group.mapping?.name} ({group.mapping?.email}) · {group.songCount} songs
                </summary>
                <div className="mt-3">
                  <MappingForm group={group} candidates={candidates} compact />
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
