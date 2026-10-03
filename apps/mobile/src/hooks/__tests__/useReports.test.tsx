import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { Bbox, ReportFilters } from "@/domain/reports/report";
import { createReportHooks, reportKeys } from "@/hooks/createReportHooks";
import { createInMemoryReportRepository, makeMapReport, makeReportDetail } from "@/test-utils/inMemoryReportRepository";
import { createQueryWrapper } from "@/test-utils/queryWrapper";

// Not aligned to the snapping grid, like any box a real map produces.
const cityBox = { minLng: -99.1834, minLat: 19.3812, maxLng: -99.0712, maxLat: 19.4877 };
const noFilters = { kinds: null, speciesIds: null };

describe("useReportsInBbox", () => {
  it("loads the reports in the visible area", async () => {
    const { repository } = createInMemoryReportRepository({
      reports: [makeMapReport({ id: "in" }), makeMapReport({ id: "out", location: { latitude: 40.7, longitude: -74 } })],
    });
    const { useReportsInBbox } = createReportHooks(repository);

    const { result } = await renderHook(() => useReportsInBbox(cityBox, noFilters), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((report) => report.id)).toEqual(["in"]);
  });

  it("doesn't fetch before the map knows its area", async () => {
    const { repository, calls } = createInMemoryReportRepository();
    const { useReportsInBbox } = createReportHooks(repository);

    const { result } = await renderHook(() => useReportsInBbox(null, noFilters), { wrapper: createQueryWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(calls.listInBbox).toBe(0);
  });

  it("reuses the cached answer for a small pan", async () => {
    const { repository, calls } = createInMemoryReportRepository({ reports: [makeMapReport()] });
    const { useReportsInBbox } = createReportHooks(repository);

    const { result, rerender } = await renderHook(({ bbox }: { bbox: Bbox }) => useReportsInBbox(bbox, noFilters), {
      wrapper: createQueryWrapper(),
      initialProps: { bbox: cityBox },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await rerender({ bbox: { ...cityBox, minLng: cityBox.minLng + 0.001, maxLng: cityBox.maxLng + 0.001 } });

    expect(calls.listInBbox).toBe(1);
  });

  it("keeps the previous pins up while a new filter loads", async () => {
    const { repository } = createInMemoryReportRepository({
      reports: [makeMapReport({ id: "lost-1" }), makeMapReport({ id: "found-1", kind: "found" })],
    });
    const { useReportsInBbox } = createReportHooks(repository);

    const { result, rerender } = await renderHook(({ filters }: { filters: ReportFilters }) => useReportsInBbox(cityBox, filters), {
      wrapper: createQueryWrapper(),
      initialProps: { filters: noFilters as ReportFilters },
    });
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    await rerender({ filters: { kinds: ["found"], speciesIds: null } });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.isPlaceholderData).toBe(true);

    await waitFor(() => expect(result.current.data?.map((report) => report.id)).toEqual(["found-1"]));
  });

  it("surfaces a failed read", async () => {
    const { repository } = createInMemoryReportRepository({ failWith: new Error("offline") });
    const { useReportsInBbox } = createReportHooks(repository);

    const { result } = await renderHook(() => useReportsInBbox(cityBox, noFilters), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("offline");
  });
});

describe("useReport", () => {
  it("loads one report", async () => {
    const { repository } = createInMemoryReportRepository({ details: [makeReportDetail({ id: "r1", petName: "Luna" })] });
    const { useReport } = createReportHooks(repository);

    const { result } = await renderHook(() => useReport("r1"), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.data?.petName).toBe("Luna"));
  });

  it("answers null, not an error, for a report that isn't visible", async () => {
    const { repository } = createInMemoryReportRepository();
    const { useReport } = createReportHooks(repository);

    const { result } = await renderHook(() => useReport("gone"), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("your own reports", () => {
  function ownSetup() {
    const fake = createInMemoryReportRepository({
      details: [
        makeReportDetail({ id: "mine", authorId: "me", status: "expired" }),
        makeReportDetail({ id: "theirs", authorId: "someone" }),
      ],
    });
    const hooks = createReportHooks(fake.repository);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
    return { fake, hooks, queryClient, wrapper: createQueryWrapper(queryClient) };
  }

  it("lists only the signed-in user's reports, and nothing while signed out", async () => {
    const { hooks, wrapper } = ownSetup();
    const { result, rerender } = await renderHook(({ userId }: { userId: string | null }) => hooks.useMyReports(userId), {
      wrapper,
      initialProps: { userId: null },
    });
    expect(result.current.fetchStatus).toBe("idle");

    await rerender({ userId: "me" });
    await waitFor(() => expect(result.current.data?.map((report) => report.id)).toEqual(["mine"]));
  });

  it("renews and closes a report, refreshing every report query", async () => {
    const { fake, hooks, wrapper, queryClient } = ownSetup();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderHook(() => hooks.useReportStatusActions(), { wrapper });

    await act(async () => {
      await result.current.renew.mutateAsync("mine");
    });
    expect((await fake.repository.getReport("mine"))?.status).toBe("active");

    await act(async () => {
      await result.current.markReunited.mutateAsync("mine");
    });
    expect((await fake.repository.getReport("mine"))?.status).toBe("reunited");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.all });
  });

  it("can't renew a report that's already closed", async () => {
    const { hooks, wrapper } = ownSetup();
    const { result } = await renderHook(() => hooks.useReportStatusActions(), { wrapper });

    await act(async () => {
      await result.current.markReunited.mutateAsync("mine");
    });
    await act(async () => {
      await expect(result.current.renew.mutateAsync("mine")).rejects.toMatchObject({ code: "not_allowed" });
    });
  });
});
