"use client";

import { useEffect, useState } from "react";
import { Activity, Heart, MessageCircle, Music2, Reply } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ActivityItem } from "@/types/song";

export function ActivityPanel({ onSelectSong }: { onSelectSong: (songId: string) => void }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const t = useTranslations("activity");
  const locale = useLocale();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/activity")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch activity");
        return response.json() as Promise<{ activity?: ActivityItem[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.activity || []);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") return null;

  const Icon = ({ type }: { type: ActivityItem["type"] }) => {
    if (type === "like") return <Heart className="size-3.5 text-primary" fill="currentColor" />;
    if (type === "comment") return <MessageCircle className="size-3.5 text-purple-600" />;
    if (type === "reply") return <Reply className="size-3.5 text-secondary" />;
    return <Music2 className="size-3.5 text-primary" />;
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/80 bg-white/90 p-4 sm:p-5 shadow-sm backdrop-blur-sm transition-all"
      aria-label={t("title")}
    >
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
            <Activity className="size-4" strokeWidth={2.5} />
          </span>
          <h2 className="text-base font-black text-foreground tracking-tight">
            {t("title")}
          </h2>
        </div>
        {items.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t("livePulse")}</span>
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-neutral-50/70 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            {status === "error" ? t("unavailable") : t("empty")}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSong(item.songId)}
              className="group flex flex-col justify-between rounded-xl border border-border/60 bg-neutral-50/60 p-2.5 text-left transition-all hover:bg-white hover:border-primary/40 hover:shadow-xs cursor-pointer"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border border-border/40 group-hover:scale-105 transition-transform">
                  <Icon type={item.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                    {t(item.type, { name: item.actorName, title: item.songTitle || t("untitled") })}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(item.occurredAt))}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
