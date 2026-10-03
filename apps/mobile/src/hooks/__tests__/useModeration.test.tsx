import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createModerationHooks, moderationKeys } from "@/hooks/createModerationHooks";
import { reportKeys } from "@/hooks/createReportHooks";
import { createInMemoryModerationRepository } from "@/test-utils/inMemoryModerationRepository";
import { createQueryWrapper } from "@/test-utils/queryWrapper";

function setup(options: Parameters<typeof createInMemoryModerationRepository>[0] = {}) {
  const fake = createInMemoryModerationRepository(options);
  const hooks = createModerationHooks(fake.repository);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return { fake, hooks, queryClient, wrapper: createQueryWrapper(queryClient) };
}

it("asks for the role only when signed in", async () => {
  const { fake, hooks, wrapper } = setup({ moderator: true });
  const { result, rerender } = await renderHook(({ userId }: { userId: string | null }) => hooks.useIsModerator(userId), {
    wrapper,
    initialProps: { userId: null },
  });

  expect(result.current).toBe(false);
  expect(fake.calls.isModerator).toBe(0);

  await rerender({ userId: "u1" });
  await waitFor(() => expect(result.current).toBe(true));
});

it("records a flag and refreshes where the content shows, in case it got hidden", async () => {
  const { fake, hooks, wrapper, queryClient } = setup();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(() => hooks.useFlagContent(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ targetType: "sighting", targetId: "s1", reason: "abuse", details: null });
  });

  expect(fake.flags).toEqual([{ targetType: "sighting", targetId: "s1", reason: "abuse", details: null }]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sightings"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.all });
});

it("moderates, then refreshes the queue and the content", async () => {
  const { fake, hooks, wrapper, queryClient } = setup({ moderator: true });
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(() => hooks.useModerate(), { wrapper });

  let status = "";
  await act(async () => {
    status = await result.current.mutateAsync({ targetType: "message", targetId: "m1", action: "hide", reason: null });
  });

  expect(status).toBe("hidden");
  expect(fake.actions).toEqual([{ targetId: "m1", action: "hide" }]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: moderationKeys.queue() });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["messages"] });
});

it("doesn't load the queue for someone who isn't a moderator", async () => {
  const { fake, hooks, wrapper } = setup();
  const { result } = await renderHook(() => hooks.useModerationQueue(false), { wrapper });

  expect(result.current.fetchStatus).toBe("idle");
  expect(fake.calls.listQueue).toBe(0);
});
