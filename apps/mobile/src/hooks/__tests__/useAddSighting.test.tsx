import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { WriteError } from "@/domain/errors/writeError";
import { reportKeys } from "@/hooks/createReportHooks";
import { createSightingHooks } from "@/hooks/createSightingHooks";
import { createInMemoryReportRepository } from "@/test-utils/inMemoryReportRepository";
import { createQueryWrapper } from "@/test-utils/queryWrapper";

function setup() {
  const fake = createInMemoryReportRepository();
  let id = 0;
  const picker = {
    pickFromLibrary: jest.fn(async () => [{ uri: "file:///a.jpg" }]),
    takePhoto: jest.fn(async (): Promise<{ uri: string } | null> => {
      throw new Error("Camera access is off. You can turn it on in Settings.");
    }),
  };
  const upload = jest.fn(async () => {});
  const { useAddSighting } = createSightingHooks({
    repository: fake.repository,
    storage: { upload },
    preparer: { prepare: async ({ uri }) => ({ uri: `${uri}.prepared`, width: 1, height: 1 }) },
    picker,
    newId: () => `id-${++id}`,
    newFileId: () => `file-${++id}`,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { fake, picker, upload, useAddSighting, queryClient };
}

type Result = { current: ReturnType<ReturnType<typeof createSightingHooks>["useAddSighting"]> };

async function fillDraft(result: Result) {
  await act(async () => {
    result.current.dispatch({ type: "update", fields: { location: { latitude: 19.4, longitude: -99.1 } } });
    result.current.dispatch({ type: "next" });
    result.current.dispatch({ type: "update", fields: { note: "By the market" } });
  });
  await act(async () => {
    await result.current.pickPhoto();
  });
}

it("adds the sighting, then refreshes the timeline and the report's count", async () => {
  const { fake, picker, useAddSighting, queryClient } = setup();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(() => useAddSighting("report-1"), { wrapper: createQueryWrapper(queryClient) });
  await fillDraft(result);

  await act(async () => result.current.submit("user-1"));

  expect(picker.pickFromLibrary).toHaveBeenCalledWith(1);
  expect(result.current.state.submission).toEqual({ status: "done", sightingId: "sighting-1" });
  expect(fake.addedSightings.get("id-1")?.sighting).toMatchObject({
    reportId: "report-1",
    note: "By the market",
    photoPath: "user-1/file-2.jpg",
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.sightings("report-1") });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.all });
});

it("shows a failure and retries with the same key, without uploading the photo again", async () => {
  const { fake, upload, useAddSighting, queryClient } = setup();
  const { result } = await renderHook(() => useAddSighting("report-1"), { wrapper: createQueryWrapper(queryClient) });
  await fillDraft(result);
  fake.failCreate(new WriteError("offline"));

  await act(async () => result.current.submit("user-1"));
  expect(result.current.state.submission).toMatchObject({ status: "failed", error: { code: "offline" } });

  fake.failCreate(undefined);
  await act(async () => result.current.submit("user-1"));

  expect(result.current.state.submission.status).toBe("done");
  expect(upload).toHaveBeenCalledTimes(1);
  expect([...fake.addedSightings.keys()]).toEqual(["id-1"]);
});

it("doesn't submit without a location", async () => {
  const { fake, useAddSighting, queryClient } = setup();
  const { result } = await renderHook(() => useAddSighting("report-1"), { wrapper: createQueryWrapper(queryClient) });

  await act(async () => result.current.submit("user-1"));

  expect(fake.calls.addSighting).toBe(0);
  expect(result.current.state.submission.status).toBe("editing");
});

it("returns a message instead of throwing when the camera is off", async () => {
  const { useAddSighting, queryClient } = setup();
  const { result } = await renderHook(() => useAddSighting("report-1"), { wrapper: createQueryWrapper(queryClient) });

  let message: string | null = null;
  await act(async () => {
    message = await result.current.takePhoto();
  });

  expect(message).toMatch(/Camera access is off/);
  expect(result.current.state.draft.photo).toBeNull();
});
