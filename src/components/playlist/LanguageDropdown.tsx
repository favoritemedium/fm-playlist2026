"use client";

import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { locales, type Locale } from "@/i18n/config";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  id: "Bahasa Indonesia",
  si: "සිංහල",
  ta: "தமிழ்",
  vi: "Tiếng Việt",
};

export function LanguageDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocale() as Locale;
  const t = useTranslations("settings.language");

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const changeLanguage = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <div ref={containerRef} className="inline-block text-left">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        title={t("sectionTitle")}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold shadow-sm transition-all hover:bg-muted hover:shadow ${
          open ? "border-primary text-primary" : "text-foreground"
        }`}
      >
        <Globe className={`size-4 ${open ? "text-primary animate-pulse" : "text-muted-foreground"}`} strokeWidth={2.5} />
        <span className="uppercase text-xs tracking-wider">{locale}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-white p-1.5 shadow-xl transition-all">
          <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border mb-1.5">
            {t("sectionTitle")}
          </p>
          <div className="space-y-1">
            {locales.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  changeLanguage(code);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  locale === code
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span>{LANGUAGE_NAMES[code]}</span>
                {locale === code && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
