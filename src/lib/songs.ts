import "server-only";

import type { Song, CreateSongInput } from "@/types/song";
import type { AppUser } from "@/lib/auth";
import { fetchAllAirtableRecords } from "./airtable";
import {
  fetchAllSongs,
  createSongRow,
  bulkCreateSongRows,
  fetchSongByYouTubeVideoId,
  type SongInsert,
} from "./songs-db";
import { compareDateOnlyDesc, getDateParts, toDateOnlyString } from "./dates";
import { syncAppUserIdentity } from "./users-db";
import { extractYouTubeId, fetchYouTubeOEmbed, parseYouTubeTitle } from "./youtube";
import { getPool } from "./db";

/** Normalize a composite key for dedup comparison. Trims whitespace,
 *  lowercases, and strips any time component from dates. */
function songKey(name: string, date: string, url: string): string {
  return `${name.trim().toLowerCase()}|${toDateOnlyString(date)}|${url.trim().toLowerCase()}`;
}

export async function getAllSongs(user?: AppUser): Promise<Song[]> {
  if (user) {
    await syncAppUserIdentity(user);
  }

  const currentUserId = user?.id ?? null;
  const airtableSongsPromise =
    fetchAllAirtableRecords().catch((err) => {
      console.error("Airtable fetch failed:", err);
      return [] as Song[];
    });

  // Postgres is the source of truth when available. If it fails in local dev,
  // gracefully fall back to Airtable songs so the UI continues working.
  const [airtableSongs, dbSongs] = await Promise.all([
    airtableSongsPromise,
    fetchAllSongs(currentUserId).catch((err) => {
      console.warn("DB fetch failed, falling back to Airtable records:", err.message);
      return [] as Song[];
    }),
  ]);

  if (dbSongs.length === 0 && airtableSongs.length > 0) {
    const sortedAirtable = [...airtableSongs].sort((a, b) =>
      compareDateOnlyDesc(a.submittedDate, b.submittedDate)
    );
    return sortedAirtable;
  }

  // Trigger background backfill if any DB song is missing metadata
  if (dbSongs.some((s) => s.songTitle === null)) {
    backfillSongMetadata(dbSongs).catch((err) => {
      console.error("Background metadata backfill failed:", err);
    });
  }

  let syncedDbSongs = dbSongs;

  // 2. Build a set of composite keys from the DB rows we already fetched
  const existingKeys = new Set<string>();
  const existingAirtableIds = new Set<string>();
  for (const s of dbSongs) {
    existingKeys.add(songKey(s.submitterName, s.submittedDate, s.youtubeUrl));
    if (s.airtableRecordId) {
      existingAirtableIds.add(s.airtableRecordId);
    }
  }

  console.log(
    `[SYNC] Airtable: ${airtableSongs.length} rows, DB: ${dbSongs.length} rows, DB keys: ${existingKeys.size}, Airtable IDs: ${existingAirtableIds.size}`
  );

  // 3. Find Airtable records that don't exist in the DB
  const newAirtableSongs = airtableSongs.filter(
    (song) =>
      !existingAirtableIds.has(song.airtableRecordId ?? "") &&
      !existingKeys.has(
        songKey(song.submitterName, song.submittedDate, song.youtubeUrl)
      )
  );

  // 4. Insert new records into the DB (await so next reload sees them)
  if (newAirtableSongs.length > 0) {
    try {
      const rows: SongInsert[] = newAirtableSongs.map((song) => ({
        source: "airtable",
        airtable_record_id: song.airtableRecordId,
        submitter_user_id: null,
        submitter_name: song.submitterName,
        submitter_email: null,
        artist_name: song.artistName,
        song_title: song.songTitle,
        description: song.description,
        youtube_url: song.youtubeUrl,
        youtube_video_id: song.youtubeVideoId,
        submitted_date: song.submittedDate,
        month: song.month,
        year: song.year,
      }));
      const insertedCount = await bulkCreateSongRows(rows);
      console.log(
        `[SYNC] Inserted ${insertedCount}/${newAirtableSongs.length} new Airtable rows into Postgres`
      );
      syncedDbSongs = await fetchAllSongs(currentUserId);
    } catch (err) {
      console.error("Airtable→DB sync failed:", err);
    }
  }

  // 5. Return DB-backed songs only. Interactions need stable `db_` IDs.
  const merged: Song[] = [...syncedDbSongs];

  merged.sort((a, b) => {
    return compareDateOnlyDesc(a.submittedDate, b.submittedDate);
  });

  return merged;
}

export async function createSong(
  input: CreateSongInput,
  user: AppUser
): Promise<Song> {
  await syncAppUserIdentity(user);

  const youtubeUrl = input.youtubeUrl.trim();
  const description = input.description?.trim();
  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  const existingSong = await fetchSongByYouTubeVideoId(videoId, user.id);
  if (existingSong && !input.allowDuplicate) {
    throw new DuplicateSongError(existingSong);
  }

  let artistName: string | null = null;
  let songTitle: string | null = null;

  try {
    const oembed = await fetchYouTubeOEmbed(videoId);
    if (oembed) {
      const parsed = parseYouTubeTitle(oembed.title, oembed.authorName);
      artistName = parsed.artistName;
      songTitle = parsed.songTitle;
    }
  } catch (err) {
    console.error("Failed to fetch/parse YouTube metadata on creation:", err);
  }

  const now = new Date();
  const submittedDate = toDateOnlyString(now);
  const { month, year } = getDateParts(submittedDate);

  return createSongRow({
    source: "app",
    airtable_record_id: null,
    submitter_user_id: user.id,
    submitter_name: user.name,
    submitter_email: user.email,
    artist_name: artistName,
    song_title: songTitle,
    description: description || null,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    submitted_date: submittedDate,
    month,
    year,
  });
}

export class DuplicateSongError extends Error {
  constructor(readonly existingSong: Song) {
    super("This YouTube video has already been shared");
    this.name = "DuplicateSongError";
  }
}

const backfillAttemptedVideoIds = new Set<string>();

export async function backfillSongMetadata(songs: Song[]): Promise<void> {
  const toBackfill = songs.filter(
    (s) => s.songTitle === null && !backfillAttemptedVideoIds.has(s.youtubeVideoId)
  );

  if (toBackfill.length === 0) return;

  const pool = getPool();
  console.log(`[BACKFILL] Starting background backfill for ${toBackfill.length} songs`);

  for (const song of toBackfill) {
    backfillAttemptedVideoIds.add(song.youtubeVideoId);

    const dbIdStr = song.id.replace(/^db_/, "");
    const dbId = parseInt(dbIdStr, 10);
    if (isNaN(dbId)) continue;

    try {
      const oembed = await fetchYouTubeOEmbed(song.youtubeVideoId);
      if (oembed) {
        const parsed = parseYouTubeTitle(oembed.title, oembed.authorName);
        await pool.query(
          "UPDATE songs SET artist_name = $1, song_title = $2 WHERE id = $3",
          [parsed.artistName, parsed.songTitle, dbId]
        );
        console.log(`[BACKFILL] Successfully backfilled song ID ${dbId} ("${parsed.songTitle}")`);
      } else {
        console.warn(`[BACKFILL] No oEmbed data returned for video ID ${song.youtubeVideoId}`);
      }
    } catch (err) {
      console.error(`[BACKFILL] Failed to backfill video ID ${song.youtubeVideoId}:`, err);
    }
  }
}
