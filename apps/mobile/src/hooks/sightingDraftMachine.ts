import type { WriteError } from "@/domain/errors/writeError";
import { SEEN_MAX_AGE_DAYS } from "@/domain/reports/report";
import type { SightingDraft } from "@/domain/reports/submitSighting";

export type { SightingDraft } from "@/domain/reports/submitSighting";

export const SIGHTING_STEPS = ["location", "details"] as const;
export type SightingStep = (typeof SIGHTING_STEPS)[number];

export type SightingSubmission =
  | { status: "editing" }
  | { status: "submitting" }
  | { status: "failed"; error: WriteError }
  | { status: "done"; sightingId: string };

export type SightingState = { step: SightingStep; draft: SightingDraft; submission: SightingSubmission };

export type SightingAction =
  | { type: "update"; fields: Partial<Pick<SightingDraft, "seenAt" | "note" | "location">> }
  | { type: "setPhoto"; localUri: string }
  | { type: "removePhoto" }
  | { type: "next" }
  | { type: "back" }
  | { type: "submitStarted" }
  | { type: "photoUploaded"; path: string }
  | { type: "submitFailed"; error: WriteError }
  | { type: "submitSucceeded"; sightingId: string };

export const SIGHTING_NOTE_MAX = 500;

export function initialSightingState(clientId: string, now: Date): SightingState {
  return {
    step: "location",
    submission: { status: "editing" },
    draft: { clientId, seenAt: now, location: null, note: "", photo: null },
  };
}

/**
 * What still blocks leaving `step`, as copy to show. Mirrors the server's
 * checks for a friendly message first; the server stays the authority.
 */
export function sightingIssues(draft: SightingDraft, step: SightingStep, now = new Date()): string[] {
  const issues: string[] = [];
  if (!draft.location) issues.push("Move the map to where you saw the pet.");
  if (step === "location") return issues;

  if (draft.note.trim().length > SIGHTING_NOTE_MAX) issues.push(`Keep the note under ${SIGHTING_NOTE_MAX} characters.`);
  if (draft.seenAt.getTime() > now.getTime() + 5 * 60_000) issues.push("The time can't be in the future.");
  if (draft.seenAt.getTime() < now.getTime() - SEEN_MAX_AGE_DAYS * 86_400_000) {
    issues.push(`Sightings are for the last ${SEEN_MAX_AGE_DAYS} days.`);
  }
  return issues;
}

export function sightingReducer(state: SightingState, action: SightingAction): SightingState {
  // Nothing in the draft may change under an upload in flight.
  if (
    state.submission.status === "submitting" &&
    !["photoUploaded", "submitFailed", "submitSucceeded"].includes(action.type)
  ) {
    return state;
  }
  const draft = state.draft;

  switch (action.type) {
    case "update":
      return { ...state, draft: { ...draft, ...action.fields } };
    case "setPhoto":
      return { ...state, draft: { ...draft, photo: { localUri: action.localUri } } };
    case "removePhoto":
      return { ...state, draft: { ...draft, photo: null } };
    case "next":
      if (state.step !== "location" || sightingIssues(draft, "location").length > 0) return state;
      return { ...state, step: "details" };
    case "back":
      return { ...state, step: "location" };
    case "submitStarted":
      if (state.step !== "details" || sightingIssues(draft, "details").length > 0) return state;
      return { ...state, submission: { status: "submitting" } };
    case "photoUploaded":
      return draft.photo ? { ...state, draft: { ...draft, photo: { ...draft.photo, uploadedPath: action.path } } } : state;
    case "submitFailed":
      return { ...state, submission: { status: "failed", error: action.error } };
    case "submitSucceeded":
      return { ...state, submission: { status: "done", sightingId: action.sightingId } };
  }
}
