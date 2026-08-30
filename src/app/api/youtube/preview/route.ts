import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { jsonRouteError, jsonValidationError } from "@/lib/api-route-errors";
import { fetchSongByYouTubeVideoId } from "@/lib/songs-db";
import {
  extractYouTubeId,
  fetchYouTubeOEmbed,
  getYouTubeThumbnailUrl,
  parseYouTubeTitle,
} from "@/lib/youtube";
import { YOUTUBE_URL_MAX_LENGTH } from "@/lib/song-limits";
import { z } from "zod";

const previewSchema = z.object({
  youtubeUrl: z.string().trim().min(1).max(YOUTUBE_URL_MAX_LENGTH),
});

export async function POST(request: Request) {
  try {
    const { response } = await authorizeApiRequest();
    if (response) return response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonValidationError("Invalid JSON body", "INVALID_JSON", []);
    }

    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError("Invalid YouTube URL", "INVALID_YOUTUBE_URL", parsed.error.issues);
    }

    const videoId = extractYouTubeId(parsed.data.youtubeUrl);
    if (!videoId) {
      return jsonValidationError("A valid YouTube URL is required", "INVALID_YOUTUBE_URL", []);
    }

    const [metadata, existingSong] = await Promise.all([
      fetchYouTubeOEmbed(videoId),
      fetchSongByYouTubeVideoId(videoId),
    ]);
    const parsedTitle = metadata ? parseYouTubeTitle(metadata.title, metadata.authorName) : null;

    return NextResponse.json({
      videoId,
      thumbnailUrl: getYouTubeThumbnailUrl(videoId),
      title: parsedTitle?.songTitle || metadata?.title || null,
      artistName: parsedTitle?.artistName || metadata?.authorName || null,
      available: Boolean(metadata),
      duplicate: existingSong
        ? {
            id: existingSong.id,
            title: existingSong.songTitle,
            artistName: existingSong.artistName,
            submitterName: existingSong.submitterName,
          }
        : null,
    });
  } catch (error) {
    return jsonRouteError(error, "Failed to preview YouTube video:", "Failed to preview YouTube video", "PREVIEW_YOUTUBE_FAILED");
  }
}
