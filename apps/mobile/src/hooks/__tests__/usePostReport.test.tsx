import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { WriteError } from "@/domain/errors/writeError";
import { createPostHooks } from "@/hooks/createPostHooks";
import { reportKeys } from "@/hooks/createReportHooks";
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
  const { usePostReport } = createPostHooks({
    repository: fake.repository,
    storage: { upload: jest.fn(async () => {}) },
    preparer: { prepare: async ({ uri }) => ({ uri: `${uri}.prepared`, width: 1, height: 1 }) },
    picker,
    newId: () => `id-${++id}`,
    newFileId: () => `file-${++id}`,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { fake, picker, usePostReport, queryClient };
}

async function fillDraft(result: { current: ReturnType<ReturnType<typeof createPostHooks>["usePostReport"]> }) {
  await act(async () => {
    result.current.dispatch({ type: "setKind", kind: "found" });
    result.current.dispatch({ type: "next" });
    result.current.dispatch({ type: "update", fields: { speciesId: 2, description: "Grey cat", lastSeenAt: new Date() } });
    result.current.dispatch({ type: "next" });
    result.current.dispatch({ type: "setLocation", location: { latitude: 19.4, longitude: -99.1 } });
    result.current.dispatch({ type: "next" });
  });
  await act(async () => {
    await result.current.pickPhotos();
  });
  await act(async () => result.current.dispatch({ type: "next" }));
}

it("posts the report, then refreshes cached reports so the new pin appears", async () => {
  const { fake, usePostReport, queryClient } = setup();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(() => usePostReport(), { wrapper: createQueryWrapper(queryClient) });
  await fillDraft(result);

  await act(async () => result.current.submit("user-1"));

  expect(result.current.state.submission).toEqual({ status: "done", reportId: "created-1" });
  expect(fake.created.get("id-1")?.report.photoPaths).toEqual(["user-1/file-2.jpg"]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.all });
});

it("shows a failure and retries with the same idempotency key", async () => {
  const { fake, usePostReport, queryClient } = setup();
  const { result } = await renderHook(() => usePostReport(), { wrapper: createQueryWrapper(queryClient) });
  await fillDraft(result);
  fake.failCreate(new WriteError("offline"));

  await act(async () => result.current.submit("user-1"));
  expect(result.current.state.submission).toMatchObject({ status: "failed", error: { code: "offline" } });

  fake.failCreate(undefined);
  await act(async () => result.current.submit("user-1"));

  await waitFor(() => expect(result.current.state.submission.status).toBe("done"));
  expect(fake.created.size).toBe(1);
  expect([...fake.created.keys()]).toEqual(["id-1"]);
});

it("doesn't submit an incomplete draft", async () => {
  const { fake, usePostReport, queryClient } = setup();
  const { result } = await renderHook(() => usePostReport(), { wrapper: createQueryWrapper(queryClient) });

  await act(async () => result.current.submit("user-1"));

  expect(fake.calls.createReport).toBe(0);
  expect(result.current.state.submission.status).toBe("editing");
});

it("returns a message instead of throwing when the camera is off", async () => {
  const { usePostReport, queryClient } = setup();
  const { result } = await renderHook(() => usePostReport(), { wrapper: createQueryWrapper(queryClient) });

  let message: string | null = null;
  await act(async () => {
    message = await result.current.takePhoto();
  });

  expect(message).toMatch(/Camera access is off/);
  expect(result.current.state.draft.photos).toEqual([]);
});
