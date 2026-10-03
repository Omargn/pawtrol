import { WriteError } from "@/domain/errors/writeError";
import { submitReport, type Draft, type SubmitDependencies } from "@/domain/reports/submitReport";
import { createInMemoryReportRepository } from "@/test-utils/inMemoryReportRepository";

const draft: Draft = {
  clientId: "client-1",
  kind: "lost",
  speciesId: 1,
  petName: "  Toby ",
  description: " Brown dog ",
  color: "",
  size: "medium",
  lastSeenAt: new Date("2026-10-02T10:00:00Z"),
  location: { latitude: 19.4321, longitude: -99.1334 },
  photos: [{ localUri: "file:///camera/IMG_1.HEIC" }, { localUri: "file:///camera/IMG_2.HEIC" }],
};

function setup() {
  const { repository, created, failCreate } = createInMemoryReportRepository();
  const uploads: { localUri: string; path: string }[] = [];
  let failUploadAt: number | null = null;
  let fileId = 0;
  const deps: SubmitDependencies = {
    repository,
    preparer: { prepare: jest.fn(async ({ uri }) => ({ uri: `${uri}.prepared.jpg`, width: 10, height: 10 })) },
    storage: {
      upload: jest.fn(async (localUri, path) => {
        if (uploads.length === failUploadAt) throw new TypeError("Network request failed");
        uploads.push({ localUri, path });
      }),
    },
    newFileId: () => `file-${++fileId}`,
  };
  return { deps, uploads, created, failCreate, failUploadAt: (n: number | null) => (failUploadAt = n) };
}

it("only ever uploads the prepared copy, never the original with its EXIF", async () => {
  const { deps, uploads } = setup();

  await submitReport(draft, "user-1", deps, () => {});

  expect(uploads.map((upload) => upload.localUri)).toEqual([
    "file:///camera/IMG_1.HEIC.prepared.jpg",
    "file:///camera/IMG_2.HEIC.prepared.jpg",
  ]);
  for (const photo of draft.photos) {
    expect(uploads.map((upload) => upload.localUri)).not.toContain(photo.localUri);
  }
});

it("uploads into the user's own folder and publishes with those paths, trimmed fields and the exact point", async () => {
  const { deps, created } = setup();

  const id = await submitReport(draft, "user-1", deps, () => {});

  expect(created.get("client-1")).toEqual({
    id,
    report: {
      clientId: "client-1",
      kind: "lost",
      speciesId: 1,
      description: "Brown dog",
      lastSeenAt: "2026-10-02T10:00:00.000Z",
      location: { latitude: 19.4321, longitude: -99.1334 },
      petName: "Toby",
      color: null,
      size: "medium",
      photoPaths: ["user-1/file-1.jpg", "user-1/file-2.jpg"],
    },
  });
});

it("reports each upload so a retry can skip it, and skips already-uploaded photos", async () => {
  const { deps, uploads, failUploadAt } = setup();
  const reported: string[] = [];
  failUploadAt(1);

  await expect(submitReport(draft, "user-1", deps, (_, path) => reported.push(path))).rejects.toMatchObject({
    code: "offline",
  });
  expect(reported).toEqual(["user-1/file-1.jpg"]);

  failUploadAt(null);
  const retried: Draft = { ...draft, photos: [{ ...draft.photos[0], uploadedPath: reported[0] }, draft.photos[1]] };
  await submitReport(retried, "user-1", deps, () => {});

  // Two uploads in total: the first photo was not sent again. The second gets a
  // fresh path, since its failed attempt may or may not have reached storage.
  expect(uploads).toHaveLength(2);
  expect(uploads[0]).toEqual({ localUri: "file:///camera/IMG_1.HEIC.prepared.jpg", path: "user-1/file-1.jpg" });
  expect(uploads[1].localUri).toBe("file:///camera/IMG_2.HEIC.prepared.jpg");
});

it("doesn't create a second report when the same draft is submitted again", async () => {
  const { deps, created } = setup();

  const first = await submitReport(draft, "user-1", deps, () => {});
  const second = await submitReport({ ...draft, photos: [] }, "user-1", deps, () => {});

  expect(second).toBe(first);
  expect(created.size).toBe(1);
});

it("passes server refusals through as safe, typed errors", async () => {
  const { deps, failCreate } = setup();
  failCreate(new WriteError("rate_limited"));

  await expect(submitReport({ ...draft, photos: [] }, "user-1", deps, () => {})).rejects.toMatchObject({
    code: "rate_limited",
  });
});
