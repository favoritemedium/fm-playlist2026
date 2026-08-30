"use client";

import { SignInButton, SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { GoogleIcon } from "@/components/ui/GoogleIcon";

interface UserMenuProps {
  user?: {
    name?: string;
    picture?: string;
    email?: string;
  } | null;
  settings?: React.ReactNode;
}

export function UserMenu({ user, settings }: UserMenuProps) {
  const t = useTranslations("auth");

  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-border/80 bg-white/80 px-3.5 py-1.5 shadow-md backdrop-blur-md sm:w-auto sm:gap-3.5">
      {/* Profile: avatar + name */}
      {user ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
            {user.picture && (
              <Image
                src={user.picture}
                alt={user.name || "User"}
                width={28}
                height={28}
                className="size-7 rounded-full border border-primary/20 object-cover shrink-0 shadow-inner"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-xs font-black text-foreground sm:max-w-[150px]">
              {user.name || user.email}
            </span>
          </div>

          {/* Vertical separator */}
          <div className="h-5 w-px bg-border shrink-0" />
        </>
      ) : null}

      {/* Controls: language dropdown, settings, and logout/login */}
      <div className="relative ml-auto flex shrink-0 items-center gap-1.5">
        {settings}
        {user ? (
          <>
            <div className="h-5 w-px bg-border shrink-0 mx-1" />
            <SignOutButton>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive transition-all p-2 rounded-xl hover:bg-destructive/10 cursor-pointer"
                aria-label={t("signOut")}
              >
                <LogOut className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </SignOutButton>
          </>
        ) : (
          <>
            <div className="h-5 w-px bg-border shrink-0 mx-1" />
            <SignInButton forceRedirectUrl="/" signUpForceRedirectUrl="/">
              <button
                type="button"
                className="bg-white hover:bg-neutral-50 text-foreground border border-border shadow-sm font-bold px-3 py-1.5 flex items-center gap-2 rounded-xl text-xs h-8 cursor-pointer transition-all hover:border-neutral-300 shrink-0"
                aria-label={t("signIn")}
              >
                <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{t("signIn")}</span>
              </button>
            </SignInButton>
          </>
        )}
      </div>
    </div>
  );
}
