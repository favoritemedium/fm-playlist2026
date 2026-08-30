"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const t = useTranslations("playlist.search");

  return (
    <div className="relative flex h-9 w-full items-center gap-2 rounded-xl border border-border/60 bg-neutral-100/80 px-3 transition-colors hover:bg-neutral-100 sm:w-64 md:w-full min-w-0">
      <Search
        className="size-3.5 shrink-0 text-secondary"
        strokeWidth={2.5}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("ariaLabel")}
        className="h-full w-full bg-transparent border-0 p-0 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground focus:outline-none cursor-pointer"
          aria-label={t("clearAriaLabel")}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
