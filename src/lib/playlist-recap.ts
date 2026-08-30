import type { Song } from "@/types/song";

export interface SubmitterSummary {
  name: string;
  count: number;
}

export function getTopSubmitters(
  songs: Pick<Song, "submitterName">[],
  limit = 3
): SubmitterSummary[] {
  const submitters = new Map<string, SubmitterSummary>();

  for (const song of songs) {
    const name = song.submitterName.trim();
    if (!name) continue;

    const key = name.toLocaleLowerCase("en-US");
    const existing = submitters.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      submitters.set(key, { name, count: 1 });
    }
  }

  return [...submitters.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, Math.max(0, limit));
}
