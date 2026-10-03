import { WriteError } from "@/domain/errors/writeError";
import { MAX_PHOTOS_PER_REPORT } from "@/domain/photos/photos";
import { initialPostState, postReducer, stepIssues, type PostAction, type PostState } from "@/hooks/postDraftMachine";

const now = new Date("2026-10-02T12:00:00Z");
const run = (actions: PostAction[], state: PostState = initialPostState("client-1", now)) =>
  actions.reduce(postReducer, state);

const filled: PostAction[] = [
  { type: "setKind", kind: "lost" },
  { type: "next" },
  { type: "update", fields: { speciesId: 1, description: "Brown dog", lastSeenAt: now } },
  { type: "next" },
  { type: "setLocation", location: { latitude: 19.43, longitude: -99.13 } },
  { type: "next" },
  { type: "addPhotos", uris: ["file:///a.jpg"] },
  { type: "next" },
];

it("walks the steps in order", () => {
  expect(run(filled).step).toBe("review");
});

it("won't leave a step with problems, and says what's missing", () => {
  const state = run([{ type: "next" }]);

  expect(state.step).toBe("kind");
  expect(stepIssues(state.draft, "kind")).toEqual(["Choose whether you lost or found a pet."]);
});

it("checks details like the server does", () => {
  const draft = { ...initialPostState("c", now).draft, speciesId: 1, description: "   " };
  expect(stepIssues(draft, "details", now)).toContain("Add a short description.");

  const future = { ...draft, description: "x", lastSeenAt: new Date(now.getTime() + 3_600_000) };
  expect(stepIssues(future, "details", now)).toContain("The time can't be in the future.");

  const stale = { ...draft, description: "x", lastSeenAt: new Date(now.getTime() - 91 * 86_400_000) };
  expect(stepIssues(stale, "details", now)).toEqual(["Reports are for pets seen in the last 90 days."]);
});

it("only jumps back, never ahead past unchecked steps", () => {
  const atReview = run(filled);
  expect(postReducer(atReview, { type: "goTo", step: "details" }).step).toBe("details");

  const atStart = run([]);
  expect(postReducer(atStart, { type: "goTo", step: "review" }).step).toBe("kind");
});

it("caps photos and ignores duplicates", () => {
  const uris = Array.from({ length: MAX_PHOTOS_PER_REPORT + 2 }, (_, i) => `file:///${i}.jpg`);
  const state = run([{ type: "addPhotos", uris }, { type: "addPhotos", uris: ["file:///0.jpg"] }]);

  expect(state.draft.photos).toHaveLength(MAX_PHOTOS_PER_REPORT);
});

it("freezes the draft while submitting", () => {
  const submitting = run([...filled, { type: "submitStarted" }]);

  expect(submitting.submission).toEqual({ status: "submitting", uploaded: 0, total: 1 });
  expect(run([{ type: "update", fields: { description: "changed" } }, { type: "back" }], submitting)).toBe(submitting);
});

it("remembers uploaded photos so a retry after a failure skips them", () => {
  const failed = run([
    ...filled,
    { type: "submitStarted" },
    { type: "photoUploaded", localUri: "file:///a.jpg", path: "user/1.jpg" },
    { type: "submitFailed", error: new WriteError("offline") },
  ]);
  expect(failed.draft.photos[0].uploadedPath).toBe("user/1.jpg");
  expect(failed.draft.clientId).toBe("client-1");

  const retry = postReducer(failed, { type: "submitStarted" });
  expect(retry.submission).toEqual({ status: "submitting", uploaded: 1, total: 1 });
});

it("starts a fresh draft, with a new idempotency key, after a reset", () => {
  const state = run([...filled, { type: "submitStarted" }, { type: "submitSucceeded", reportId: "r1" }]);
  expect(state.submission).toEqual({ status: "done", reportId: "r1" });

  const fresh = postReducer(state, { type: "reset", clientId: "client-2", now });
  expect(fresh.step).toBe("kind");
  expect(fresh.draft.clientId).toBe("client-2");
  expect(fresh.draft.photos).toEqual([]);
});
