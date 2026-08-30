import "server-only";

import type { Song } from "@/types/song";
import { toDateOnlyString } from "./dates";
import { ensureSchema, getPool } from "./db";

export interface SongRow {
  id: number;
  source: string;
  airtable_record_id: string | null;
  submitter_user_id: string | null;
  submitter_name: string;
  submitter_email: string | null;
  artist_name: string | null;
  song_title: string | null;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  submitted_date: string | Date;
  month: number;
  year: number;
  like_count?: number | string;
  comment_count?: number | string;
  user_liked?: boolean;
  bookmarked?: boolean;
}

export interface SongInsert {
  source: string;
  airtable_record_id: string | null;
  submitter_user_id: string | null;
  submitter_name: string;
  submitter_email: string | null;
  artist_name: string | null;
  song_title: string | null;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  submitted_date: string;
  month: number;
  year: number;
}

function toSongSource(source: string): Song["source"] {
  if (source === "airtable" || source === "app") {
    return source;
  }

  throw new Error(`Invalid song source in database: ${source}`);
}

function rowToSong(row: SongRow): Song {
  return {
    id: `db_${row.id}`,
    source: toSongSource(row.source),
    airtableRecordId: row.airtable_record_id,
    submitterUserId: row.submitter_user_id,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    artistName: row.artist_name,
    songTitle: row.song_title,
    description: row.description,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    submittedDate: toDateOnlyString(row.submitted_date),
    month: Number(row.month),
    year: Number(row.year),
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    userLiked: Boolean(row.user_liked),
    bookmarked: Boolean(row.bookmarked),
  };
}

const SELECT_COLS = `
  id, source, airtable_record_id, submitter_user_id, submitter_name, submitter_email,
  artist_name, song_title, description, youtube_url, youtube_video_id,
  submitted_date, month, year
`;

const QUALIFIED_SELECT_COLS = `
  s.id, s.source, s.airtable_record_id, s.submitter_user_id, s.submitter_name, s.submitter_email,
  s.artist_name, s.song_title, s.description, s.youtube_url, s.youtube_video_id,
  s.submitted_date, s.month, s.year
`;

export async function fetchAllSongs(currentUserId: string | null = null): Promise<Song[]> {
  await ensureSchema();
  const result = await getPool().query<SongRow>(
    `SELECT ${QUALIFIED_SELECT_COLS},
       COALESCE(l.like_count, 0)::int AS like_count,
       COALESCE(c.comment_count, 0)::int AS comment_count,
       (
         $1::text IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM song_likes ul
           WHERE ul.song_id = s.id AND ul.user_id = $1
         )
       ) AS user_liked,
       (
         $1::text IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM song_bookmarks ub
           WHERE ub.song_id = s.id AND ub.user_id = $1
         )
       ) AS bookmarked
     FROM songs s
     LEFT JOIN (
       SELECT song_id, count(*)::int AS like_count
       FROM song_likes
       GROUP BY song_id
     ) l ON l.song_id = s.id
     LEFT JOIN (
       SELECT song_id, count(*)::int AS comment_count
       FROM song_comments
       GROUP BY song_id
     ) c ON c.song_id = s.id
     ORDER BY s.submitted_date DESC, s.id DESC`,
    [currentUserId]
  );
  return result.rows.map(rowToSong);
}

export async function fetchSongByYouTubeVideoId(
  youtubeVideoId: string,
  currentUserId: string | null = null
): Promise<Song | null> {
  await ensureSchema();
  const result = await getPool().query<SongRow>(
    `SELECT ${QUALIFIED_SELECT_COLS},
       COALESCE(l.like_count, 0)::int AS like_count,
       COALESCE(c.comment_count, 0)::int AS comment_count,
       ($2::text IS NOT NULL AND EXISTS (
         SELECT 1 FROM song_likes ul WHERE ul.song_id = s.id AND ul.user_id = $2
       )) AS user_liked,
       ($2::text IS NOT NULL AND EXISTS (
         SELECT 1 FROM song_bookmarks ub WHERE ub.song_id = s.id AND ub.user_id = $2
       )) AS bookmarked
     FROM songs s
     LEFT JOIN (SELECT song_id, count(*)::int AS like_count FROM song_likes GROUP BY song_id) l
       ON l.song_id = s.id
     LEFT JOIN (SELECT song_id, count(*)::int AS comment_count FROM song_comments GROUP BY song_id) c
       ON c.song_id = s.id
     WHERE s.youtube_video_id = $1
     ORDER BY s.id DESC
     LIMIT 1`,
    [youtubeVideoId, currentUserId]
  );

  return result.rows[0] ? rowToSong(result.rows[0]) : null;
}

export async function setSongBookmarked(
  songId: number,
  userId: string,
  bookmarked: boolean
): Promise<boolean> {
  await ensureSchema();
  if (bookmarked) {
    await getPool().query(
      `INSERT INTO song_bookmarks (song_id, user_id)
       VALUES ($1, $2) ON CONFLICT (song_id, user_id) DO NOTHING`,
      [songId, userId]
    );
  } else {
    await getPool().query(
      "DELETE FROM song_bookmarks WHERE song_id = $1 AND user_id = $2",
      [songId, userId]
    );
  }
  return bookmarked;
}

export async function createSongRow(row: SongInsert): Promise<Song> {
  await ensureSchema();
  const result = await getPool().query<SongRow>(
    `INSERT INTO songs (
       source, airtable_record_id, submitter_user_id, submitter_name, submitter_email,
       artist_name, song_title, description, youtube_url, youtube_video_id,
       submitted_date, month, year
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING ${SELECT_COLS}`,
    [
      row.source,
      row.airtable_record_id,
      row.submitter_user_id,
      row.submitter_name,
      row.submitter_email,
      row.artist_name,
      row.song_title,
      row.description,
      row.youtube_url,
      row.youtube_video_id,
      row.submitted_date,
      row.month,
      row.year,
    ]
  );
  return rowToSong(result.rows[0]);
}
