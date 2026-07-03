"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Check, UploadSimple } from "@phosphor-icons/react";
import { uploadOrgLogo } from "@/lib/actions/settings";
import { ActionSpinner } from "@/components/action-feedback";

/**
 * R29.1 — logo upload control. Lives outside the Organization <form> (forms can't
 * nest); talks to the uploadOrgLogo server action directly and renders its
 * { error } inline. When storage env isn't configured the control is disabled and
 * says so — the advanced URL field in the main form still works.
 */
export function LogoUploader({
  currentUrl,
  orgName,
  configured,
}: {
  currentUrl: string;
  orgName: string;
  configured: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    const file = fileRef.current?.files?.[0];
    const fd = new FormData();
    if (file) fd.set("logoFile", file);
    startTransition(async () => {
      const res = await uploadOrgLogo(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex items-start gap-4">
      <Image
        src={currentUrl}
        alt={orgName}
        width={48}
        height={48}
        unoptimized
        className="object-contain flex-shrink-0 rounded-md border border-border bg-background p-1"
        data-testid="logo-preview"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          disabled={!configured || isPending}
          className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground file:cursor-pointer disabled:opacity-50"
          data-testid="logo-file-input"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!configured || isPending}
            className="inline-flex items-center gap-1.5 rounded-md cursor-pointer bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="logo-upload-submit"
          >
            {isPending ? <ActionSpinner /> : <UploadSimple size={13} weight="bold" />}
            {isPending ? "Uploading…" : "Upload logo"}
          </button>
          {saved && !isPending && (
            <span
              className="inline-flex items-center gap-1 text-xs text-[#588157]"
              style={{ fontFamily: "var(--font-mono)" }}
              data-testid="logo-upload-saved"
            >
              <Check size={13} weight="bold" /> Uploaded
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs text-[#A4503C]" data-testid="logo-upload-error">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {configured
            ? "PNG, JPEG, SVG, or WebP, up to 2 MB. Replaces the logo everywhere immediately."
            : "Uploads need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment — until then, use the logo URL field below."}
        </p>
      </div>
    </div>
  );
}
