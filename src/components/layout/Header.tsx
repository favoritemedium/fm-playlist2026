"use client";

import { motion } from "motion/react";
import { Sparkles, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserMenu } from "@/components/auth/UserMenu";

interface HeaderProps {
  user?: {
    name?: string;
    picture?: string;
    email?: string;
  } | null;
  settings?: React.ReactNode;
}

export function Header({ user, settings }: HeaderProps) {
  const t = useTranslations("home");

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-30 mb-8 sm:mb-10"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Radio className="size-3 animate-pulse" />
              <span>FM Community</span>
            </span>
          </div>
          <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight bg-gradient-to-r from-primary via-[#e00062] to-secondary bg-clip-text text-transparent drop-shadow-xs">
            FM Playlist
          </h1>
          <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm md:text-base text-muted-foreground font-medium flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary/70 shrink-0 hidden sm:inline" />
            <span>{t("tagline")}</span>
          </p>
        </div>
        <div className="w-full shrink-0 self-start sm:w-auto sm:self-center">
          <UserMenu user={user} settings={settings} />
        </div>
      </div>
    </motion.header>
  );
}
