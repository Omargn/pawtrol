import { myReportStatus, reportTitle, timeAgo } from "@/features/reports/format";

const now = Date.parse("2026-10-02T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

it.each([
  [30_000, "just now"],
  [12 * 60_000, "12 min ago"],
  [5 * 3_600_000, "5 h ago"],
  [30 * 3_600_000, "yesterday"],
  [3 * 86_400_000, "3 days ago"],
])("says %ims ago as %s", (ms, expected) => {
  expect(timeAgo(ago(ms), now)).toBe(expected);
});

it("treats a clock that's slightly ahead as just now", () => {
  expect(timeAgo(new Date(now + 5_000).toISOString(), now)).toBe("just now");
});

it("falls back to a date after two weeks", () => {
  expect(timeAgo(ago(20 * 86_400_000), now)).not.toMatch(/ago/);
});

const species = [
  { id: 1, slug: "dog", label: "Dog" },
  { id: 99, slug: "other", label: "Other" },
];

it("titles a report by its pet's name, or by what was found", () => {
  expect(reportTitle({ petName: "Toby", kind: "lost", speciesId: 1 }, species)).toBe("Toby");
  expect(reportTitle({ petName: null, kind: "found", speciesId: 1 }, species)).toBe("Found dog");
  expect(reportTitle({ petName: null, kind: "found", speciesId: 99 }, species)).toBe("Found pet");
  expect(reportTitle({ petName: null, kind: "lost", speciesId: 42 }, undefined)).toBe("Lost pet");
});

describe("myReportStatus", () => {
  it("counts down an active report's days on the map", () => {
    expect(myReportStatus({ status: "active", expiresAt: "2026-10-12T12:00:00Z" }, now)).toBe(
      "On the map · expires in 10 days",
    );
    expect(myReportStatus({ status: "active", expiresAt: "2026-10-03T08:00:00Z" }, now)).toBe(
      "On the map · expires tomorrow",
    );
    expect(myReportStatus({ status: "active", expiresAt: "2026-10-02T11:00:00Z" }, now)).toBe("Expiring now");
  });

  it("explains every other status", () => {
    expect(myReportStatus({ status: "expired", expiresAt: "2026-10-01T12:00:00Z" }, now)).toMatch(/renew/);
    expect(myReportStatus({ status: "hidden", expiresAt: "2026-10-12T12:00:00Z" }, now)).toMatch(/moderators/);
  });
});
