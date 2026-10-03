import { photoPath, type MediaStorage } from "@/domain/media/mediaStorage";
import type { PhotoPreparer } from "@/domain/photos/photos";

export type UploadDependencies = {
  storage: Pick<MediaStorage, "upload">;
  preparer: PhotoPreparer;
  newFileId: () => string;
};

/**
 * Re-encodes a photo and uploads the copy into the user's own folder,
 * returning its path. The only way a photo leaves the device: the original,
 * with its EXIF GPS position, is never uploaded.
 */
export async function uploadPhoto(localUri: string, userId: string, deps: UploadDependencies): Promise<string> {
  const prepared = await deps.preparer.prepare({ uri: localUri });
  const path = photoPath(userId, deps.newFileId());
  await deps.storage.upload(prepared.uri, path);
  return path;
}
