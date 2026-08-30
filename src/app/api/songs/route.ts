import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { getCurrentAppAuth } from "@/lib/auth";
import { DuplicateSongError, getAllSongs, createSong } from "@/lib/songs";
import { makeApiError } from "@/lib/api";
import { createSongInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const appAuth = await getCurrentAppAuth();
    const user = appAuth.status === "authenticated" ? appAuth.user : null;

    const songs = await getAllSongs(user ?? undefined);
    return NextResponse.json(songs);
  } catch (error) {
    console.error("Failed to fetch songs:", error);
    return NextResponse.json(
      makeApiError("Failed to fetch songs", "FETCH_SONGS_FAILED"),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appAuth, response } = await authorizeApiRequest();
    if (response) return response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        makeApiError("Invalid JSON body", "INVALID_JSON"),
        { status: 400 }
      );
    }

    const parsed = createSongInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        makeApiError(
          "Invalid song submission",
          "INVALID_SONG_INPUT",
          parsed.error.issues.map((issue) => issue.message)
        ),
        { status: 400 }
      );
    }

    const song = await createSong(parsed.data, appAuth.user);
    return NextResponse.json(song, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateSongError) {
      return NextResponse.json(
        makeApiError(error.message, "DUPLICATE_SONG", [
          error.existingSong.id,
          error.existingSong.songTitle || "",
          error.existingSong.submitterName,
        ]),
        { status: 409 }
      );
    }
    console.error("Failed to create song:", error);
    return NextResponse.json(
      makeApiError("Failed to create song", "CREATE_SONG_FAILED"),
      { status: 500 }
    );
  }
}
