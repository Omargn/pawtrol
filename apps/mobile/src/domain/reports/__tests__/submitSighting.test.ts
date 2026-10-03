import { WriteError } from "@/domain/errors/writeError";
import { submitSighting, type SightingDraft, type SubmitSightingDependencies } from "@/domain/reports/submitSighting";
import { createInMemoryReportRepository } from "@/test-utils/inMemoryReportRepository";

const draft: SightingDraft = {
  clientId: "client-1",
  seenAt: new Date("2026-10-02T10:00:00Z"),
  location: { latitude: 19.4321, longitude: -99.1334 },
  note: "  Heading north on Orizaba ",
  photo: { localUri: "file:///camera/IMG_1.HEIC" },
};

function setup() {
  const fake = createInMemoryReportRepository();
  const uploads: { localUri: string; path: string }[] = [];
  let fileId = 0;
  const deps: SubmitSightingDependencies = {
    repository: fake.repository,
    preparer: { prepare: jest.fn(async ({ uri }) => ({ uri: `${uri}.prepared.jpg`, width: 10, height: 10 })) },
    storage: {
      upload: jest.fn(async (localUri, path) => {
        uploads.push({ localUri, path });
      }),
    },
    newFileId: () => `file-${++fileId}`,
  };
  return { deps, uploads, ...fake };
}

it("uploads only the prepared copy into the user's folder and adds the sighting with it", async () => {
  const { deps, uploads, addedSightings } = setup();
  const reported: string[] = [];

  const id = await submitSighting(draft, "report-1", "user-1", deps, (path) => reported.push(path));

  expect(uploads).toEqual([{ localUri: "file:///camera/IMG_1.HEIC.prepared.jpg", path: "user-1/file-1.jpg" }]);
  expect(reported).toEqual(["user-1/file-1.jpg"]);
  expect(addedSightings.get("client-1")).toEqual({
    id,
    sighting: {
      clientId: "client-1",
      reportId: "report-1",
      seenAt: "2026-10-02T10:00:00.000Z",
      location: { latitude: 19.4321, longitude: -99.1334 },
      note: "Heading north on Orizaba",
      photoPath: "user-1/file-1.jpg",
    },
  });
});

it("sends no photo and a null note when there are none", async () => {
  const { deps, uploads, addedSightings } = setup();

  await submitSighting({ ...draft, note: "   ", photo: null }, "report-1", "user-1", deps, () => {});

  expect(uploads).toEqual([]);
  expect(addedSightings.get("client-1")?.sighting).toMatchObject({ note: null, photoPath: null });
});

it("doesn't upload the photo again on a retry, nor add a second sighting", async () => {
  const { deps, uploads, addedSightings, failCreate } = setup();
  const reported: string[] = [];
  failCreate(new TypeError("Network request failed"));

  await expect(submitSighting(draft, "report-1", "user-1", deps, (path) => reported.push(path))).rejects.toMatchObject({
    code: "offline",
  });

  failCreate(undefined);
  const retried = { ...draft, photo: { ...draft.photo!, uploadedPath: reported[0] } };
  const first = await submitSighting(retried, "report-1", "user-1", deps, () => {});
  const second = await submitSighting(retried, "report-1", "user-1", deps, () => {});

  expect(uploads).toHaveLength(1);
  expect(second).toBe(first);
  expect(addedSightings.size).toBe(1);
  expect(addedSightings.get("client-1")?.sighting.photoPath).toBe("user-1/file-1.jpg");
});

it("passes server refusals through as safe, typed errors", async () => {
  const { deps, failCreate } = setup();
  failCreate(new WriteError("not_found"));

  await expect(submitSighting({ ...draft, photo: null }, "report-1", "user-1", deps, () => {})).rejects.toMatchObject({
    code: "not_found",
  });
});
