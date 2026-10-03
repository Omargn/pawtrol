import { createSupabaseModerationRepository } from "@/infrastructure/supabase/supabaseModerationRepository";
import { makeQueryBuilder } from "@/test-utils/supabaseQueryBuilder";

function setup(tables: Record<string, ReturnType<typeof makeQueryBuilder>>, rpc = { data: null as unknown, error: null as unknown }) {
  const client = {
    rpc: jest.fn(async () => rpc),
    from: jest.fn((table: string) => tables[table]),
  };
  return { client, repository: createSupabaseModerationRepository(client as any) };
}

describe("listQueue", () => {
  it("loads open flags, then each target type's content in one request", async () => {
    const flags = makeQueryBuilder({
      data: [
        { target_type: "message", target_id: "m1", reason: "scam", details: "asks for a deposit", created_at: "2026-10-02T09:00:00Z" },
        { target_type: "report", target_id: "r1", reason: "spam", details: null, created_at: "2026-10-02T10:00:00Z" },
        { target_type: "report", target_id: "gone", reason: "spam", details: null, created_at: "2026-10-02T11:00:00Z" },
      ],
      error: null,
    });
    const reports = makeQueryBuilder({ data: [{ id: "r1", status: "hidden", description: "Free puppies" }], error: null });
    const messages = makeQueryBuilder({ data: [{ id: "m1", status: "visible", body: "Send money first" }], error: null });
    const { client, repository } = setup({ content_flags: flags, pet_reports: reports, messages });

    const queue = await repository.listQueue();

    expect(flags.is).toHaveBeenCalledWith("resolved_at", null);
    expect(reports.in).toHaveBeenCalledWith("id", ["r1", "gone"]);
    expect(client.from).not.toHaveBeenCalledWith("sightings");
    expect(queue).toEqual([
      expect.objectContaining({ targetType: "message", targetId: "m1", content: { status: "visible", text: "Send money first", reportId: null } }),
      expect.objectContaining({ targetType: "report", targetId: "r1", content: { status: "hidden", text: "Free puppies", reportId: "r1" } }),
      expect.objectContaining({ targetType: "report", targetId: "gone", content: null }),
    ]);
  });
});

describe("listRecentlyModerated", () => {
  it("keeps targets whose latest event took them down and that are still down", async () => {
    const events = makeQueryBuilder({
      data: [
        { target_type: "report", target_id: "r1", action: "hidden", created_at: "2026-10-02T12:00:00Z" },
        { target_type: "report", target_id: "r2", action: "restored", created_at: "2026-10-02T11:00:00Z" },
        { target_type: "report", target_id: "r2", action: "hidden", created_at: "2026-10-02T10:00:00Z" },
        { target_type: "report", target_id: "r3", action: "auto_hidden", created_at: "2026-10-02T09:00:00Z" },
        { target_type: "report", target_id: "r1", action: "auto_hidden", created_at: "2026-10-02T08:00:00Z" },
      ],
      error: null,
    });
    // r3 was renewed back into view since, so there's nothing to undo.
    const reports = makeQueryBuilder({
      data: [
        { id: "r1", status: "hidden", description: "Free puppies" },
        { id: "r3", status: "active", description: "Back up" },
      ],
      error: null,
    });
    const { repository } = setup({ moderation_events: events, pet_reports: reports });

    const recent = await repository.listRecentlyModerated();

    expect(events.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(reports.in).toHaveBeenCalledWith("id", ["r1", "r3"]);
    expect(recent).toEqual([
      {
        targetType: "report", targetId: "r1", action: "hidden", at: "2026-10-02T12:00:00Z",
        content: { status: "hidden", text: "Free puppies", reportId: "r1" },
      },
    ]);
  });
});

describe("writes", () => {
  it("flags and moderates through the RPCs", async () => {
    const { client, repository } = setup({}, { data: "hidden", error: null });

    await repository.flag({ targetType: "sighting", targetId: "s1", reason: "abuse", details: null });
    await expect(repository.moderate("sighting", "s1", "hide", null)).resolves.toBe("hidden");

    expect(client.rpc).toHaveBeenCalledWith("flag_content", {
      p_target_type: "sighting", p_target_id: "s1", p_reason: "abuse", p_details: undefined,
    });
    expect(client.rpc).toHaveBeenCalledWith("moderate", {
      p_target_type: "sighting", p_target_id: "s1", p_action: "hide", p_reason: undefined,
    });
  });

  it("maps refusals to safe errors", async () => {
    const { repository } = setup({}, { data: null, error: { code: "42501", message: "not_allowed" } });

    await expect(repository.moderate("report", "r1", "remove", null)).rejects.toMatchObject({ code: "not_allowed" });
    await expect(repository.flag({ targetType: "report", targetId: "r1", reason: "spam", details: null })).rejects.toMatchObject({
      code: "not_allowed",
    });
  });
});
