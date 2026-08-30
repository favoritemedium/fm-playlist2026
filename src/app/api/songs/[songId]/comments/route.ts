import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { getCurrentAppAuth } from "@/lib/auth";
import {
  createSongComment,
  createCommentNotifications,
  fetchSongComments,
  fetchSongEngagementSummary,
  fetchSongSubmitterUserId,
} from "@/lib/engagement-db";
import { publishEngagementEvent } from "@/lib/engagement-events";
import { makeApiError } from "@/lib/api";
import { jsonRouteError, jsonValidationError } from "@/lib/api-route-errors";
import { syncAppUserIdentity } from "@/lib/users-db";
import {
  createSongCommentInputSchema,
  dbSongIdSchema,
} from "@/lib/validation";

interface SongCommentsRouteContext {
  params: Promise<{ songId: string }>;
}

async function parseSongId(context: SongCommentsRouteContext) {
  const { songId } = await context.params;
  return dbSongIdSchema.safeParse(songId);
}

export async function GET(_request: Request, context: SongCommentsRouteContext) {
  try {
    const appAuth = await getCurrentAppAuth();
    const user = appAuth.status === "authenticated" ? appAuth.user : null;

    const parsedSongId = await parseSongId(context);
    if (!parsedSongId.success) {
      return jsonValidationError(
        "Invalid song ID",
        "INVALID_SONG_ID",
        parsedSongId.error.issues
      );
    }

    if (user) {
      await syncAppUserIdentity(user);
    }

    const [comments, summary] = await Promise.all([
      fetchSongComments(parsedSongId.data, user?.id ?? null),
      fetchSongEngagementSummary(parsedSongId.data, user?.id ?? null),
    ]);

    return NextResponse.json({ comments, summary });
  } catch (error) {
    return jsonRouteError(
      error,
      "Failed to fetch song comments:",
      "Failed to fetch song comments",
      "FETCH_SONG_COMMENTS_FAILED"
    );
  }
}

export async function POST(request: Request, context: SongCommentsRouteContext) {
  try {
    const { appAuth, response } = await authorizeApiRequest();
    if (response) return response;

    const parsedSongId = await parseSongId(context);
    if (!parsedSongId.success) {
      return jsonValidationError(
        "Invalid song ID",
        "INVALID_SONG_ID",
        parsedSongId.error.issues
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(makeApiError("Invalid JSON body", "INVALID_JSON"), {
        status: 400,
      });
    }

    const parsedBody = createSongCommentInputSchema.safeParse(body);
    if (!parsedBody.success) {
      return jsonValidationError(
        "Invalid comment",
        "INVALID_COMMENT_INPUT",
        parsedBody.error.issues
      );
    }

    await syncAppUserIdentity(appAuth.user);

    const commentId = await createSongComment({
      songId: parsedSongId.data,
      userId: appAuth.user.id,
      body: parsedBody.data.body,
      parentCommentId: parsedBody.data.parentCommentId,
    });

    const notificationRecipients = await createCommentNotifications({
      songId: parsedSongId.data,
      commentId,
      actorUserId: appAuth.user.id,
      parentCommentId: parsedBody.data.parentCommentId,
    });

    const [comments, summary, submitterUserId] = await Promise.all([
      fetchSongComments(parsedSongId.data, appAuth.user.id),
      fetchSongEngagementSummary(parsedSongId.data, appAuth.user.id),
      fetchSongSubmitterUserId(parsedSongId.data),
    ]);

    await publishEngagementEvent({
      type: "song_engagement_updated",
      songId: summary.songId,
      likeCount: summary.likeCount,
      commentCount: summary.commentCount,
      actorUserId: appAuth.user.id,
    });

    if (submitterUserId && submitterUserId !== appAuth.user.id) {
      await publishEngagementEvent({
        type: "song_comment_notification",
        songId: summary.songId,
        commentId,
        commenterName: appAuth.user.name,
        songSubmitterUserId: submitterUserId,
        recipientUserId: submitterUserId,
        createdAt: new Date().toISOString(),
      });
    }

    for (const recipient of notificationRecipients) {
      if (recipient.userId === submitterUserId) continue;
      await publishEngagementEvent({
        type: "song_comment_notification",
        songId: summary.songId,
        commentId,
        commenterName: appAuth.user.name,
        songSubmitterUserId: submitterUserId || "",
        recipientUserId: recipient.userId,
        notificationType: recipient.type,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ commentId, comments, summary }, { status: 201 });
  } catch (error) {
    return jsonRouteError(
      error,
      "Failed to create song comment:",
      "Failed to create song comment",
      "CREATE_SONG_COMMENT_FAILED"
    );
  }
}
