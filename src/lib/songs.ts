import "server-only";

import type { Song, CreateSongInput } from "@/types/song";
import type { AppUser } from "@/lib/auth";
import {
  fetchAllSongs,
  createSongRow,
  fetchSongByYouTubeVideoId,
} from "./songs-db";
import { getDateParts, toDateOnlyString } from "./dates";
import { syncAppUserIdentity } from "./users-db";
import { extractYouTubeId, fetchYouTubeOEmbed, parseYouTubeTitle } from "./youtube";
import { getPool } from "./db";

export async function getAllSongs(user?: AppUser): Promise<Song[]> {
  if (user) {
    await syncAppUserIdentity(user);
  }

  const dbSongs = await fetchAllSongs(user?.id ?? null);

  // Trigger background backfill if any DB song is missing metadata
  if (dbSongs.some((s) => s.songTitle === null)) {
    backfillSongMetadata(dbSongs).catch((err) => {
      console.error("Background metadata backfill failed:", err);
    });
  }

  return dbSongs;
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
