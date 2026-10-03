import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { SIGNED_URL_TTL_SECONDS, type MediaStorage } from "@/domain/media/mediaStorage";

export const PHOTO_BUCKET = "report-photos";

export function createSupabaseMediaStorage(client: SupabaseClient<Database>): MediaStorage {
  return {
    async signedUrls(paths) {
      if (paths.length === 0) return {};
      const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (error) throw error;
      // A path the caller can't read comes back with its own error; leave it out.
      const urls: Record<string, string> = {};
      for (const entry of data) {
        if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
      }
      return urls;
    },
  };
}
