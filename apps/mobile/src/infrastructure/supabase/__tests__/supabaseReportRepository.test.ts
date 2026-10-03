import { createSupabaseReportRepository } from "@/infrastructure/supabase/supabaseReportRepository";
import { makeQueryBuilder } from "@/test-utils/supabaseQueryBuilder";

const bbox = { minLng: -99.2, minLat: 19.3, maxLng: -99.0, maxLat: 19.5 };

function setup({ rpc, from }: { rpc?: { data: unknown; error: unknown }; from?: ReturnType<typeof makeQueryBuilder> }) {
  const client = {
    rpc: jest.fn(async () => rpc ?? { data: [], error: null }),
    from: jest.fn(() => from),
  };
  return { client, repository: createSupabaseReportRepository(client as any) };
}

describe("listInBbox", () => {
  it("asks for the box and maps rows to map reports", async () => {
    const { client, repository } = setup({
      rpc: {
        data: [
          {
            id: "r1", kind: "lost", species_id: 1, pet_name: "Toby", lng: -99.133, lat: 19.433,
            last_seen_at: "2026-10-01T10:00:00Z", sighting_count: 2, cover_photo: "u/1.jpg",
          },
        ],
        error: null,
      },
    });

    const reports = await repository.listInBbox(bbox, { kinds: ["lost"], speciesIds: null });

    expect(client.rpc).toHaveBeenCalledWith("reports_in_bbox", {
      min_lng: -99.2, min_lat: 19.3, max_lng: -99.0, max_lat: 19.5,
      kinds: ["lost"], species_ids: undefined, max_rows: 300,
    });
    expect(reports).toEqual([
      {
        id: "r1", kind: "lost", speciesId: 1, petName: "Toby",
        location: { longitude: -99.133, latitude: 19.433 },
        lastSeenAt: "2026-10-01T10:00:00Z", sightingCount: 2, coverPhotoPath: "u/1.jpg",
      },
    ]);
  });

  it("rejects with the underlying error", async () => {
    const failure = new Error("network");
    const { repository } = setup({ rpc: { data: null, error: failure } });

    await expect(repository.listInBbox(bbox, { kinds: null, speciesIds: null })).rejects.toBe(failure);
  });
});

describe("getReport", () => {
  const row = {
    id: "r1", kind: "found", status: "active", species_id: 2, pet_name: null, description: "Grey cat",
    color: "grey", size: "small", last_seen_at: "2026-10-01T10:00:00Z", public_lng: -99.1, public_lat: 19.4,
    sighting_count: 0, expires_at: "2026-10-31T10:00:00Z", created_at: "2026-10-01T11:00:00Z", created_by: "u1",
    author: { display_name: "Ana" },
    photos: [{ id: "p1", storage_path: "u/a.jpg", position: 0 }],
  };

  it("names its columns, since the exact location column is not readable", async () => {
    const builder = makeQueryBuilder({ data: row, error: null });
    const { client, repository } = setup({ from: builder });

    await repository.getReport("r1");

    expect(client.from).toHaveBeenCalledWith("pet_reports");
    const columns: string = builder.select.mock.calls[0][0];
    expect(columns).not.toMatch(/\*/);
    expect(columns).not.toMatch(/\blocation\b/);
    expect(builder.eq).toHaveBeenCalledWith("id", "r1");
  });

  it("maps the row, identifying the author only by id and display name", async () => {
    const { repository } = setup({ from: makeQueryBuilder({ data: row, error: null }) });

    await expect(repository.getReport("r1")).resolves.toEqual({
      id: "r1", kind: "found", status: "active", speciesId: 2, petName: null, description: "Grey cat",
      color: "grey", size: "small", lastSeenAt: "2026-10-01T10:00:00Z",
      location: { longitude: -99.1, latitude: 19.4 }, sightingCount: 0,
      expiresAt: "2026-10-31T10:00:00Z", createdAt: "2026-10-01T11:00:00Z",
      authorId: "u1", authorName: "Ana", photos: [{ id: "p1", path: "u/a.jpg" }],
    });
  });

  it("answers null for a report that doesn't exist or isn't visible", async () => {
    const { repository } = setup({ from: makeQueryBuilder({ data: null, error: null }) });

    await expect(repository.getReport("nope")).resolves.toBeNull();
  });
});

describe("listSightings", () => {
  it("only lists visible sightings, newest first, even though RLS also returns the caller's hidden ones", async () => {
    const builder = makeQueryBuilder({
      data: [{ id: "s1", seen_at: "2026-10-01T12:00:00Z", note: "By the park", photo_path: null, public_lng: -99.15, public_lat: 19.42, author: { display_name: "Ben" } }],
      error: null,
    });
    const { repository } = setup({ from: builder });

    const sightings = await repository.listSightings("r1");

    expect(builder.eq).toHaveBeenCalledWith("report_id", "r1");
    expect(builder.eq).toHaveBeenCalledWith("status", "visible");
    expect(builder.order).toHaveBeenCalledWith("seen_at", { ascending: false });
    expect(sightings).toEqual([
      { id: "s1", seenAt: "2026-10-01T12:00:00Z", note: "By the park", photoPath: null, location: { longitude: -99.15, latitude: 19.42 }, authorName: "Ben" },
    ]);
  });
});

describe("addSighting", () => {
  const sighting = {
    clientId: "c1", reportId: "r1", seenAt: "2026-10-02T10:00:00.000Z",
    location: { latitude: 19.4321, longitude: -99.1334 }, note: null, photoPath: "u1/f.jpg",
  };

  it("sends the exact point and leaves out a missing note", async () => {
    const { client, repository } = setup({ rpc: { data: "s1", error: null } });

    await expect(repository.addSighting(sighting)).resolves.toBe("s1");
    expect(client.rpc).toHaveBeenCalledWith("add_sighting", {
      p_client_id: "c1", p_report_id: "r1", p_seen_at: "2026-10-02T10:00:00.000Z",
      p_lng: -99.1334, p_lat: 19.4321, p_note: undefined, p_photo_path: "u1/f.jpg",
    });
  });

  it("rejects with a safe, typed error", async () => {
    const { repository } = setup({ rpc: { data: null, error: { message: "not_found", code: "P0002" } } });

    await expect(repository.addSighting(sighting)).rejects.toMatchObject({
      name: "WriteError", code: "not_found", message: "That report isn't available anymore.",
    });
  });
});
