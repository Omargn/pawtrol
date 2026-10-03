import type { WriteError } from "@/domain/errors/writeError";
import { MAX_PHOTOS_PER_REPORT } from "@/domain/photos/photos";
import { SEEN_MAX_AGE_DAYS, type ReportKind } from "@/domain/reports/report";
import type { Draft } from "@/domain/reports/submitReport";

export type { Draft, DraftPhoto } from "@/domain/reports/submitReport";

export const STEPS = ["kind", "details", "location", "photos", "review"] as const;
export type Step = (typeof STEPS)[number];

export type Submission =
  | { status: "editing" }
  | { status: "submitting"; uploaded: number; total: number }
  | { status: "failed"; error: WriteError }
  | { status: "done"; reportId: string };

export type PostState = { step: Step; draft: Draft; submission: Submission };

export type PostAction =
  | { type: "setKind"; kind: ReportKind }
  | { type: "update"; fields: Partial<Pick<Draft, "speciesId" | "petName" | "description" | "color" | "size" | "lastSeenAt">> }
  | { type: "setLocation"; location: { latitude: number; longitude: number } }
  | { type: "addPhotos"; uris: string[] }
  | { type: "removePhoto"; localUri: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "goTo"; step: Step }
  | { type: "submitStarted" }
  | { type: "photoUploaded"; localUri: string; path: string }
  | { type: "submitFailed"; error: WriteError }
  | { type: "submitSucceeded"; reportId: string }
  | { type: "reset"; clientId: string; now: Date };

export const DESCRIPTION_MAX = 1000;
export const PET_NAME_MAX = 50;
export const COLOR_MAX = 40;

export function initialPostState(clientId: string, now: Date): PostState {
  return {
    step: "kind",
    submission: { status: "editing" },
    draft: {
      clientId,
      kind: null,
      speciesId: null,
      petName: "",
      description: "",
      color: "",
      size: null,
      lastSeenAt: now,
      location: null,
      photos: [],
    },
  };
}

/**
 * What still blocks leaving `step`, as copy to show. Mirrors the server's
 * checks for a friendly message first; the server stays the authority.
 */
export function stepIssues(draft: Draft, step: Step, now = new Date()): string[] {
  const issues: string[] = [];
  switch (step) {
    case "kind":
      if (!draft.kind) issues.push("Choose whether you lost or found a pet.");
      break;
    case "details": {
      if (draft.speciesId === null) issues.push("Choose what kind of animal it is.");
      const description = draft.description.trim();
      if (description.length === 0) issues.push("Add a short description.");
      if (description.length > DESCRIPTION_MAX) issues.push(`Keep the description under ${DESCRIPTION_MAX} characters.`);
      if (draft.petName.trim().length > PET_NAME_MAX) issues.push(`Keep the name under ${PET_NAME_MAX} characters.`);
      if (draft.color.trim().length > COLOR_MAX) issues.push(`Keep the color under ${COLOR_MAX} characters.`);
      if (draft.lastSeenAt.getTime() > now.getTime() + 5 * 60_000) issues.push("The time can't be in the future.");
      if (draft.lastSeenAt.getTime() < now.getTime() - SEEN_MAX_AGE_DAYS * 86_400_000) {
        issues.push(`Reports are for pets seen in the last ${SEEN_MAX_AGE_DAYS} days.`);
      }
      break;
    }
    case "location":
      if (!draft.location) issues.push("Move the map to where the pet was last seen.");
      break;
    case "photos":
      if (draft.photos.length > MAX_PHOTOS_PER_REPORT) issues.push(`Up to ${MAX_PHOTOS_PER_REPORT} photos.`);
      break;
    case "review":
      for (const earlier of STEPS.slice(0, -1)) issues.push(...stepIssues(draft, earlier, now));
      break;
  }
  return issues;
}

const isSubmitting = (state: PostState) => state.submission.status === "submitting";

export function postReducer(state: PostState, action: PostAction): PostState {
  // Nothing in the draft may change under an upload in flight.
  if (isSubmitting(state) && !["photoUploaded", "submitFailed", "submitSucceeded"].includes(action.type)) {
    return state;
  }
  const draft = state.draft;
  const index = STEPS.indexOf(state.step);

  switch (action.type) {
    case "setKind":
      return { ...state, draft: { ...draft, kind: action.kind } };
    case "update":
      return { ...state, draft: { ...draft, ...action.fields } };
    case "setLocation":
      return { ...state, draft: { ...draft, location: action.location } };
    case "addPhotos": {
      const known = new Set(draft.photos.map((photo) => photo.localUri));
      const added = action.uris.filter((uri) => !known.has(uri)).map((localUri) => ({ localUri }));
      return { ...state, draft: { ...draft, photos: [...draft.photos, ...added].slice(0, MAX_PHOTOS_PER_REPORT) } };
    }
    case "removePhoto":
      return { ...state, draft: { ...draft, photos: draft.photos.filter((photo) => photo.localUri !== action.localUri) } };
    case "next":
      if (index === STEPS.length - 1 || stepIssues(draft, state.step).length > 0) return state;
      return { ...state, step: STEPS[index + 1] };
    case "back":
      return index === 0 ? state : { ...state, step: STEPS[index - 1] };
    case "goTo":
      // Only backwards: jumping ahead would skip a step's checks.
      return STEPS.indexOf(action.step) <= index ? { ...state, step: action.step } : state;
    case "submitStarted":
      if (state.step !== "review" || stepIssues(draft, "review").length > 0) return state;
      return {
        ...state,
        submission: {
          status: "submitting",
          uploaded: draft.photos.filter((photo) => photo.uploadedPath).length,
          total: draft.photos.length,
        },
      };
    case "photoUploaded": {
      const photos = draft.photos.map((photo) =>
        photo.localUri === action.localUri ? { ...photo, uploadedPath: action.path } : photo,
      );
      const submission =
        state.submission.status === "submitting"
          ? { ...state.submission, uploaded: photos.filter((photo) => photo.uploadedPath).length }
          : state.submission;
      return { ...state, draft: { ...draft, photos }, submission };
    }
    case "submitFailed":
      return { ...state, submission: { status: "failed", error: action.error } };
    case "submitSucceeded":
      return { ...state, submission: { status: "done", reportId: action.reportId } };
    case "reset":
      return initialPostState(action.clientId, action.now);
  }
}
