"use client";

import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/constants";
import {
  SONG_DESCRIPTION_MAX_LENGTH,
  YOUTUBE_URL_MAX_LENGTH,
} from "@/lib/song-limits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Song } from "@/types/song";

interface TrackPreview {
  videoId: string;
  thumbnailUrl: string;
  title: string | null;
  artistName: string | null;
  available: boolean;
  duplicate: {
    id: string;
    title: string | null;
    artistName: string | null;
    submitterName: string;
  } | null;
  youtubeUrl: string;
}

interface AddTrackDialogProps {
  onTrackAdded: (song: Song) => void;
  isLoggedIn?: boolean;
}

export function AddTrackDialog({ onTrackAdded, isLoggedIn = false }: AddTrackDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TrackPreview | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [formData, setFormData] = useState({
    youtubeUrl: "",
    description: "",
  });
  const t = useTranslations("addTrack");
  const tAuth = useTranslations("auth");

  const errorId = "add-track-error";

  const handlePreview = async (): Promise<boolean> => {
    const youtubeUrl = formData.youtubeUrl.trim();
    if (!youtubeUrl) return false;

    setError(null);
    setIsPreviewing(true);
    try {
      const response = await fetch("/api/youtube/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });
      const data = (await response.json()) as { error?: string } & Partial<TrackPreview>;
      if (!response.ok || !data.videoId) {
        throw new Error(data.error || t("errors.failedToPreview"));
      }
      setPreview({
        videoId: data.videoId,
        thumbnailUrl: data.thumbnailUrl || "",
        title: data.title || null,
        artistName: data.artistName || null,
        available: Boolean(data.available),
        duplicate: data.duplicate || null,
        youtubeUrl,
      });
      setAllowDuplicate(false);
      return true;
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : t("errors.somethingWentWrong"));
      return false;
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const youtubeUrl = formData.youtubeUrl.trim();
    if (!preview || preview.youtubeUrl !== youtubeUrl) {
      const didPreview = await handlePreview();
      if (!didPreview) return;
      return;
    }
    if (preview.duplicate && !allowDuplicate) {
      setError(t("errors.confirmDuplicate"));
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, allowDuplicate }),
      });

      const data = (await response.json()) as unknown;

      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : t("errors.failedToAdd");
        throw new Error(message);
      }

      if (!data || typeof data !== "object") {
        throw new Error(t("errors.failedToRead"));
      }

      const song = data as Song;
      onTrackAdded(song);
      setFormData({ youtubeUrl: "", description: "" });
      setPreview(null);
      setAllowDuplicate(false);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.somethingWentWrong"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setError(null);
        setPreview(null);
        setAllowDuplicate(false);
      }
    }}>
      <DialogTrigger asChild>
        <Button className="h-9 w-full bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20 px-3.5 sm:px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer sm:w-auto">
          <Plus className="size-4 shrink-0" strokeWidth={3} />
          <span>{t("button")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white border-2 border-primary/20 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black text-primary">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        {!isLoggedIn ? (
          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 text-center space-y-3.5 shadow-inner mt-4">
            <p className="text-sm font-bold text-muted-foreground leading-relaxed">
              {t("signInToAddTrack", {
                domain: ALLOWED_EMAIL_DOMAIN,
                defaultValue: `Sign in with a ${ALLOWED_EMAIL_DOMAIN} account to add a track`,
              })}
            </p>
            <div className="flex justify-center">
              <SignInButton forceRedirectUrl="/" signUpForceRedirectUrl="/">
                <Button
                  className="bg-white hover:bg-neutral-50 text-foreground border border-border shadow-sm font-bold px-4 py-2 flex items-center gap-2 rounded-xl text-xs cursor-pointer transition-all hover:border-neutral-300 shadow-lg shadow-black/5"
                >
                  <GoogleIcon className="w-4 h-4 shrink-0" />
                  <span>{tAuth("signIn")}</span>
                </Button>
              </SignInButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div>
              <label htmlFor="youtube-url" className="block mb-2 font-bold text-foreground">
                {t("youtubeUrlLabel")}
              </label>
              <Input
                id="youtube-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                value={formData.youtubeUrl}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, youtubeUrl: e.target.value }));
                  setPreview(null);
                  setAllowDuplicate(false);
                }}
                placeholder={t("youtubeUrlPlaceholder")}
                required
                maxLength={YOUTUBE_URL_MAX_LENGTH}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="bg-input-background border-2 border-border focus:border-primary"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handlePreview()}
                disabled={isPreviewing || !formData.youtubeUrl.trim()}
                className="mt-2 w-full rounded-xl font-bold"
              >
                <Eye className="size-4" />
                {isPreviewing ? t("previewingButton") : t("previewButton")}
              </Button>
            </div>
            {preview && (
              <div className="overflow-hidden rounded-2xl border border-border bg-background">
                <div className="relative aspect-video bg-black">
                  <Image src={preview.thumbnailUrl} alt="" fill className="object-cover" />
                </div>
                <div className="space-y-1 p-3">
                  <p className="font-bold text-foreground">{preview.title || t("unknownTitle")}</p>
                  {preview.artistName && <p className="text-sm text-muted-foreground">{preview.artistName}</p>}
                  {!preview.available && <p className="text-sm font-semibold text-destructive">{t("unavailableWarning")}</p>}
                  {preview.duplicate && (
                    <label className="mt-3 flex items-start gap-2 rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={allowDuplicate}
                        onChange={(event) => setAllowDuplicate(event.target.checked)}
                        className="mt-1 accent-primary"
                      />
                      <span>{t("duplicateWarning", { name: preview.duplicate.submitterName })}</span>
                    </label>
                  )}
                </div>
              </div>
            )}
            <div>
              <label htmlFor="description" className="block mb-2 font-bold text-foreground">
                {t("descriptionLabel")}
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder={t("descriptionPlaceholder")}
                rows={3}
                maxLength={SONG_DESCRIPTION_MAX_LENGTH}
                className="bg-input-background resize-none border-2 border-border focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">
                {formData.description.length}/{SONG_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
            {error && (
              <p id={errorId} role="alert" className="text-sm text-destructive font-medium">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isPreviewing || !preview || (Boolean(preview.duplicate) && !allowDuplicate)}
              aria-busy={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 shadow-lg shadow-primary/30 rounded-xl"
            >
              {isSubmitting ? t("submittingButton") : t("submitButton")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
