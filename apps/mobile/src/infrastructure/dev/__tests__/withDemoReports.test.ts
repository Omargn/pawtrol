import { DEMO_ID_PREFIX, withDemoReports } from "@/infrastructure/dev/withDemoReports";
import { createInMemoryReportRepository, makeMapReport, makeReportDetail } from "@/test-utils/inMemoryReportRepository";

const city = { minLng: -99.3, minLat: 19.3, maxLng: -98.9, maxLat: 19.6 };
const now = Date.parse("2026-10-02T12:00:00Z");

it("adds demo reports next to the real ones, newest first", async () => {
  const { repository } = createInMemoryReportRepository({
    reports: [makeMapReport({ id: "real", lastSeenAt: "2026-10-02T11:59:00Z" })],
  });

  const reports = await withDemoReports(repository, now).listInBbox(city, { kinds: null, speciesIds: null });

  expect(reports[0].id).toBe("real");
  expect(reports.filter((report) => report.id.startsWith(DEMO_ID_PREFIX)).length).toBeGreaterThan(40);
});

it("applies the box and the filters to demo reports too", async () => {
  const { repository } = createInMemoryReportRepository();
  const demo = withDemoReports(repository, now);

  const found = await demo.listInBbox(city, { kinds: ["found"], speciesIds: null });
  const elsewhere = await demo.listInBbox({ minLng: 2, minLat: 48, maxLng: 3, maxLat: 49 }, { kinds: null, speciesIds: null });

  expect(found.every((report) => report.kind === "found")).toBe(true);
  expect(elsewhere).toEqual([]);
});

it("is deterministic and already on the server's ~100 m grid", async () => {
  const { repository } = createInMemoryReportRepository();
  const first = await withDemoReports(repository, now).listInBbox(city, { kinds: null, speciesIds: null });
  const second = await withDemoReports(repository, now).listInBbox(city, { kinds: null, speciesIds: null });

  expect(second).toEqual(first);
  for (const { location } of first) {
    expect(location.latitude).toBe(Math.round(location.latitude * 1000) / 1000);
  }
});

it("serves demo details itself and passes real ids through", async () => {
  const { repository, calls } = createInMemoryReportRepository({ details: [makeReportDetail({ id: "real" })] });
  const demo = withDemoReports(repository, now);

  await expect(demo.getReport(`${DEMO_ID_PREFIX}1`)).resolves.toMatchObject({ id: `${DEMO_ID_PREFIX}1` });
  expect(calls.getReport).toBe(0);
  await expect(demo.getReport("real")).resolves.toMatchObject({ id: "real" });
});

it("lets real failures through unchanged", async () => {
  const failure = new Error("offline");
  const { repository } = createInMemoryReportRepository({ failWith: failure });

  await expect(withDemoReports(repository, now).listInBbox(city, { kinds: null, speciesIds: null })).rejects.toBe(failure);
});
