import { z } from "zod";
import {
  SONG_COMMENT_MAX_LENGTH,
  SONG_DESCRIPTION_MAX_LENGTH,
  YOUTUBE_URL_MAX_LENGTH,
} from "@/lib/song-limits";
import { isValidYouTubeUrl } from "@/lib/youtube";

export const createSongInputSchema = z
  .object({
    youtubeUrl: z
      .string({ error: "YouTube URL is required" })
      .trim()
      .min(1, "YouTube URL is required")
      .max(
        YOUTUBE_URL_MAX_LENGTH,
        `YouTube URL must be ${YOUTUBE_URL_MAX_LENGTH} characters or fewer`
      )
      .refine(isValidYouTubeUrl, "A valid YouTube URL is required"),
    description: z
      .string({ error: "Description must be text" })
      .trim()
      .max(
        SONG_DESCRIPTION_MAX_LENGTH,
        `Description must be ${SONG_DESCRIPTION_MAX_LENGTH} characters or fewer`
      )
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    allowDuplicate: z.boolean().optional().default(false),
  })
  .strict();

export type ValidatedCreateSongInput = z.infer<typeof createSongInputSchema>;

export const dbSongIdSchema = z
  .string({ error: "Song ID is required" })
  .regex(/^db_\d+$/, "Song ID must reference a database-backed song")
  .transform((value) => Number(value.slice(3)));

export const positiveIntegerParamSchema = z.coerce
  .number({ error: "ID must be a number" })
  .int("ID must be an integer")
  .positive("ID must be positive");

const commentBodySchema = z
  .string({ error: "Comment must be text" })
  .trim()
  .min(1, "Comment cannot be empty")
  .max(
    SONG_COMMENT_MAX_LENGTH,
    `Comment must be ${SONG_COMMENT_MAX_LENGTH} characters or fewer`
  );

export const createSongCommentInputSchema = z
  .object({
    body: commentBodySchema,
    parentCommentId: z
      .number({ error: "Parent comment ID must be a number" })
      .int("Parent comment ID must be an integer")
      .positive("Parent comment ID must be positive")
      .optional()
      .nullable()
      .transform((value) => value ?? null),
  })
  .strict();

export const updateSongCommentInputSchema = z
  .object({
    body: commentBodySchema,
  })
  .strict();

export type ValidatedCreateSongCommentInput = z.infer<
  typeof createSongCommentInputSchema
>;
export type ValidatedUpdateSongCommentInput = z.infer<
  typeof updateSongCommentInputSchema
>;
