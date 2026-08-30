import { describe, expect, it } from "vitest";
import {
  SONG_COMMENT_MAX_LENGTH,
  SONG_DESCRIPTION_MAX_LENGTH,
} from "./song-limits";
import {
  createSongCommentInputSchema,
  createSongInputSchema,
  dbSongIdSchema,
  updateSongCommentInputSchema,
} from "./validation";

describe("createSongInputSchema", () => {
  it("accepts and trims valid song submissions", () => {
    const result = createSongInputSchema.safeParse({
      youtubeUrl: " https://youtu.be/dQw4w9WgXcQ ",
      description: "  A classic  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
        description: "A classic",
        allowDuplicate: false,
      });
    }
  });

  it("normalizes blank descriptions to undefined", () => {
    const result = createSongInputSchema.safeParse({
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      description: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
    }
  });

  it("rejects invalid URLs and overlong descriptions", () => {
    const result = createSongInputSchema.safeParse({
      youtubeUrl: "https://example.com/youtube.com/watch?v=dQw4w9WgXcQ",
      description: "x".repeat(SONG_DESCRIPTION_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "A valid YouTube URL is required",
          `Description must be ${SONG_DESCRIPTION_MAX_LENGTH} characters or fewer`,
        ])
      );
    }
  });

  it("rejects extra properties", () => {
    const result = createSongInputSchema.safeParse({
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("dbSongIdSchema", () => {
  it("extracts numeric database IDs", () => {
    expect(dbSongIdSchema.parse("db_42")).toBe(42);
  });

  it("rejects non-database song IDs", () => {
    expect(dbSongIdSchema.safeParse("at_rec123").success).toBe(false);
  });
});

describe("comment schemas", () => {
  it("accepts trimmed comments and nullable parent IDs", () => {
    const result = createSongCommentInputSchema.safeParse({
      body: "  Great pick  ",
      parentCommentId: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        body: "Great pick",
        parentCommentId: null,
      });
    }
  });

  it("rejects empty and overlong comments", () => {
    expect(
      updateSongCommentInputSchema.safeParse({ body: "   " }).success
    ).toBe(false);

    const result = updateSongCommentInputSchema.safeParse({
      body: "x".repeat(SONG_COMMENT_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        `Comment must be ${SONG_COMMENT_MAX_LENGTH} characters or fewer`
      );
    }
  });
});
