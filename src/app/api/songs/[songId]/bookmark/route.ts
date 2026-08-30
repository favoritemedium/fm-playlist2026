import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { jsonRouteError, jsonValidationError } from "@/lib/api-route-errors";
import { setSongBookmarked } from "@/lib/songs-db";
import { dbSongIdSchema } from "@/lib/validation";

interface BookmarkRouteContext {
  params: Promise<{ songId: string }>;
}

async function parseSongId(context: BookmarkRouteContext) {
  const { songId } = await context.params;
  return dbSongIdSchema.safeParse(songId);
}

async function updateBookmark(
  context: BookmarkRouteContext,
  bookmarked: boolean
) {
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

  const result = await setSongBookmarked(
    parsedSongId.data,
    appAuth.user.id,
    bookmarked
  );
  return NextResponse.json({ bookmarked: result });
}

export async function POST(_request: Request, context: BookmarkRouteContext) {
  try {
    return await updateBookmark(context, true);
  } catch (error) {
    return jsonRouteError(
      error,
      "Failed to save song:",
      "Failed to save song",
      "SAVE_SONG_FAILED"
    );
  }
}

export async function DELETE(_request: Request, context: BookmarkRouteContext) {
  try {
    return await updateBookmark(context, false);
  } catch (error) {
    return jsonRouteError(
      error,
      "Failed to remove saved song:",
      "Failed to remove saved song",
      "REMOVE_SAVED_SONG_FAILED"
    );
  }
}
