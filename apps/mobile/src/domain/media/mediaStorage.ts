/** Signed, expiring URLs for files in the private photo bucket. */
export type MediaStorage = {
  /**
   * One URL per path the caller may read, valid for at least `SIGNED_URL_TTL_SECONDS`.
   * Paths the caller can't read are left out rather than failing the batch.
   * Rejects with the underlying error when the request itself fails.
   */
  signedUrls(paths: string[]): Promise<Record<string, string>>;
  /**
   * Uploads a prepared JPEG to `path`. Never overwrites: uploading the same
   * path twice rejects, so a retry must reuse the path it already uploaded.
   * Rejects with a WriteError.
   */
  upload(localUri: string, path: string): Promise<void>;
};

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Where a user's uploads go: their own folder, which is all the bucket policy lets them write. */
export function photoPath(userId: string, fileId: string) {
  return `${userId}/${fileId}.jpg`;
}
