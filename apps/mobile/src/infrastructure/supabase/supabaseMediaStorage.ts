import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { WriteError, toWriteError } from "@/domain/errors/writeError";
import { SIGNED_URL_TTL_SECONDS, type MediaStorage } from "@/domain/media/mediaStorage";

export const PHOTO_BUCKET = "report-photos";

/** Reads a local file into bytes; injected so tests don't need a real file system. */
export type ReadLocalFile = (uri: string) => Promise<ArrayBuffer>;

const readWithFetch: ReadLocalFile = async (uri) => (await fetch(uri)).arrayBuffer();

export function createSupabaseMediaStorage(
  client: SupabaseClient<Database>,
  readLocalFile: ReadLocalFile = readWithFetch,
): MediaStorage {
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

    async upload(localUri, path) {
      let body: ArrayBuffer;
      try {
        body = await readLocalFile(localUri);
      } catch (error) {
        throw new WriteError("unknown", error);
      }
      const { error } = await client.storage
        .from(PHOTO_BUCKET)
        .upload(path, body, { contentType: "image/jpeg", upsert: false });
      if (error) throw toWriteError(error);
    },
  };
}
