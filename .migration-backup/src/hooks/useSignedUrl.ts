import { useState, useEffect, useRef } from "react";
import { getSignedStorageUrl } from "@/lib/signedUrl";

/**
 * React hook that resolves a Supabase storage path/URL into a signed URL.
 * Returns null while loading, and the signed URL once ready.
 * Uses the module-level cache inside getSignedStorageUrl to avoid duplicate requests.
 */
export function useSignedUrl(
  bucket: string,
  pathOrUrl: string | null | undefined
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!pathOrUrl) {
      setSignedUrl(null);
      return;
    }

    getSignedStorageUrl(bucket, pathOrUrl).then((url) => {
      if (mountedRef.current) setSignedUrl(url);
    });

    return () => {
      mountedRef.current = false;
    };
  }, [bucket, pathOrUrl]);

  return signedUrl;
}
