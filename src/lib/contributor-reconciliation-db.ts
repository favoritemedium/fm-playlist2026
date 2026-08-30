import "server-only";

import type { PoolClient } from "pg";
import { ensureSchema, getPool } from "@/lib/db";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/constants";
import {
  BLANK_LEGACY_NAME_KEY,
  BLANK_LEGACY_NAME_LABEL,
  normalizeLegacyName,
  type ContributorCandidate,
} from "@/lib/contributor-reconciliation";

interface LegacySongRow {
  id: number;
  legacy_name: string;
  submitter_name: string;
  submitter_email: string | null;
  submitter_user_id: string | null;
  song_title: string | null;
  artist_name: string | null;
  youtube_url: string;
  submitted_date: string;
}

interface MappingRow {
  legacy_name_key: string;
  legacy_name: string;
  canonical_name: string;
  canonical_email: string;
  submitter_user_id: string | null;
}

interface SkipRow {
  legacy_name_key: string;
}

export interface LegacyContributorGroup {
  legacyName: string;
  legacyNameKey: string;
  songCount: number;
  songs: Array<{
    id: number;
    title: string;
    artist: string | null;
    youtubeUrl: string;
    submittedDate: string;
  }>;
  isApplied: boolean;
  isSkipped: boolean;
  mapping: {
    name: string;
    email: string;
    userId: string | null;
  } | null;
}

export interface ContributorReconciliationData {
  candidates: ContributorCandidate[];
  groups: LegacyContributorGroup[];
}

// The original sync marks imported rows as `airtable`, but older database
// imports may only retain an Airtable record ID or may predate app identities.
// App submissions always have an email and user ID, so the final branch safely
// includes legacy imports whose source marker was not preserved.
const LEGACY_SONG_PREDICATE = `(
  source = 'airtable'
  OR airtable_record_id IS NOT NULL
  OR (submitter_email IS NULL AND submitter_user_id IS NULL)
)`;

export async function getContributorReconciliationData(): Promise<ContributorReconciliationData> {
  await ensureSchema();
  const pool = getPool();
  const [songsResult, mappingsResult, skipsResult, candidatesResult] = await Promise.all([
    pool.query<LegacySongRow>(
      `SELECT id,
              COALESCE(legacy_submitter_name, submitter_name) AS legacy_name,
              submitter_name, submitter_email, submitter_user_id,
              song_title, artist_name, youtube_url, submitted_date::text
       FROM songs
       WHERE ${LEGACY_SONG_PREDICATE}
       ORDER BY submitted_date DESC, id DESC`
    ),
    pool.query<MappingRow>(
      `SELECT legacy_name_key, legacy_name, canonical_name, canonical_email,
              submitter_user_id
       FROM contributor_identity_mappings`
    ),
    pool.query<SkipRow>(
      `SELECT legacy_name_key
       FROM contributor_reconciliation_skips`
    ),
    pool.query<{ clerk_user_id: string; name: string; email: string }>(
      `SELECT clerk_user_id, name, email
       FROM app_users
       WHERE split_part(lower(email), '@', 2) = lower($1)
       ORDER BY lower(name), lower(email)`,
      [ALLOWED_EMAIL_DOMAIN]
    ),
  ]);

  const mappings = new Map(
    mappingsResult.rows.map((row) => [row.legacy_name_key, row])
  );
  const skippedKeys = new Set(skipsResult.rows.map((row) => row.legacy_name_key));
  const groupedRows = new Map<string, LegacySongRow[]>();

  for (const row of songsResult.rows) {
    const key = normalizeLegacyName(row.legacy_name);
    const rows = groupedRows.get(key) || [];
    rows.push(row);
    groupedRows.set(key, rows);
  }

  const groups = [...groupedRows.entries()]
    .map(([legacyNameKey, rows]): LegacyContributorGroup => {
      const mapping = mappings.get(legacyNameKey) || null;
      const isApplied = Boolean(
        mapping &&
          rows.every(
            (row) =>
              row.submitter_email?.toLocaleLowerCase("en-US") ===
                mapping.canonical_email.toLocaleLowerCase("en-US") &&
              row.submitter_name === mapping.canonical_name &&
              row.submitter_user_id === mapping.submitter_user_id
          )
      );
      const songs = rows.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.song_title || "Untitled track",
        artist: row.artist_name,
        youtubeUrl: row.youtube_url,
        submittedDate: row.submitted_date,
      }));

      return {
        legacyName: rows[0].legacy_name.trim() || BLANK_LEGACY_NAME_LABEL,
        legacyNameKey,
        songCount: rows.length,
        songs,
        isApplied,
        isSkipped: !isApplied && skippedKeys.has(legacyNameKey),
        mapping: mapping
          ? {
              name: mapping.canonical_name,
              email: mapping.canonical_email,
              userId: mapping.submitter_user_id,
            }
          : null,
      };
    })
    .sort((left, right) => {
      if (left.isApplied !== right.isApplied) return left.isApplied ? 1 : -1;
      const leftIsBlank = left.legacyNameKey === BLANK_LEGACY_NAME_KEY;
      const rightIsBlank = right.legacyNameKey === BLANK_LEGACY_NAME_KEY;
      if (leftIsBlank !== rightIsBlank) return leftIsBlank ? 1 : -1;
      return left.legacyName.localeCompare(right.legacyName);
    });

  return {
    candidates: candidatesResult.rows.map((row) => ({
      userId: row.clerk_user_id,
      name: row.name,
      email: row.email,
    })),
    groups,
  };
}

async function resolveTargetUser(
  client: PoolClient,
  email: string,
  selectedUserId: string | null
): Promise<{ userId: string | null; name: string | null; email: string }> {
  if (selectedUserId) {
    const selected = await client.query<{
      clerk_user_id: string;
      name: string;
      email: string;
    }>(`SELECT clerk_user_id, name, email FROM app_users WHERE clerk_user_id = $1`, [
      selectedUserId,
    ]);
    if (!selected.rows[0]) throw new Error("Selected user no longer exists");
    const selectedDomain = selected.rows[0].email
      .split("@")
      .at(-1)
      ?.toLocaleLowerCase("en-US");
    if (selectedDomain !== ALLOWED_EMAIL_DOMAIN.toLocaleLowerCase("en-US")) {
      throw new Error("Selected user is outside the allowed email domain");
    }
    return {
      userId: selected.rows[0].clerk_user_id,
      name: selected.rows[0].name,
      email: selected.rows[0].email,
    };
  }

  const matching = await client.query<{
    clerk_user_id: string;
    name: string;
    email: string;
  }>(
    `SELECT clerk_user_id, name, email
     FROM app_users
     WHERE lower(email) = lower($1)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [email]
  );
  const user = matching.rows[0];
  return user
    ? { userId: user.clerk_user_id, name: user.name, email: user.email }
    : { userId: null, name: null, email };
}

export async function saveContributorMapping(input: {
  legacyName: string;
  email: string;
  selectedUserId: string | null;
  adminEmail: string;
}): Promise<number> {
  await ensureSchema();
  const legacyName = input.legacyName.trim();
  const legacyNameKey = normalizeLegacyName(legacyName);
  const emailDomain = input.email.split("@").at(-1)?.toLocaleLowerCase("en-US");

  if (!input.selectedUserId && emailDomain !== ALLOWED_EMAIL_DOMAIN.toLocaleLowerCase("en-US")) {
    throw new Error("Contributor email is outside the allowed email domain");
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const target = await resolveTargetUser(client, input.email, input.selectedUserId);
    const canonicalName = target.name || legacyName;

    await client.query(
      `INSERT INTO contributor_identity_mappings (
         legacy_name_key, legacy_name, canonical_name, canonical_email,
         submitter_user_id, mapped_by_email
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (legacy_name_key) DO UPDATE SET
         legacy_name = EXCLUDED.legacy_name,
         canonical_name = EXCLUDED.canonical_name,
         canonical_email = EXCLUDED.canonical_email,
         submitter_user_id = EXCLUDED.submitter_user_id,
         mapped_by_email = EXCLUDED.mapped_by_email,
         updated_at = now()`,
      [
        legacyNameKey,
        legacyName,
        canonicalName,
        target.email.toLocaleLowerCase("en-US"),
        target.userId,
        input.adminEmail.toLocaleLowerCase("en-US"),
      ]
    );

    const updated = await client.query(
      `UPDATE songs
       SET legacy_submitter_name = COALESCE(legacy_submitter_name, submitter_name),
           submitter_name = $1,
           submitter_email = $2,
           submitter_user_id = $3
       WHERE ${LEGACY_SONG_PREDICATE}
         AND CASE
           WHEN btrim(COALESCE(legacy_submitter_name, submitter_name)) = '' THEN $5
           ELSE lower(regexp_replace(
             btrim(COALESCE(legacy_submitter_name, submitter_name)),
             '[[:space:]]+', ' ', 'g'
           ))
         END = $4`,
      [
        canonicalName,
        target.email.toLocaleLowerCase("en-US"),
        target.userId,
        legacyNameKey,
        BLANK_LEGACY_NAME_KEY,
      ]
    );

    await client.query(
      `DELETE FROM contributor_reconciliation_skips
       WHERE legacy_name_key = $1`,
      [legacyNameKey]
    );

    await client.query("COMMIT");
    return updated.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function skipContributorGroup(input: {
  legacyName: string;
  adminEmail: string;
}): Promise<void> {
  await ensureSchema();
  const legacyName = input.legacyName.trim();
  const legacyNameKey = normalizeLegacyName(legacyName);

  await getPool().query(
    `INSERT INTO contributor_reconciliation_skips (
       legacy_name_key, legacy_name, skipped_by_email
     ) VALUES ($1, $2, $3)
     ON CONFLICT (legacy_name_key) DO UPDATE SET
       legacy_name = EXCLUDED.legacy_name,
       skipped_by_email = EXCLUDED.skipped_by_email,
       updated_at = now()`,
    [legacyNameKey, legacyName, input.adminEmail.toLocaleLowerCase("en-US")]
  );
}

export async function restoreContributorGroup(legacyName: string): Promise<void> {
  await ensureSchema();
  const legacyNameKey = normalizeLegacyName(legacyName.trim());

  await getPool().query(
    `DELETE FROM contributor_reconciliation_skips
     WHERE legacy_name_key = $1`,
    [legacyNameKey]
  );
}
