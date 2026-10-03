import { useCallback, useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toWriteError } from "@/domain/errors/writeError";
import type { PhotoPicker } from "@/domain/photos/photos";
import { submitSighting, type SubmitSightingDependencies } from "@/domain/reports/submitSighting";
import { reportKeys } from "@/hooks/createReportHooks";
import { initialSightingState, sightingIssues, sightingReducer } from "@/hooks/sightingDraftMachine";

type SightingDependencies = SubmitSightingDependencies & { picker: PhotoPicker; newId: () => string };

export function createSightingHooks(deps: SightingDependencies) {
  /** Adding one sighting to a report: the draft, an optional photo, and submission with safe retries. */
  function useAddSighting(reportId: string) {
    const queryClient = useQueryClient();
    const [state, dispatch] = useReducer(sightingReducer, undefined, () => initialSightingState(deps.newId(), new Date()));

    const submit = useCallback(
      async (userId: string) => {
        if (state.submission.status === "submitting" || sightingIssues(state.draft, "details").length > 0) return;
        dispatch({ type: "submitStarted" });
        try {
          const sightingId = await submitSighting(state.draft, reportId, userId, deps, (path) =>
            dispatch({ type: "photoUploaded", path }),
          );
          dispatch({ type: "submitSucceeded", sightingId });
          // The timeline, and the sighting count on the report and its pin.
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: reportKeys.sightings(reportId) }),
            queryClient.invalidateQueries({ queryKey: reportKeys.all }),
          ]);
        } catch (error) {
          dispatch({ type: "submitFailed", error: toWriteError(error) });
        }
      },
      [reportId, state.draft, state.submission.status, queryClient],
    );

    /** Resolves to an error message to show, or null. */
    const pickPhoto = useCallback(async (): Promise<string | null> => {
      try {
        const photos = await deps.picker.pickFromLibrary(1);
        if (photos?.[0]) dispatch({ type: "setPhoto", localUri: photos[0].uri });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Couldn't open your photos.";
      }
    }, []);

    const takePhoto = useCallback(async (): Promise<string | null> => {
      try {
        const photo = await deps.picker.takePhoto();
        if (photo) dispatch({ type: "setPhoto", localUri: photo.uri });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Couldn't open the camera.";
      }
    }, []);

    return { state, dispatch, submit, pickPhoto, takePhoto };
  }

  return { useAddSighting };
}
