import "server-only";

import type {
  EngagementUser,
  SongComment,
  SongCommentReply,
  SongEngagementSummary,
  SongLiker,
} from "@/types/song";
import { SONG_COMMENT_RATE_LIMIT_COUNT } from "@/lib/song-limits";
import { ensureSchema, getPool } from "./db";

export class EngagementError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: string[]
  ) {
    super(message);
    this.name = "EngagementError";
  }
}

interface EngagementUserRow {
  clerk_user_id: string;
  name: string;
  email: string;
  picture: string | null;
}

interface LikerRow extends EngagementUserRow {
  liked_at: string | Date;
}

interface CommentRow extends EngagementUserRow {
  id: number;
  song_id: number;
  parent_comment_id: number | null;
  user_id: string;
  body: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface SummaryRow {
  song_id: number;
  like_count: number | string;
  comment_count: number | string;
  user_liked: boolean;
}

interface SongOwnerRow {
  submitter_user_id: string | null;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSongId(songId: number): string {
  return `db_${songId}`;
}

function toEngagementUser(row: EngagementUserRow): EngagementUser {
  return {
    id: row.clerk_user_id,
    name: row.name,
    email: row.email,
    picture: row.picture,
  };
}

function compareNewestFirst(
  a: { createdAt: string },
  b: { createdAt: string }
): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

async function ensureSongExists(songId: number): Promise<void> {
  const result = await getPool().query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM songs WHERE id = $1) AS exists",
    [songId]
  );

  if (!result.rows[0]?.exists) {
    throw new EngagementError("Song not found", "SONG_NOT_FOUND", 404);
  }
}

export async function fetchSongSubmitterUserId(
  songId: number
): Promise<string | null> {
  await ensureSchema();

  const result = await getPool().query<SongOwnerRow>(
    "SELECT submitter_user_id FROM songs WHERE id = $1",
    [songId]
  );

  if (!result.rows[0]) {
    throw new EngagementError("Song not found", "SONG_NOT_FOUND", 404);
  }

  return result.rows[0].submitter_user_id;
}

export async function fetchSongEngagementSummary(
  songId: number,
  currentUserId: string | null = null
): Promise<SongEngagementSummary> {
  await ensureSchema();

  const result = await getPool().query<SummaryRow>(
    `SELECT s.id AS song_id,
       COALESCE(l.like_count, 0)::int AS like_count,
       COALESCE(c.comment_count, 0)::int AS comment_count,
       (
         $2::text IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM song_likes ul
           WHERE ul.song_id = s.id AND ul.user_id = $2
         )
       ) AS user_liked
     FROM songs s
     LEFT JOIN (
       SELECT song_id, count(*)::int AS like_count
       FROM song_likes
       WHERE song_id = $1
       GROUP BY song_id
     ) l ON l.song_id = s.id
     LEFT JOIN (
       SELECT song_id, count(*)::int AS comment_count
       FROM song_comments
       WHERE song_id = $1
       GROUP BY song_id
     ) c ON c.song_id = s.id
     WHERE s.id = $1`,
    [songId, currentUserId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new EngagementError("Song not found", "SONG_NOT_FOUND", 404);
  }

  return {
    songId: toSongId(row.song_id),
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    userLiked: Boolean(row.user_liked),
  };
}

export async function fetchSongLikers(songId: number): Promise<SongLiker[]> {
  await ensureSchema();
  await ensureSongExists(songId);

  const result = await getPool().query<LikerRow>(
    `SELECT u.clerk_user_id, u.name, u.email, u.picture, l.created_at AS liked_at
     FROM song_likes l
     JOIN app_users u ON u.clerk_user_id = l.user_id
     WHERE l.song_id = $1
     ORDER BY l.created_at DESC, u.name ASC`,
    [songId]
  );

  return result.rows.map((row) => ({
    user: toEngagementUser(row),
    likedAt: toIsoString(row.liked_at),
  }));
}

export async function setSongLiked(
  songId: number,
  userId: string,
  liked: boolean
): Promise<SongEngagementSummary> {
  await ensureSchema();
  await ensureSongExists(songId);

  if (liked) {
    await getPool().query(
      `INSERT INTO song_likes (song_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (song_id, user_id) DO NOTHING`,
      [songId, userId]
    );
  } else {
    await getPool().query(
      "DELETE FROM song_likes WHERE song_id = $1 AND user_id = $2",
      [songId, userId]
    );
  }

  return fetchSongEngagementSummary(songId, userId);
}

export async function fetchSongComments(
  songId: number,
  currentUserId: string | null = null
): Promise<SongComment[]> {
  await ensureSchema();
  await ensureSongExists(songId);

  const result = await getPool().query<CommentRow>(
    `SELECT c.id, c.song_id, c.parent_comment_id, c.user_id, c.body,
       c.created_at, c.updated_at,
       u.clerk_user_id, u.name, u.email, u.picture
     FROM song_comments c
     JOIN app_users u ON u.clerk_user_id = c.user_id
     WHERE c.song_id = $1
     ORDER BY COALESCE(c.parent_comment_id, c.id),
       c.parent_comment_id NULLS FIRST,
       c.created_at ASC,
       c.id ASC`,
    [songId]
  );

  const topLevelComments = new Map<number, SongComment>();
  const replyRows: CommentRow[] = [];

  for (const row of result.rows) {
    const canModify = currentUserId !== null && row.user_id === currentUserId;

    if (row.parent_comment_id === null) {
      topLevelComments.set(row.id, {
        id: row.id,
        songId: toSongId(row.song_id),
        parentCommentId: null,
        body: row.body,
        author: toEngagementUser(row),
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at),
        canEdit: canModify,
        canDelete: canModify,
        replies: [],
      });
    } else {
      replyRows.push(row);
    }
  }

  for (const row of replyRows) {
    const parent = topLevelComments.get(row.parent_comment_id ?? 0);
    if (!parent || row.parent_comment_id === null) continue;

    const canModify = row.user_id === currentUserId;
    const reply: SongCommentReply = {
      id: row.id,
      songId: toSongId(row.song_id),
      parentCommentId: row.parent_comment_id,
      body: row.body,
      author: toEngagementUser(row),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      canEdit: canModify,
      canDelete: canModify,
    };

    parent.replies.push(reply);
  }

  return Array.from(topLevelComments.values())
    .map((comment) => ({
      ...comment,
      replies: [...comment.replies].sort(compareNewestFirst),
    }))
    .sort(compareNewestFirst);
}

async function assertWithinCommentRateLimit(userId: string): Promise<void> {
  const result = await getPool().query<{ recent_count: number | string }>(
    `SELECT count(*)::int AS recent_count
     FROM song_comments
     WHERE user_id = $1 AND created_at >= now() - interval '1 minute'`,
    [userId]
  );

  if (Number(result.rows[0]?.recent_count ?? 0) >= SONG_COMMENT_RATE_LIMIT_COUNT) {
    throw new EngagementError(
      `You can add up to ${SONG_COMMENT_RATE_LIMIT_COUNT} comments per minute`,
      "COMMENT_RATE_LIMITED",
      429
    );
  }
}

async function assertValidParentComment(
  songId: number,
  parentCommentId: number | null
): Promise<void> {
  if (parentCommentId === null) return;

  const result = await getPool().query<{ id: number }>(
    `SELECT id
     FROM song_comments
     WHERE id = $1 AND song_id = $2 AND parent_comment_id IS NULL`,
    [parentCommentId, songId]
  );

  if (!result.rows[0]) {
    throw new EngagementError(
      "Replies can only be added to top-level comments on this song",
      "INVALID_PARENT_COMMENT",
      400
    );
  }
}

export async function createSongComment(args: {
  songId: number;
  userId: string;
  body: string;
  parentCommentId: number | null;
}): Promise<number> {
  await ensureSchema();
  await ensureSongExists(args.songId);
  await assertWithinCommentRateLimit(args.userId);
  await assertValidParentComment(args.songId, args.parentCommentId);

  const result = await getPool().query<{ id: number }>(
    `INSERT INTO song_comments (song_id, parent_comment_id, user_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [args.songId, args.parentCommentId, args.userId, args.body]
  );

  return result.rows[0].id;
}

export async function createCommentNotifications(args: {
  songId: number;
  commentId: number;
  actorUserId: string;
  parentCommentId: number | null;
}): Promise<Array<{ userId: string; type: "comment" | "reply" }>> {
  await ensureSchema();
  const result = await getPool().query<{
    submitter_user_id: string | null;
    parent_user_id: string | null;
  }>(
    `SELECT s.submitter_user_id,
       parent.user_id AS parent_user_id
     FROM songs s
     LEFT JOIN song_comments parent ON parent.id = $2
     WHERE s.id = $1`,
    [args.songId, args.parentCommentId]
  );

  const row = result.rows[0];
  if (!row) return [];

  const recipients = new Map<string, "comment" | "reply">();
  if (row.submitter_user_id && row.submitter_user_id !== args.actorUserId) {
    recipients.set(row.submitter_user_id, "comment");
  }
  if (row.parent_user_id && row.parent_user_id !== args.actorUserId) {
    recipients.set(row.parent_user_id, "reply");
  }

  for (const [recipientUserId, type] of recipients) {
    await getPool().query(
      `INSERT INTO app_notifications
         (recipient_user_id, actor_user_id, song_id, comment_id, type)
       VALUES ($1, $2, $3, $4, $5)`,
      [recipientUserId, args.actorUserId, args.songId, args.commentId, type]
    );
  }

  return Array.from(recipients, ([userId, type]) => ({ userId, type }));
}

async function getCommentOwnership(commentId: number): Promise<{
  songId: number;
  userId: string;
}> {
  const result = await getPool().query<{ song_id: number; user_id: string }>(
    "SELECT song_id, user_id FROM song_comments WHERE id = $1",
    [commentId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new EngagementError("Comment not found", "COMMENT_NOT_FOUND", 404);
  }

  return { songId: row.song_id, userId: row.user_id };
}

function assertCanModifyComment(ownerId: string, currentUserId: string): void {
  if (ownerId !== currentUserId) {
    throw new EngagementError(
      "You can only change your own comments",
      "COMMENT_FORBIDDEN",
      403
    );
  }
}

export async function updateSongComment(args: {
  commentId: number;
  userId: string;
  body: string;
}): Promise<number> {
  await ensureSchema();

  const ownership = await getCommentOwnership(args.commentId);
  assertCanModifyComment(ownership.userId, args.userId);

  await getPool().query(
    "UPDATE song_comments SET body = $1 WHERE id = $2",
    [args.body, args.commentId]
  );

  return ownership.songId;
}

export async function deleteSongComment(args: {
  commentId: number;
  userId: string;
}): Promise<number> {
  await ensureSchema();

  const ownership = await getCommentOwnership(args.commentId);
  assertCanModifyComment(ownership.userId, args.userId);

  await getPool().query("DELETE FROM song_comments WHERE id = $1", [
    args.commentId,
  ]);

  return ownership.songId;
}
