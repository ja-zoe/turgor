import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Storage seam (R29.1). Server-only: constructed with the service-role
 * key, which must never reach the browser. Storage shares the Supabase project
 * with the database — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY come from the same
 * dashboard as DATABASE_URL. When they're unset, uploads are unavailable and the
 * UI falls back to URL entry.
 */
const BUCKET = "org-assets";

/** New-style secret key (sb_secret_…) preferred; legacy service_role JWT accepted. */
function storageKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && storageKey());
}

export async function uploadPublicAsset(file: File, keyPrefix: string): Promise<string> {
  const supabase = createClient(process.env.SUPABASE_URL!, storageKey()!, {
    auth: { persistSession: false },
  });

  // Create-if-missing so a fresh deployment needs no manual bucket setup.
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

  // Timestamped key: browser caches can never serve a stale asset after a change.
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const key = `${keyPrefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}
