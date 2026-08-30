"use client";

import { useMemo, useState } from "react";
import {
  Heart,
  MessageSquare,
  Music2,
  Users,
  Trophy,
  Play,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Song } from "@/types/song";
import { getTopSubmitters } from "@/lib/playlist-recap";

export function PlaylistRecap({
  songs,
  onSelectSong,
  defaultExpanded = false,
}: {
  songs: Song[];
  onSelectSong?: (song: Song) => void;
  defaultExpanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const t = useTranslations("recap");

  const recap = useMemo(() => {
    const contributors = new Set(
      songs
        .map((song) => song.submitterName.trim().toLocaleLowerCase("en-US"))
        .filter(Boolean)
    );
    const likes = songs.reduce((total, song) => total + (song.likeCount || 0), 0);
    const comments = songs.reduce((total, song) => total + (song.commentCount || 0), 0);
    const topTrack = [...songs].sort((a, b) => b.likeCount - a.likeCount)[0];
    const topSubmitters = getTopSubmitters(songs, 3);
    return { contributors: contributors.size, likes, comments, topTrack, topSubmitters };
  }, [songs]);

  if (songs.length === 0) return null;

  const hasTopTrack = Boolean(recap.topTrack && recap.topTrack.likeCount > 0);
  const hasSubmitters = recap.topSubmitters.length > 0;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/80 bg-white/90 shadow-xs backdrop-blur-md transition-all duration-200"
      aria-label={t("title")}
    >
      {/* Foldable Header / Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="playlist-recap-content"
        className="group/toggle flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left transition-all hover:bg-neutral-50/90 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex size-7 sm:size-7.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-secondary/15 to-amber-500/15 text-primary group-hover/toggle:scale-105 transition-transform shadow-2xs">
              <Sparkles className="size-3.5 sm:size-4" strokeWidth={2.5} />
            </span>
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-foreground whitespace-nowrap">
              {t("title")}
            </h2>
          </div>

          {/* Stat Badges / Preview Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-lg border border-secondary/15 bg-secondary/5 px-2 py-0.5 text-[11px] font-bold text-secondary">
              <Music2 className="size-3" strokeWidth={2.5} />
              <span>{songs.length}</span>
              <span className="sr-only font-medium text-muted-foreground sm:not-sr-only sm:inline">{t("tracks").toLowerCase()}</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] font-bold text-primary">
              <Heart className="size-3" fill="currentColor" />
              <span>{recap.likes}</span>
              <span className="sr-only font-medium text-muted-foreground sm:not-sr-only sm:inline">{t("likes").toLowerCase()}</span>
            </span>

            {recap.comments > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-purple-500/15 bg-purple-500/5 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                <MessageSquare className="size-3" strokeWidth={2.5} />
                <span>{recap.comments}</span>
                <span className="sr-only font-medium text-muted-foreground sm:not-sr-only sm:inline">{t("comments").toLowerCase()}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/15 bg-amber-500/5 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              <Users className="size-3" strokeWidth={2.5} />
              <span>{recap.contributors}</span>
              <span className="sr-only font-medium text-muted-foreground sm:not-sr-only sm:inline">{t("contributors").toLowerCase()}</span>
            </span>

            {/* Top Contributor Spotlight Chip on Desktop */}
            {recap.topSubmitters[0] && (
              <span className="hidden md:inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-500/5 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                <Trophy className="size-3 text-amber-600" />
                <span className="font-semibold text-amber-700">#1</span>
                <span className="max-w-[130px] truncate">{recap.topSubmitters[0].name}</span>
                <span className="text-[10px] text-amber-700/80">({recap.topSubmitters[0].count})</span>
              </span>
            )}
          </div>
        </div>

        {/* Expand / Collapse Action Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span aria-hidden="true" className="hidden lg:inline-flex text-[11px] font-bold text-muted-foreground group-hover/toggle:text-foreground transition-colors">
            {isOpen ? t("hideLeaderboard") : t("showLeaderboard")}
          </span>
          <span className="sr-only">
            {isOpen ? t("hideLeaderboard") : t("showLeaderboard")}
          </span>
          <span className={`flex size-6 sm:size-7 items-center justify-center rounded-lg bg-neutral-100/90 text-muted-foreground group-hover/toggle:bg-neutral-200/80 group-hover/toggle:text-foreground transition-all duration-200 shadow-2xs ${isOpen ? "rotate-180 bg-neutral-200 text-foreground" : ""}`}>
            <ChevronDown className="size-3.5 sm:size-4" />
          </span>
        </div>
      </button>

      {/* Expandable Content with smooth Animation */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="playlist-recap-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 p-3 sm:p-4 pt-3 sm:pt-3.5 space-y-3">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* Total Tracks */}
                <div className="flex items-center gap-2 sm:gap-2.5 rounded-xl border border-border/60 bg-neutral-50/70 px-2.5 sm:px-3 py-2 transition-all hover:bg-secondary/5 hover:border-secondary/20">
                  <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <Music2 className="size-3.5 sm:size-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">
                      {t("tracks")}
                    </span>
                    <span className="text-base sm:text-lg font-black text-foreground tracking-tight leading-tight block">
                      {songs.length}
                    </span>
                  </div>
                </div>

                {/* Community Likes */}
                <div className="flex items-center gap-2 sm:gap-2.5 rounded-xl border border-border/60 bg-neutral-50/70 px-2.5 sm:px-3 py-2 transition-all hover:bg-primary/5 hover:border-primary/20">
                  <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Heart className="size-3.5 sm:size-4" strokeWidth={2.5} fill="currentColor" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">
                      {t("likes")}
                    </span>
                    <span className="text-base sm:text-lg font-black text-foreground tracking-tight leading-tight block">
                      {recap.likes}
                    </span>
                  </div>
                </div>

                {/* Community Comments */}
                <div className="flex items-center gap-2 sm:gap-2.5 rounded-xl border border-border/60 bg-neutral-50/70 px-2.5 sm:px-3 py-2 transition-all hover:bg-purple-500/5 hover:border-purple-500/20">
                  <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                    <MessageSquare className="size-3.5 sm:size-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">
                      {t("comments")}
                    </span>
                    <span className="text-base sm:text-lg font-black text-foreground tracking-tight leading-tight block">
                      {recap.comments}
                    </span>
                  </div>
                </div>

                {/* Contributors */}
                <div className="flex items-center gap-2 sm:gap-2.5 rounded-xl border border-border/60 bg-neutral-50/70 px-2.5 sm:px-3 py-2 transition-all hover:bg-amber-500/5 hover:border-amber-500/20">
                  <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <Users className="size-3.5 sm:size-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">
                      {t("contributors")}
                    </span>
                    <span className="text-base sm:text-lg font-black text-foreground tracking-tight leading-tight block">
                      {recap.contributors}
                    </span>
                  </div>
                </div>
              </div>

              {/* Highlights Section: Top Track Spotlight & Top Submitters Podium */}
              {(hasTopTrack || hasSubmitters) && (
                <div className="grid gap-2.5 sm:gap-3 md:grid-cols-12 items-stretch">
                  {/* Top Track Spotlight */}
                  {hasTopTrack && (
                    <div className={hasSubmitters ? "md:col-span-5 flex flex-col" : "md:col-span-12 flex flex-col"}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {t("topTrackLabel")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectSong?.(recap.topTrack)}
                        title={recap.topTrack.songTitle || undefined}
                        className="group/top relative flex flex-1 items-center justify-between gap-2.5 rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-2.5 sm:p-3 text-left transition-all hover:border-amber-500/40 hover:from-amber-500/15 cursor-pointer shadow-2xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700">
                            <Trophy className="size-3.5 sm:size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs sm:text-sm font-bold text-foreground group-hover/top:text-amber-950 transition-colors">
                              {recap.topTrack.songTitle || t("untitled")}
                            </p>
                            <p className="text-[10px] sm:text-[11px] font-semibold text-amber-700/90 flex items-center gap-1">
                              <span>{t("likeCount", { count: recap.topTrack.likeCount })}</span>
                              {recap.topTrack.artistName && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{recap.topTrack.artistName}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs group-hover/top:scale-110 group-hover/top:bg-amber-600 transition-all">
                          <Play className="size-3 ml-0.5" fill="currentColor" strokeWidth={0} />
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Top Submitters Podium */}
                  {hasSubmitters && (
                    <div
                      data-testid="top-submitters"
                      className={hasTopTrack ? "md:col-span-7 flex flex-col" : "md:col-span-12 flex flex-col"}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Trophy className="size-3.5 text-amber-600 shrink-0" />
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {t("topSubmitters")}
                        </h3>
                      </div>
                      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                        {recap.topSubmitters.map((submitter, index) => {
                          const rankStyles = [
                            "border-amber-400/30 bg-amber-50/60 text-amber-950", // #1 Gold
                            "border-slate-300/60 bg-slate-50/60 text-slate-900", // #2 Silver
                            "border-amber-700/20 bg-orange-50/50 text-amber-950", // #3 Bronze
                          ][index] || "border-border/60 bg-neutral-50/60 text-foreground";

                          const badgeStyles = [
                            "bg-amber-500 text-white shadow-xs",
                            "bg-slate-400 text-white shadow-xs",
                            "bg-amber-700 text-white shadow-xs",
                          ][index] || "bg-muted-foreground text-white";

                          return (
                            <li
                              key={submitter.name.toLocaleLowerCase("en-US")}
                              className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${rankStyles}`}
                            >
                              <span className={`flex size-5 sm:size-5.5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${badgeStyles}`}>
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold leading-tight" title={submitter.name}>
                                  {submitter.name}
                                </p>
                                <p className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5">
                                  {t("submissionCount", { count: submitter.count })}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
