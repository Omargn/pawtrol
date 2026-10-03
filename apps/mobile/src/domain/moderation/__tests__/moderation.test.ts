import { availableActions, groupFlags, type OpenFlag } from "@/domain/moderation/moderation";

const flag = (overrides: Partial<OpenFlag>): OpenFlag => ({
  targetType: "report",
  targetId: "r1",
  reason: "spam",
  details: null,
  createdAt: "2026-10-02T10:00:00Z",
  ...overrides,
});

it("groups flags by target, longest-waiting target first", () => {
  const groups = groupFlags([
    flag({ targetId: "r2", createdAt: "2026-10-02T09:00:00Z" }),
    flag({ targetId: "r1", reason: "scam", createdAt: "2026-10-02T11:00:00Z" }),
    flag({ targetType: "message", targetId: "r1", createdAt: "2026-10-02T12:00:00Z" }),
    flag({ targetId: "r1", createdAt: "2026-10-02T10:00:00Z" }),
  ]);

  expect(groups.map((group) => `${group.targetType}:${group.targetId}:${group.flags.length}`)).toEqual([
    "report:r2:1",
    "report:r1:2",
    "message:r1:1",
  ]);
  expect(groups[1].flags.map((item) => item.reason)).toEqual(["spam", "scam"]);
});

it("offers only actions the server accepts from each status", () => {
  expect(availableActions("active")).toEqual(["hide", "remove"]);
  expect(availableActions("visible")).toEqual(["hide", "remove"]);
  expect(availableActions("hidden")).toEqual(["restore", "remove"]);
  expect(availableActions("removed")).toEqual(["restore"]);
});
