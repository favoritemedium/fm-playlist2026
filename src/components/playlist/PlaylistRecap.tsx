"use client";

import { useMemo } from "react";
import { Heart, MessageSquare, Music2, Users, Trophy, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Song } from "@/types/song";

export function PlaylistRecap({
  songs,
  onSelectSong,
}: {
  songs: Song[];
  onSelectSong?: (song: Song) => void;
}) {
  const t = useTranslations("recap");

  const recap = useMemo(() => {
    const contributors = new Set(songs.map((song) => song.submitterName));
    const likes = songs.reduce((total, song) => total + song.likeCount, 0);
    const comments = songs.reduce((total, song) => total + song.commentCount, 0);
    const topTrack = [...songs].sort((a, b) => b.likeCount - a.likeCount)[0];
    return { contributors: contributors.size, likes, comments, topTrack };
  }, [songs]);

  if (songs.length === 0) return null;

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5" aria-label={t("title")}>
      {/* Total Tracks */}
      <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-white/90 p-3 sm:p-4 shadow-xs backdrop-blur-sm transition-all duration-300 hover:shadow-sm hover:border-secondary/30">
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="flex size-6 sm:size-7 items-center justify-center rounded-lg sm:rounded-xl bg-secondary/10 text-secondary">
              <Music2 className="size-3.5 sm:size-4" strokeWidth={2.5} />
            </span>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {t("tracks")}
            </span>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          {songs.length}
        </p>
      </div>

      {/* Community Likes */}
      <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-white/90 p-3 sm:p-4 shadow-xs backdrop-blur-sm transition-all duration-300 hover:shadow-sm hover:border-primary/30">
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="flex size-6 sm:size-7 items-center justify-center rounded-lg sm:rounded-xl bg-primary/10 text-primary">
              <Heart className="size-3.5 sm:size-4" strokeWidth={2.5} fill="currentColor" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {t("likes")}
            </span>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          {recap.likes}
        </p>
      </div>

      {/* Community Comments */}
      <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-white/90 p-3 sm:p-4 shadow-xs backdrop-blur-sm transition-all duration-300 hover:shadow-sm hover:border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex size-6 sm:size-7 items-center justify-center rounded-lg sm:rounded-xl bg-purple-500/10 text-purple-600">
              <MessageSquare className="size-3.5 sm:size-4" strokeWidth={2.5} />
            </span>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {t("comments")}
            </span>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          {recap.comments}
        </p>
      </div>

      {/* Contributors & Top Track Spotlight */}
      <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-white/90 p-3 sm:p-4 shadow-xs backdrop-blur-sm transition-all duration-300 hover:shadow-sm hover:border-amber-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex size-6 sm:size-7 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-600">
              <Users className="size-3.5 sm:size-4" strokeWidth={2.5} />
            </span>
            <span className="truncate text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {t("contributors")}
            </span>
          </div>
          <span className="hidden shrink-0 text-lg font-black text-foreground sm:inline sm:text-xl">
            {recap.contributors}
          </span>
        </div>

        <p className="mt-2 text-2xl font-black tracking-tight text-foreground sm:hidden">
          {recap.contributors}
        </p>

        {recap.topTrack && recap.topTrack.likeCount > 0 ? (
          <button
            type="button"
            onClick={() => onSelectSong?.(recap.topTrack)}
            title={recap.topTrack.songTitle || undefined}
            className="mt-2 flex w-full items-center justify-between gap-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 p-1.5 sm:p-2 text-left transition-colors border border-amber-500/20 group/top cursor-pointer"
          >
            <div className="flex min-w-0 items-center gap-1">
              <Trophy className="size-3 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-[11px] sm:text-xs font-bold text-amber-950">
                  {recap.topTrack.songTitle || t("untitled")}
                </p>
                <p className="text-[9px] sm:text-[10px] font-semibold text-amber-700/80">
                  {recap.topTrack.likeCount} {t("likes").toLowerCase()}
                </p>
              </div>
            </div>
            <span className="flex size-5 sm:size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs group-hover/top:scale-110 transition-transform">
              <Play className="size-2.5 sm:size-3 ml-0.5" fill="currentColor" strokeWidth={0} />
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
