import { useCallback, useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toWriteError } from "@/domain/errors/writeError";
import { MAX_PHOTOS_PER_REPORT, type PhotoPicker } from "@/domain/photos/photos";
import { initialPostState, postReducer, stepIssues } from "@/hooks/postDraftMachine";
import { submitReport, type SubmitDependencies } from "@/domain/reports/submitReport";
import { reportKeys } from "@/hooks/createReportHooks";

type PostDependencies = SubmitDependencies & { picker: PhotoPicker; newId: () => string };

export function createPostHooks(deps: PostDependencies) {
  /** One posting flow: the draft, its steps, photo picking, and submission with safe retries. */
  function usePostReport() {
    const queryClient = useQueryClient();
    const [state, dispatch] = useReducer(postReducer, undefined, () => initialPostState(deps.newId(), new Date()));

    const submit = useCallback(
      async (userId: string) => {
        if (state.submission.status === "submitting" || stepIssues(state.draft, "review").length > 0) return;
        dispatch({ type: "submitStarted" });
        try {
          const reportId = await submitReport(state.draft, userId, deps, (localUri, path) =>
            dispatch({ type: "photoUploaded", localUri, path }),
          );
          dispatch({ type: "submitSucceeded", reportId });
          // The new pin should show up on the map the next time it's looked at.
          await queryClient.invalidateQueries({ queryKey: reportKeys.all });
        } catch (error) {
          dispatch({ type: "submitFailed", error: toWriteError(error) });
        }
      },
      [state.draft, state.submission.status, queryClient],
    );

    const remainingPhotos = MAX_PHOTOS_PER_REPORT - state.draft.photos.length;

    /** Resolves to an error message to show, or null. */
    const pickPhotos = useCallback(async (): Promise<string | null> => {
      if (remainingPhotos <= 0) return null;
      try {
        const photos = await deps.picker.pickFromLibrary(remainingPhotos);
        if (photos) dispatch({ type: "addPhotos", uris: photos.map((photo) => photo.uri) });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Couldn't open your photos.";
      }
    }, [remainingPhotos]);

    const takePhoto = useCallback(async (): Promise<string | null> => {
      if (remainingPhotos <= 0) return null;
      try {
        const photo = await deps.picker.takePhoto();
        if (photo) dispatch({ type: "addPhotos", uris: [photo.uri] });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Couldn't open the camera.";
      }
    }, [remainingPhotos]);

    const reset = useCallback(() => dispatch({ type: "reset", clientId: deps.newId(), now: new Date() }), []);

    return { state, dispatch, submit, pickPhotos, takePhoto, reset, remainingPhotos };
  }

  return { usePostReport };
}
