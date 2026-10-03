import { WriteError } from "@/domain/errors/writeError";
import {
  initialSightingState,
  sightingIssues,
  sightingReducer,
  type SightingAction,
  type SightingState,
} from "@/hooks/sightingDraftMachine";

const now = new Date("2026-10-02T12:00:00Z");
const run = (actions: SightingAction[], state: SightingState = initialSightingState("client-1", now)) =>
  actions.reduce(sightingReducer, state);

const located: SightingAction[] = [
  { type: "update", fields: { location: { latitude: 19.43, longitude: -99.13 } } },
  { type: "next" },
];

it("needs a location before the details", () => {
  const stuck = run([{ type: "next" }]);
  expect(stuck.step).toBe("location");
  expect(sightingIssues(stuck.draft, "location", now)).toEqual(["Move the map to where you saw the pet."]);

  expect(run(located).step).toBe("details");
});

it("checks the details like the server does", () => {
  const draft = run(located).draft;

  expect(sightingIssues({ ...draft, note: "x".repeat(501) }, "details", now)).toEqual([
    "Keep the note under 500 characters.",
  ]);
  expect(sightingIssues({ ...draft, seenAt: new Date(now.getTime() + 3_600_000) }, "details", now)).toEqual([
    "The time can't be in the future.",
  ]);
  expect(sightingIssues({ ...draft, seenAt: new Date(now.getTime() - 91 * 86_400_000) }, "details", now)).toEqual([
    "Sightings are for the last 90 days.",
  ]);
  expect(sightingIssues(draft, "details", now)).toEqual([]);
});

it("keeps one photo, replacing it or dropping it", () => {
  const state = run([
    { type: "setPhoto", localUri: "file:///a.jpg" },
    { type: "setPhoto", localUri: "file:///b.jpg" },
  ]);
  expect(state.draft.photo).toEqual({ localUri: "file:///b.jpg" });

  expect(sightingReducer(state, { type: "removePhoto" }).draft.photo).toBeNull();
});

it("freezes the draft while submitting, but records the upload", () => {
  const submitting = run([...located, { type: "setPhoto", localUri: "file:///a.jpg" }, { type: "submitStarted" }]);
  expect(submitting.submission).toEqual({ status: "submitting" });

  const unchanged = run([{ type: "update", fields: { note: "changed" } }, { type: "removePhoto" }, { type: "back" }], submitting);
  expect(unchanged).toBe(submitting);

  const uploaded = sightingReducer(submitting, { type: "photoUploaded", path: "user-1/f.jpg" });
  expect(uploaded.draft.photo).toEqual({ localUri: "file:///a.jpg", uploadedPath: "user-1/f.jpg" });
});

it("won't start submitting from the location step", () => {
  const state = run([{ type: "update", fields: { location: { latitude: 19.43, longitude: -99.13 } } }, { type: "submitStarted" }]);
  expect(state.submission.status).toBe("editing");
});

it("can edit and retry after a failure", () => {
  const failed = run([...located, { type: "submitStarted" }, { type: "submitFailed", error: new WriteError("offline") }]);
  expect(failed.submission).toMatchObject({ status: "failed", error: { code: "offline" } });

  const edited = sightingReducer(failed, { type: "update", fields: { note: "Near the park" } });
  expect(edited.draft.note).toBe("Near the park");
  expect(sightingReducer(edited, { type: "submitStarted" }).submission.status).toBe("submitting");
});
