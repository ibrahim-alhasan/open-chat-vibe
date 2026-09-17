import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the file path from a Supabase storage URL.
 * Handles both public and authenticated URL patterns.
 * Returns the original value unchanged if it doesn't look like a full URL (already a path).
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath) return urlOrPath;
  if (!urlOrPath.startsWith("http")) return urlOrPath;

  const patterns = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ];

  for (const pattern of patterns) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      const raw = urlOrPath.slice(idx + pattern.length);
      return decodeURIComponent(raw.split("?")[0]);
    }
  }

  return urlOrPath;
}

// In-memory cache: cacheKey → { signedUrl, expiresAt }
const cache = new Map<string, { signedUrl: string; expiresAt: number }>();

const EXPIRY_SECONDS = 60 * 60 * 12; // 12 hours
const CACHE_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

/**
 * Creates a signed URL for a file in a Supabase storage bucket.
 * Accepts a full storage URL or a bare file path.
 * Results are cached in memory to avoid redundant API calls.
 */
export async function getSignedStorageUrl(
  bucket: string,
  pathOrUrl: string
): Promise<string | null> {
  if (!pathOrUrl) return null;

  const filePath = extractStoragePath(pathOrUrl, bucket);
  if (!filePath) return null;

  const cacheKey = `${bucket}::${filePath}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > CACHE_BUFFER_MS) {
    return cached.signedUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, EXPIRY_SECONDS);

  if (error || !data?.signedUrl) return null;

  cache.set(cacheKey, {
    signedUrl: data.signedUrl,
    expiresAt: Date.now() + EXPIRY_SECONDS * 1000,
  });

  return data.signedUrl;
}
