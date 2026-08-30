"use client";

import { useState } from "react";
import { Bookmark, Heart, MessageSquare, Play, Music, Check } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Song } from "@/types/song";
import { getYouTubeThumbnailUrl } from "@/lib/youtube";
import { LikesTooltip } from "./LikesTooltip";

interface SongCardProps {
  song: Song;
  isActive: boolean;
  isPlayed?: boolean;
  index: number;
  onClick: () => void;
  isLoggedIn: boolean;
  isBookmarkPending: boolean;
  onBookmarkToggle: () => void;
}

export function SongCard({
  song,
  isActive,
  isPlayed = false,
  index,
  onClick,
  isLoggedIn,
  isBookmarkPending,
  onBookmarkToggle,
}: SongCardProps) {
  const t = useTranslations("playlist");
  const [imageError, setImageError] = useState(false);

  const trackLabel = [song.songTitle, song.artistName, t("card.sharedBy", { name: song.submitterName })]
    .filter(Boolean)
    .join(" - ");

  return (
    <div
      className={`group relative aspect-video overflow-hidden rounded-2xl bg-neutral-900 transition-all duration-300 ${
        isActive
          ? "ring-4 ring-primary shadow-xl shadow-primary/30 scale-[1.02]"
          : "ring-1 ring-border/80 shadow-sm hover:shadow-lg hover:ring-primary/60 hover:scale-[1.015]"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={trackLabel}
        className="absolute inset-0 h-full w-full text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary"
      >
        {!imageError ? (
          <Image
            src={getYouTubeThumbnailUrl(song.youtubeVideoId)}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            priority={index === 0}
            loading={index === 0 ? undefined : index < 8 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 p-3 text-center">
            <Music className="size-6 text-primary/60 mb-1" />
            <p className="line-clamp-1 text-[11px] font-bold text-white/80">
              {song.songTitle || t("card.untitled")}
            </p>
          </div>
        )}

        {/* Gradient Scrims */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40 opacity-80 transition-opacity group-hover:opacity-90" />

        {/* Top Badges (Likes, Comments, Played status) */}
        <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1.5">
          <LikesTooltip songId={song.id} likeCount={song.likeCount}>
            <span className="inline-flex min-w-9 items-center justify-center gap-1 rounded-full bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
              <Heart className="size-2.5 text-primary" fill={song.userLiked ? "currentColor" : "none"} />
              {song.likeCount}
            </span>
          </LikesTooltip>
          {song.commentCount > 0 && (
            <span className="inline-flex min-w-9 items-center justify-center gap-1 rounded-full bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
              <MessageSquare className="size-2.5 text-secondary" />
              {song.commentCount}
            </span>
          )}
          {isPlayed && !isActive && (
            <span className="inline-flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md p-1 text-[10px] text-white/70 shadow-xs" title="Played">
              <Check className="size-2.5" />
            </span>
          )}
        </div>

        {/* Center Play Overlay / Equalizer Animation */}
        {isActive ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <div className="flex items-end justify-center gap-1 h-6 px-2.5 py-1 rounded-full bg-primary/90 text-white shadow-lg">
              <span className="w-1 bg-white rounded-full animate-soundwave-1" />
              <span className="w-1 bg-white rounded-full animate-soundwave-2" />
              <span className="w-1 bg-white rounded-full animate-soundwave-3" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-200 group-hover:opacity-100">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-xl transition-transform duration-200 group-hover:scale-110">
              <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
            </div>
          </div>
        )}

        {/* Bottom Details */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
          <p className="truncate text-xs font-bold text-white drop-shadow-xs">
            {song.songTitle || t("card.untitled")}
          </p>
          <p className="truncate text-[10px] font-medium text-white/75 mt-0.5">
            {song.artistName ? (
              <span>{song.artistName} • <span className="text-white/60">{song.submitterName}</span></span>
            ) : (
              t("card.sharedBy", { name: song.submitterName })
            )}
          </p>
        </div>
      </button>

      {/* Bookmark Button */}
      {isLoggedIn && (
        <button
          type="button"
          disabled={isBookmarkPending}
          onClick={onBookmarkToggle}
          aria-label={song.bookmarked ? t("card.removeSaved") : t("card.save")}
          title={song.bookmarked ? t("card.removeSaved") : t("card.save")}
          className={`absolute right-2.5 top-2.5 z-30 rounded-full p-1.5 text-white shadow-md transition-all ${
            song.bookmarked
              ? "bg-primary text-white scale-100"
              : "bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 hover:bg-primary"
          }`}
        >
          <Bookmark className="size-3" fill={song.bookmarked ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
