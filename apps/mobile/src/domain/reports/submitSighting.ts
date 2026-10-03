import { toWriteError } from "@/domain/errors/writeError";
import { uploadPhoto, type UploadDependencies } from "@/domain/photos/uploadPhoto";
import type { ReportRepository } from "@/domain/reports/report";
import type { DraftPhoto } from "@/domain/reports/submitReport";

export type SightingDraft = {
  /** One per draft: the server's idempotency key, reused by every retry. */
  clientId: string;
  seenAt: Date;
  location: { latitude: number; longitude: number } | null;
  note: string;
  photo: DraftPhoto | null;
};

export type SubmitSightingDependencies = UploadDependencies & {
  repository: Pick<ReportRepository, "addSighting">;
};

/**
 * Uploads the draft's photo, if any, and adds the sighting. Like
 * submitReport: the photo goes through the preparer, a photo uploaded by an
 * earlier attempt isn't sent again, and the clientId makes a retry return the
 * sighting the first attempt created.
 *
 * Rejects with a WriteError.
 */
export async function submitSighting(
  draft: SightingDraft,
  reportId: string,
  userId: string,
  deps: SubmitSightingDependencies,
  onPhotoUploaded: (path: string) => void,
): Promise<string> {
  try {
    let photoPath = draft.photo?.uploadedPath ?? null;
    if (draft.photo && !photoPath) {
      photoPath = await uploadPhoto(draft.photo.localUri, userId, deps);
      onPhotoUploaded(photoPath);
    }

    return await deps.repository.addSighting({
      clientId: draft.clientId,
      reportId,
      seenAt: draft.seenAt.toISOString(),
      location: draft.location!,
      note: draft.note.trim() || null,
      photoPath,
    });
  } catch (error) {
    throw toWriteError(error);
  }
}
