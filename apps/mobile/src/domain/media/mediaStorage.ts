/** Signed, expiring URLs for files in the private photo bucket. */
export type MediaStorage = {
  /**
   * One URL per path the caller may read, valid for at least `SIGNED_URL_TTL_SECONDS`.
   * Paths the caller can't read are left out rather than failing the batch.
   * Rejects with the underlying error when the request itself fails.
   */
  signedUrls(paths: string[]): Promise<Record<string, string>>;
};

export const SIGNED_URL_TTL_SECONDS = 60 * 60;
