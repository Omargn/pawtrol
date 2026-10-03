import { randomUUID } from "expo-crypto";
import { mediaStorage } from "@/composition/mediaStorage";
import { photoPicker, photoPreparer } from "@/composition/photos";
import { reportRepository } from "@/composition/reportRepository";
import { createSightingHooks } from "@/hooks/createSightingHooks";

export const { useAddSighting } = createSightingHooks({
  repository: reportRepository,
  storage: mediaStorage,
  preparer: photoPreparer,
  picker: photoPicker,
  newId: randomUUID,
  newFileId: randomUUID,
});
