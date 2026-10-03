import { useQuery } from "@tanstack/react-query";
import { SIGNED_URL_TTL_SECONDS, type MediaStorage } from "@/domain/media/mediaStorage";

export function createMediaHooks(storage: MediaStorage) {
  /**
   * Signed URLs for a set of photo paths, in one request. Refreshed well before
   * they expire. Images should be cached by path (expo-image `cacheKey`), not by
   * URL, so a re-signed URL doesn't download the same photo again.
   */
  function useSignedUrls(paths: string[]) {
    const unique = [...new Set(paths)].sort();
    return useQuery({
      queryKey: ["media", unique],
      queryFn: () => storage.signedUrls(unique),
      enabled: unique.length > 0,
      staleTime: (SIGNED_URL_TTL_SECONDS / 2) * 1000,
      gcTime: (SIGNED_URL_TTL_SECONDS / 2) * 1000,
    });
  }

  return { useSignedUrls };
}
