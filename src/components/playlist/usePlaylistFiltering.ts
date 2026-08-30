"use client";

import { useCallback, useMemo } from "react";
import type { Song } from "@/types/song";
import {
  getCurrentMonth,
  getCurrentYear,
  isAllFilterValue,
  type PlaylistFilterValue,
} from "@/lib/constants";

interface UsePlaylistFilteringOptions {
  songs: Song[];
  searchQuery: string;
  selectedYear: PlaylistFilterValue;
  selectedMonth: PlaylistFilterValue;
  sortMode?: PlaylistSortMode;
  viewMode?: PlaylistViewMode;
  playedSongIds?: Set<string>;
  currentUserId?: string;
}

export type PlaylistSortMode = "newest" | "most-liked";
export type PlaylistViewMode = "all" | "saved" | "mine" | "played" | "unplayed";

export function sortPlaylistSongs(
  songs: Song[],
  sortMode: PlaylistSortMode
): Song[] {
  if (sortMode !== "most-liked") return songs;

  return [...songs].sort((a, b) => {
    const likeDifference = b.likeCount - a.likeCount;
    if (likeDifference !== 0) return likeDifference;
    return b.submittedDate.localeCompare(a.submittedDate);
  });
}

export function songMatchesMonthYearFilter(
  song: Pick<Song, "month" | "year">,
  selectedYear: PlaylistFilterValue,
  selectedMonth: PlaylistFilterValue
): boolean {
  const matchesYear =
    isAllFilterValue(selectedYear) || song.year === selectedYear;
  const matchesMonth =
    isAllFilterValue(selectedMonth) || song.month === selectedMonth;

  return matchesYear && matchesMonth;
}

export function usePlaylistFiltering({
  songs,
  searchQuery,
  selectedYear,
  selectedMonth,
  sortMode = "newest",
  viewMode = "all",
  playedSongIds = new Set<string>(),
  currentUserId,
}: UsePlaylistFilteringOptions) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const scopedSongs = useMemo(() => {
    if (viewMode === "saved") return songs.filter((song) => song.bookmarked);
    if (viewMode === "mine") return songs.filter((song) => Boolean(currentUserId) && song.submitterUserId === currentUserId);
    if (viewMode === "played") return songs.filter((song) => playedSongIds.has(song.id));
    if (viewMode === "unplayed") return songs.filter((song) => !playedSongIds.has(song.id));
    return songs;
  }, [currentUserId, playedSongIds, songs, viewMode]);

  const searchMatchedSongs = useMemo(() => {
    if (!normalizedQuery) return scopedSongs;

    return scopedSongs.filter(
      (song) =>
        song.submitterName.toLowerCase().includes(normalizedQuery) ||
        (song.songTitle?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (song.artistName?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (song.description?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  }, [normalizedQuery, scopedSongs]);

  const availableYears = useMemo(() => {
    const years = new Set(searchMatchedSongs.map((song) => song.year));
    if (!normalizedQuery) years.add(getCurrentYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [searchMatchedSongs, normalizedQuery]);

  const getAvailableMonthsForYear = useCallback(
    (year: PlaylistFilterValue) => {
      const months = new Set(
        searchMatchedSongs
          .filter((song) => isAllFilterValue(year) || song.year === year)
          .map((song) => song.month)
      );

      if (
        !normalizedQuery &&
        (isAllFilterValue(year) || year === getCurrentYear())
      ) {
        months.add(getCurrentMonth());
      }

      return Array.from(months).sort((a, b) => a - b);
    },
    [searchMatchedSongs, normalizedQuery]
  );

  const availableMonths = useMemo(
    () => getAvailableMonthsForYear(selectedYear),
    [getAvailableMonthsForYear, selectedYear]
  );

  const filteredSongs = useMemo(() => {
    const matches = searchMatchedSongs.filter((song) =>
      songMatchesMonthYearFilter(song, selectedYear, selectedMonth)
    );

    return sortPlaylistSongs(matches, sortMode);
  }, [searchMatchedSongs, selectedYear, selectedMonth, sortMode]);

  return {
    availableYears,
    availableMonths,
    filteredSongs,
    getAvailableMonthsForYear,
  };
}
