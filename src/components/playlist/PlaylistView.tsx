"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import {
  ArrowDownUp,
  Bell,
  X,
  AlertTriangle,
  ListMusic,
  Bookmark,
  User,
  CheckCircle2,
  Sparkles,
  Filter,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { PlaylistSettings } from "./PlaylistSettings";
import { LanguageDropdown } from "./LanguageDropdown";
import type {
  AppNotification,
  Song,
  SongEngagementEvent,
  SongEngagementSummary,
} from "@/types/song";
import {
  ALL_FILTER_VALUE,
  getCurrentMonth,
  getCurrentYear,
  isAllFilterValue,
  type PlaylistFilterValue,
  ALLOWED_EMAIL_DOMAIN,
} from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PlaylistRecap } from "./PlaylistRecap";
import { ActivityPanel } from "./ActivityPanel";
import { MonthYearFilter } from "./MonthYearFilter";
import { SearchBar } from "./SearchBar";
import { VideoPlayer } from "./VideoPlayer";
import { ThumbnailGrid } from "./ThumbnailGrid";
import { AddTrackDialog } from "./AddTrackDialog";
import { EngagementDialog } from "./EngagementDialog";
import { useEngagementEvents } from "./useEngagementEvents";
import {
  usePlaylistFiltering,
  type PlaylistSortMode,
  type PlaylistViewMode,
} from "./usePlaylistFiltering";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLikerInCache } from "@/lib/likers-cache";
import { useTranslations } from "next-intl";

interface PlaylistViewProps {
  initialSongs: Song[];
  user?: {
    id?: string;
    name?: string;
    picture?: string;
    email?: string;
  } | null;
  isForbidden?: boolean;
}

interface SummaryResponse {
  summary: SongEngagementSummary;
}

const AUTOPLAY_STORAGE_KEY = "fm-playlist-autoplay-enabled";
const CONTINUE_PLAYING_STORAGE_KEY = "fm-playlist-continue-playing-enabled";
const PLAYED_SONGS_STORAGE_KEY = "fm-playlist-played-songs";

export function PlaylistView({ initialSongs, user, isForbidden = false }: PlaylistViewProps) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [selectedYear, setSelectedYear] = useState<PlaylistFilterValue>(
    getCurrentYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<PlaylistFilterValue>(
    getCurrentMonth()
  );
  const [sortMode, setSortMode] = useState<PlaylistSortMode>("newest");
  const [viewMode, setViewMode] = useState<PlaylistViewMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [playedSongIds, setPlayedSongIds] = useState<Set<string>>(() => new Set());
  const [activeVideo, setActiveVideo] = useState<Song | null>(null);
  const [engagementSongId, setEngagementSongId] = useState<string | null>(null);
  const [pendingLikeSongIds, setPendingLikeSongIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingBookmarkSongIds, setPendingBookmarkSongIds] = useState<Set<string>>(() => new Set());
  const [engagementError, setEngagementError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [requestedSongId, setRequestedSongId] = useState<string | null>(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [continuePlaying, setContinuePlaying] = useState(false);
  const [shouldAutoplayActiveVideo, setShouldAutoplayActiveVideo] =
    useState(false);
  const t = useTranslations("playlist");
  const tEngagement = useTranslations("engagement");
  const tHome = useTranslations("home");
  const tAuth = useTranslations("auth");

  const {
    availableYears,
    availableMonths,
    filteredSongs,
    getAvailableMonthsForYear,
  } = usePlaylistFiltering({
    songs,
    searchQuery,
    selectedYear,
    selectedMonth,
    sortMode,
    viewMode,
    playedSongIds,
    currentUserId: user?.id,
  });

  useEffect(() => {
    try {
      const savedAutoplay = window.localStorage.getItem(AUTOPLAY_STORAGE_KEY);
      if (savedAutoplay !== null) {
        setAutoplayEnabled(savedAutoplay === "true");
      }
      const savedContinuePlaying = window.localStorage.getItem(CONTINUE_PLAYING_STORAGE_KEY);
      if (savedContinuePlaying !== null) {
        setContinuePlaying(savedContinuePlaying === "true");
      }
      const savedPlayedSongs = window.localStorage.getItem(PLAYED_SONGS_STORAGE_KEY);
      if (savedPlayedSongs) {
        const parsed = JSON.parse(savedPlayedSongs) as unknown;
        if (Array.isArray(parsed)) {
          setPlayedSongIds(new Set(parsed.filter((id): id is string => typeof id === "string")));
        }
      }
    } catch {
      // Ignore unavailable localStorage, such as private browsing restrictions.
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const yearParam = params.get("year");
    const monthParam = params.get("month");
    const year = Number(yearParam);
    const month = Number(monthParam);
    if (yearParam === ALL_FILTER_VALUE || Number.isInteger(year)) {
      setSelectedYear(yearParam === ALL_FILTER_VALUE ? ALL_FILTER_VALUE : year);
    }
    if (monthParam === ALL_FILTER_VALUE || Number.isInteger(month)) {
      setSelectedMonth(monthParam === ALL_FILTER_VALUE ? ALL_FILTER_VALUE : month);
    }
    const sort = params.get("sort");
    if (sort === "newest" || sort === "most-liked") setSortMode(sort);
    const view = params.get("view");
    if (["all", "saved", "mine", "played", "unplayed"].includes(view || "")) {
      setViewMode(view as PlaylistViewMode);
    }
    if (params.get("search")) setSearchQuery(params.get("search") || "");
    setRequestedSongId(params.get("song"));
    setUrlStateReady(true);
  }, []);

  useEffect(() => {
    if (!urlStateReady) return;
    const params = new URLSearchParams();
    params.set("year", selectedYear.toString());
    params.set("month", selectedMonth.toString());
    if (sortMode !== "newest") params.set("sort", sortMode);
    if (viewMode !== "all") params.set("view", viewMode);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (activeVideo?.id || requestedSongId) params.set("song", activeVideo?.id || requestedSongId || "");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeVideo?.id, requestedSongId, searchQuery, selectedMonth, selectedYear, sortMode, urlStateReady, viewMode]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    fetch("/api/notifications")
      .then((response) => response.json() as Promise<{ notifications?: AppNotification[] }>)
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!requestedSongId) return;
    const requested = songs.find((song) => song.id === requestedSongId);
    if (requested) {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("year")) setSelectedYear(requested.year);
      if (!params.has("month")) setSelectedMonth(requested.month);
      setActiveVideo(requested);
      setRequestedSongId(null);
    }
  }, [requestedSongId, songs]);

  // Keep year and month selection valid as the search result set changes.
  useEffect(() => {
    let nextYear = selectedYear;
    let nextMonth = selectedMonth;

    if (!isAllFilterValue(selectedYear) && !availableYears.includes(selectedYear)) {
      nextYear = ALL_FILTER_VALUE;
      nextMonth = ALL_FILTER_VALUE;
    }

    const monthsForYear = getAvailableMonthsForYear(nextYear);
    if (!isAllFilterValue(nextMonth) && !monthsForYear.includes(nextMonth)) {
      nextMonth = ALL_FILTER_VALUE;
    }

    if (nextYear !== selectedYear) {
      setSelectedYear(nextYear);
    }

    if (nextMonth !== selectedMonth) {
      setSelectedMonth(nextMonth);
    }
  }, [
    availableYears,
    getAvailableMonthsForYear,
    selectedMonth,
    selectedYear,
  ]);

  // Auto-select first video when filter changes
  const currentActive = useMemo(() => {
    if (activeVideo) {
      const visibleActive = filteredSongs.find((s) => s.id === activeVideo.id);
      if (visibleActive) return visibleActive;
    }
    return filteredSongs[0] || null;
  }, [filteredSongs, activeVideo]);

  const engagementSong = useMemo(() => {
    if (!engagementSongId) return null;
    return songs.find((song) => song.id === engagementSongId) ?? null;
  }, [engagementSongId, songs]);

  const applyEngagementSummary = useCallback(
    (summary: SongEngagementSummary) => {
      setSongs((currentSongs) =>
        currentSongs.map((song) =>
          song.id === summary.songId
            ? song.likeCount === summary.likeCount &&
              song.commentCount === summary.commentCount &&
              song.userLiked === summary.userLiked
              ? song
              : {
                ...song,
                likeCount: summary.likeCount,
                commentCount: summary.commentCount,
                userLiked: summary.userLiked,
              }
            : song
        )
      );
    },
    []
  );

  const applyEngagementEvent = useCallback(
    (event: SongEngagementEvent) => {
      if (event.type === "song_engagement_updated") {
        setSongs((currentSongs) =>
          currentSongs.map((song) => {
            if (song.id !== event.songId) return song;

            const userLiked =
              event.actorUserId &&
              event.actorUserId === user?.id &&
              typeof event.actorLiked === "boolean"
                ? event.actorLiked
                : song.userLiked;

            return {
              ...song,
              likeCount: event.likeCount,
              commentCount: event.commentCount,
              userLiked,
            };
          })
        );
        return;
      }

      const notification: AppNotification = {
        id: Number(`${event.commentId}`),
        type: event.notificationType || "comment",
        songId: event.songId,
        commentId: event.commentId,
        songTitle: null,
        actorName: event.commenterName,
        createdAt: event.createdAt,
        readAt: null,
      };

      setNotifications((current) => {
        if (current.some((item) => item.commentId === notification.commentId && item.songId === notification.songId)) return current;
        return [notification, ...current].slice(0, 3);
      });
    },
    [user?.id]
  );

  useEngagementEvents(user ? applyEngagementEvent : null);

  const setBookmarkPending = useCallback((songId: string, pending: boolean) => {
    setPendingBookmarkSongIds((current) => {
      const next = new Set(current);
      if (pending) next.add(songId);
      else next.delete(songId);
      return next;
    });
  }, []);

  const handleBookmarkToggle = useCallback(async (song: Song) => {
    if (!user || pendingBookmarkSongIds.has(song.id)) return;
    const nextBookmarked = !song.bookmarked;
    setSongs((current) => current.map((item) => item.id === song.id ? { ...item, bookmarked: nextBookmarked } : item));
    setBookmarkPending(song.id, true);
    try {
      const response = await fetch(`/api/songs/${song.id}/bookmark`, { method: nextBookmarked ? "POST" : "DELETE" });
      if (!response.ok) throw new Error(t("errors.failedToSave"));
    } catch (error) {
      setSongs((current) => current.map((item) => item.id === song.id ? { ...item, bookmarked: song.bookmarked } : item));
      setEngagementError(error instanceof Error ? error.message : t("errors.failedToSave"));
    } finally {
      setBookmarkPending(song.id, false);
    }
  }, [pendingBookmarkSongIds, setBookmarkPending, t, user]);

  const setLikePending = useCallback((songId: string, pending: boolean) => {
    setPendingLikeSongIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(songId);
      } else {
        next.delete(songId);
      }
      return next;
    });
  }, []);

  const handleLikeToggle = useCallback(
    async (song: Song) => {
      if (!user || pendingLikeSongIds.has(song.id)) return;

      const nextLiked = !song.userLiked;
      const previousSummary: SongEngagementSummary = {
        songId: song.id,
        likeCount: song.likeCount,
        commentCount: song.commentCount,
        userLiked: song.userLiked,
      };

      applyEngagementSummary({
        ...previousSummary,
        likeCount: Math.max(0, song.likeCount + (nextLiked ? 1 : -1)),
        userLiked: nextLiked,
      });

      if (user) {
        updateLikerInCache(
          song.id,
          {
            id: user.id || "",
            name: user.name || "",
            email: user.email || "",
            picture: user.picture || null,
          },
          nextLiked
        );
      }

      setLikePending(song.id, true);
      setEngagementError(null);

      try {
        const response = await fetch(`/api/songs/${song.id}/likes`, {
          method: nextLiked ? "POST" : "DELETE",
        });
        const data = (await response.json()) as unknown;

        if (!response.ok) {
          const message =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Failed to update like";
          throw new Error(message);
        }

        applyEngagementSummary((data as SummaryResponse).summary);
      } catch (err) {
        applyEngagementSummary(previousSummary);
        if (user) {
          updateLikerInCache(
            song.id,
            {
              id: user.id || "",
              name: user.name || "",
              email: user.email || "",
              picture: user.picture || null,
            },
            !nextLiked
          );
        }
        setEngagementError(
          err instanceof Error ? err.message : tEngagement("errors.failedToUpdateLike")
        );
      } finally {
        setLikePending(song.id, false);
      }
    },
    [applyEngagementSummary, pendingLikeSongIds, setLikePending, user, tEngagement]
  );

  useEffect(() => {
    if (!activeVideo) return;

    const activeVideoIsVisible = filteredSongs.some(
      (song) => song.id === activeVideo.id
    );

    if (!activeVideoIsVisible) {
      setShouldAutoplayActiveVideo(false);
    }
  }, [activeVideo, filteredSongs]);

  const handleAutoplayToggle = useCallback(() => {
    setAutoplayEnabled((currentValue) => {
      const nextValue = !currentValue;
      try {
        window.localStorage.setItem(
          AUTOPLAY_STORAGE_KEY,
          nextValue ? "true" : "false"
        );
      } catch {
        // Ignore unavailable localStorage, such as private browsing restrictions.
      }
      return nextValue;
    });
  }, []);

  const handleContinuePlayingToggle = useCallback(() => {
    setContinuePlaying((currentValue) => {
      const nextValue = !currentValue;
      try {
        window.localStorage.setItem(
          CONTINUE_PLAYING_STORAGE_KEY,
          nextValue ? "true" : "false"
        );
      } catch {
        // Ignore unavailable localStorage, such as private browsing restrictions.
      }
      return nextValue;
    });
  }, []);

  const handleVideoEnd = useCallback(() => {
    if (!continuePlaying || filteredSongs.length === 0) return;

    const currentIndex = filteredSongs.findIndex(
      (song) => song.id === currentActive?.id
    );

    if (currentIndex !== -1 && currentIndex + 1 < filteredSongs.length) {
      const nextSong = filteredSongs[currentIndex + 1];
      setActiveVideo(nextSong);
      setShouldAutoplayActiveVideo(true);
    }
  }, [continuePlaying, filteredSongs, currentActive]);

  const handleYearChange = useCallback(
    (year: PlaylistFilterValue) => {
      setSelectedYear(year);

      if (isAllFilterValue(year)) {
        setSelectedMonth(ALL_FILTER_VALUE);
      } else if (!isAllFilterValue(selectedMonth)) {
        const monthsForYear = getAvailableMonthsForYear(year);
        setSelectedMonth(
          monthsForYear[monthsForYear.length - 1] ?? ALL_FILTER_VALUE
        );
      }

      setActiveVideo(null);
      setShouldAutoplayActiveVideo(false);
    },
    [getAvailableMonthsForYear, selectedMonth]
  );

  const handleMonthChange = useCallback((month: PlaylistFilterValue) => {
    setSelectedMonth(month);
    setShouldAutoplayActiveVideo(false);
  }, []);

  const handleSongSelect = useCallback(
    (song: Song) => {
      setActiveVideo(song);
      setShouldAutoplayActiveVideo(autoplayEnabled);
      setPlayedSongIds((current) => {
        if (current.has(song.id)) return current;
        const next = new Set(current).add(song.id);
        try {
          window.localStorage.setItem(PLAYED_SONGS_STORAGE_KEY, JSON.stringify(Array.from(next).slice(-200)));
        } catch {
          // Ignore unavailable localStorage.
        }
        return next;
      });
    },
    [autoplayEnabled]
  );

  const handleTrackAdded = useCallback((song: Song) => {
    setSongs((prev) => [song, ...prev]);
    setSelectedYear(song.year);
    setSelectedMonth(song.month);
    setActiveVideo(song);
    setShouldAutoplayActiveVideo(false);
  }, []);

  const handleOpenEngagement = useCallback((song: Song) => {
    setEngagementSongId(song.id);
  }, []);

  const handleShare = useCallback(async (song: Song) => {
    const url = new URL(window.location.href);
    url.searchParams.set("song", song.id);
    try {
      if (navigator.share) await navigator.share({ title: song.songTitle || "FM Playlist", url: url.toString() });
      else await navigator.clipboard.writeText(url.toString());
      setShareNotice(t("shareCopied"));
      window.setTimeout(() => setShareNotice(null), 2500);
    } catch {
      // Ignore cancelled native shares.
    }
  }, [t]);

  const handleNotificationOpen = useCallback(
    (notification: AppNotification) => {
      const song = songs.find((item) => item.id === notification.songId);
      if (!song) return;

      setSelectedYear(song.year);
      setSelectedMonth(song.month);
      setActiveVideo(song);
      setShouldAutoplayActiveVideo(false);
      setEngagementSongId(song.id);
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id)
      );
    },
    [songs]
  );

  const dismissNotification = useCallback((notificationId: number) => {
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notificationId }),
    });
    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId)
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Header
          user={user}
          settings={
            <div className="flex items-center gap-2">
              <LanguageDropdown />
              <PlaylistSettings
                startPlayingWhenSelected={autoplayEnabled}
                onStartPlayingWhenSelectedChange={handleAutoplayToggle}
                continuePlayingPlaylist={continuePlaying}
                onContinuePlayingPlaylistChange={handleContinuePlayingToggle}
              />
            </div>
          }
        />

        {isForbidden && (
          <Alert
            variant="destructive"
            className="border-2 border-destructive bg-destructive/5 text-left mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl shadow-lg"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <AlertTitle className="text-sm font-black text-destructive leading-tight mb-0.5">
                  {tHome("auth.notAllowedTitle")}
                </AlertTitle>
                <AlertDescription className="text-xs font-semibold text-destructive/80 leading-normal">
                  {tHome("auth.notAllowedDescription", { domain: ALLOWED_EMAIL_DOMAIN })}
                </AlertDescription>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 self-end md:self-center">
              <SignOutButton>
                <Button size="sm" className="bg-destructive hover:bg-destructive/90 text-white font-bold text-xs py-1 h-8 rounded-xl cursor-pointer shadow-lg shadow-destructive/20">
                  {tAuth("signOut")}
                </Button>
              </SignOutButton>
            </div>
          </Alert>
        )}

        {/* Unified Discovery Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 sm:mb-8 rounded-2xl bg-white/90 border border-border/80 shadow-sm backdrop-blur-md p-2.5 sm:p-2.5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-2">
            
            {/* Search Input: Full width on mobile, compact on desktop */}
            <div className="w-full lg:w-72 xl:w-80 lg:order-2">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Filter Controls: 2x2 Grid on Mobile (<sm), Flex-Row on Tablet/Desktop (sm+) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 flex-1 min-w-0 lg:order-1">
              
              {/* Date Filter */}
              <div className="col-span-1 sm:w-auto min-w-0">
                <MonthYearFilter
                  availableYears={availableYears}
                  availableMonths={availableMonths}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onYearChange={handleYearChange}
                  onMonthChange={handleMonthChange}
                />
              </div>

              {/* View Mode Filter */}
              <div className="col-span-1 flex items-center justify-between gap-1.5 bg-neutral-100/80 hover:bg-neutral-100 px-2.5 rounded-xl border border-border/60 transition-colors h-9 min-w-0">
                <Filter className="size-3.5 text-secondary shrink-0" strokeWidth={2.5} />
                <Select value={viewMode} onValueChange={(value) => setViewMode(value as PlaylistViewMode)}>
                  <SelectTrigger
                    aria-label={t("view.ariaLabel")}
                    className="h-7 border-0 bg-transparent px-1 text-xs font-bold shadow-none hover:text-primary focus:ring-0 w-full justify-between sm:w-auto"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-1.5">
                        <ListMusic className="size-3.5 text-secondary" />
                        <span>{t("view.all")}</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="saved">
                      <span className="flex items-center gap-1.5">
                        <Bookmark className="size-3.5 text-primary" />
                        <span>{t("view.saved")}</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="mine">
                      <span className="flex items-center gap-1.5">
                        <User className="size-3.5 text-secondary" />
                        <span>{t("view.mine")}</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="played">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>{t("view.played")}</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="unplayed">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-500" />
                        <span>{t("view.unplayed")}</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Mode Filter */}
              <div className="col-span-1 flex items-center justify-between gap-1.5 bg-neutral-100/80 hover:bg-neutral-100 px-2.5 rounded-xl border border-border/60 transition-colors h-9 min-w-0">
                <ArrowDownUp className="size-3.5 text-secondary shrink-0" strokeWidth={2.5} />
                <Select
                  value={sortMode}
                  onValueChange={(value) => setSortMode(value as PlaylistSortMode)}
                >
                  <SelectTrigger
                    aria-label={t("sort.ariaLabel")}
                    className="h-7 border-0 bg-transparent px-1 text-xs font-bold shadow-none hover:text-primary focus:ring-0 w-full justify-between sm:w-auto"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{t("sort.newest")}</SelectItem>
                    <SelectItem value="most-liked">{t("sort.mostLiked")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Add Track stays with the filters so tablet layouts do not strand it on its own row. */}
              <div className="col-span-1 shrink-0">
                <AddTrackDialog
                  onTrackAdded={handleTrackAdded}
                  isLoggedIn={Boolean(user) && !isForbidden}
                />
              </div>

            </div>

          </div>
        </motion.div>

        {(engagementError || shareNotice || notifications.length > 0) && (
          <div className="mb-8 space-y-3" aria-live="polite">
            {engagementError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                <span>{engagementError}</span>
                <button
                  type="button"
                  aria-label={t("notification.dismissError")}
                  title={t("notification.dismissError")}
                  onClick={() => setEngagementError(null)}
                  className="rounded-md p-1 hover:bg-destructive/10"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            {shareNotice && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                {shareNotice}
              </div>
            )}
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleNotificationOpen(notification)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Bell className="size-5 shrink-0 text-secondary" />
                  <span className="truncate text-sm font-bold text-foreground">
                    {notification.type === "reply"
                      ? t("notification.newReply", { name: notification.actorName })
                      : t("notification.newComment", { name: notification.actorName })}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t("notification.dismissNotification")}
                  title={t("notification.dismissNotification")}
                  onClick={() => dismissNotification(notification.id)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary/10 hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Playlist */}
        {filteredSongs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <h3 className="text-3xl font-black mb-3 text-foreground">
              {searchQuery ? t("empty.noMatchingTitle") : t("empty.noTracksTitle")}
            </h3>
            <p className="text-lg text-muted-foreground mb-8 font-medium">
              {searchQuery
                ? t("empty.noMatchingDescription")
                : t("empty.noTracksDescription")}
            </p>
            {!searchQuery && (
              <div className="flex justify-center">
                <AddTrackDialog onTrackAdded={handleTrackAdded} isLoggedIn={Boolean(user)} />
              </div>
            )}
          </motion.div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <PlaylistRecap songs={filteredSongs} onSelectSong={handleSongSelect} />
            {currentActive && (
              <VideoPlayer
                song={currentActive}
                autoplay={
                  shouldAutoplayActiveVideo &&
                  activeVideo?.id === currentActive.id
                }
                isLikePending={pendingLikeSongIds.has(currentActive.id)}
                isLoggedIn={Boolean(user) && !isForbidden}
                onLikeToggle={handleLikeToggle}
                onOpenEngagement={handleOpenEngagement}
                onVideoEnd={handleVideoEnd}
                isBookmarked={currentActive.bookmarked}
                isBookmarkPending={pendingBookmarkSongIds.has(currentActive.id)}
                onBookmarkToggle={handleBookmarkToggle}
                onShare={handleShare}
              />
            )}
            <ActivityPanel
              onSelectSong={(songId) => {
                const song = songs.find((item) => item.id === songId);
                if (!song) return;
                setSelectedYear(song.year);
                setSelectedMonth(song.month);
                handleSongSelect(song);
              }}
            />
            <ThumbnailGrid
              songs={filteredSongs}
              activeVideoId={currentActive?.id || null}
              playedSongIds={playedSongIds}
              onSelect={handleSongSelect}
              isLoggedIn={Boolean(user) && !isForbidden}
              pendingBookmarkSongIds={pendingBookmarkSongIds}
              onBookmarkToggle={handleBookmarkToggle}
            />
          </div>
        )}

        <Footer
          trackCount={filteredSongs.length}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
        <EngagementDialog
          song={engagementSong}
          open={Boolean(engagementSong)}
          isLikePending={
            engagementSong ? pendingLikeSongIds.has(engagementSong.id) : false
          }
          isLoggedIn={Boolean(user) && !isForbidden}
          onOpenChange={(open) => {
            if (!open) setEngagementSongId(null);
          }}
          onLikeToggle={handleLikeToggle}
          onSummaryChange={applyEngagementSummary}
        />
      </div>
    </div>
  );
}
