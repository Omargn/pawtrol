import { toWriteError } from "@/domain/errors/writeError";
import { uploadPhoto, type UploadDependencies } from "@/domain/photos/uploadPhoto";
import type { PetSize, ReportKind, ReportRepository } from "@/domain/reports/report";

export type DraftPhoto = {
  /** The original on the device. Never uploaded as-is. */
  localUri: string;
  /** Set once uploaded, so a retried submission doesn't upload it again. */
  uploadedPath?: string;
};

export type Draft = {
  /** One per draft: the server's idempotency key, reused by every retry. */
  clientId: string;
  kind: ReportKind | null;
  speciesId: number | null;
  petName: string;
  description: string;
  color: string;
  size: PetSize | null;
  lastSeenAt: Date;
  location: { latitude: number; longitude: number } | null;
  photos: DraftPhoto[];
};

export type SubmitDependencies = UploadDependencies & {
  repository: Pick<ReportRepository, "createReport">;
};

/**
 * Uploads the draft's photos and publishes the report.
 *
 * - Every photo goes through the preparer first: the original file, with its
 *   EXIF GPS position, never leaves the device.
 * - Photos already uploaded by an earlier attempt are skipped, and the report
 *   reuses the draft's clientId, so retrying after a failure duplicates
 *   neither photos nor the report.
 *
 * Rejects with a WriteError.
 */
export async function submitReport(
  draft: Draft,
  userId: string,
  deps: SubmitDependencies,
  onPhotoUploaded: (localUri: string, path: string) => void,
): Promise<string> {
  try {
    const paths: string[] = [];
    for (const photo of draft.photos) {
      if (photo.uploadedPath) {
        paths.push(photo.uploadedPath);
        continue;
      }
      const path = await uploadPhoto(photo.localUri, userId, deps);
      onPhotoUploaded(photo.localUri, path);
      paths.push(path);
    }

    return await deps.repository.createReport({
      clientId: draft.clientId,
      kind: draft.kind!,
      speciesId: draft.speciesId!,
      description: draft.description.trim(),
      lastSeenAt: draft.lastSeenAt.toISOString(),
      location: draft.location!,
      petName: draft.petName.trim() || null,
      color: draft.color.trim() || null,
      size: draft.size,
      photoPaths: paths,
    });
  } catch (error) {
    throw toWriteError(error);
  }
}
