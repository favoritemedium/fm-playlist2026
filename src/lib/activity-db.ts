import "server-only";

import type { ActivityItem } from "@/types/song";
import { ensureSchema, getPool } from "./db";

interface ActivityRow {
  id: string;
  type: ActivityItem["type"];
  song_id: number;
  song_title: string | null;
  actor_name: string;
  occurred_at: string | Date;
}

export async function fetchRecentActivity(limit = 20): Promise<ActivityItem[]> {
  await ensureSchema();
  const result = await getPool().query<ActivityRow>(
    `SELECT activity.id, activity.type, activity.song_id, activity.song_title,
       activity.actor_name, activity.occurred_at
     FROM (
       SELECT 'submission'::text AS type, 'submission-' || s.id::text AS id,
         s.id AS song_id, s.song_title, s.submitter_name AS actor_name, s.created_at AS occurred_at
       FROM songs s
       UNION ALL
       SELECT 'like'::text, 'like-' || l.song_id::text || '-' || l.user_id,
         l.song_id, s.song_title, u.name, l.created_at
       FROM song_likes l
       JOIN songs s ON s.id = l.song_id
       JOIN app_users u ON u.clerk_user_id = l.user_id
       UNION ALL
       SELECT CASE WHEN c.parent_comment_id IS NULL THEN 'comment' ELSE 'reply' END,
         'comment-' || c.id::text, c.song_id, s.song_title, u.name, c.created_at
       FROM song_comments c
       JOIN songs s ON s.id = c.song_id
       JOIN app_users u ON u.clerk_user_id = c.user_id
     ) activity
     ORDER BY activity.occurred_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    songId: `db_${row.song_id}`,
    songTitle: row.song_title,
    actorName: row.actor_name,
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : new Date(row.occurred_at).toISOString(),
  }));
}
