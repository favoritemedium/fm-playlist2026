import "server-only";

import type { AppNotification } from "@/types/song";
import { ensureSchema, getPool } from "./db";

interface NotificationRow {
  id: number;
  type: "comment" | "reply";
  song_id: number;
  song_title: string | null;
  actor_name: string;
  comment_id: number | null;
  created_at: string | Date;
  read_at: string | Date | null;
}

function iso(value: string | Date | null): string | null {
  return value === null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    songId: `db_${row.song_id}`,
    songTitle: row.song_title,
    actorName: row.actor_name,
    commentId: row.comment_id,
    createdAt: iso(row.created_at) as string,
    readAt: iso(row.read_at),
  };
}

export async function fetchNotifications(
  userId: string,
  limit = 20
): Promise<AppNotification[]> {
  await ensureSchema();
  const result = await getPool().query<NotificationRow>(
    `SELECT n.id, n.type, n.song_id, s.song_title,
       COALESCE(actor.name, 'Someone') AS actor_name,
       n.comment_id, n.created_at, n.read_at
     FROM app_notifications n
     JOIN songs s ON s.id = n.song_id
     LEFT JOIN app_users actor ON actor.clerk_user_id = n.actor_user_id
     WHERE n.recipient_user_id = $1 AND n.read_at IS NULL
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(toNotification);
}

export async function markNotificationRead(
  userId: string,
  notificationId: number | null
): Promise<void> {
  await ensureSchema();
  if (notificationId === null) {
    await getPool().query(
      `UPDATE app_notifications SET read_at = COALESCE(read_at, now())
       WHERE recipient_user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return;
  }

  await getPool().query(
    `UPDATE app_notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND recipient_user_id = $2`,
    [notificationId, userId]
  );
}
