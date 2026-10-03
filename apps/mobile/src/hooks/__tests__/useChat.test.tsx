import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { MESSAGES_PAGE_SIZE } from "@/domain/chat/chat";
import { WriteError } from "@/domain/errors/writeError";
import { chatKeys, createChatHooks, upsertMessage } from "@/hooks/createChatHooks";
import { createInMemoryChatRepository, makeConversation, makeMessage } from "@/test-utils/inMemoryChatRepository";
import { createQueryWrapper } from "@/test-utils/queryWrapper";

function setup(options: Parameters<typeof createInMemoryChatRepository>[0] = {}) {
  const fake = createInMemoryChatRepository(options);
  let id = 0;
  const hooks = createChatHooks(fake.repository, () => `new-${++id}`, () => new Date("2026-10-02T12:00:00Z"));
  // Mutations default to a 5-minute gc timer, which would keep Jest from exiting.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: 0 } },
  });
  return { fake, hooks, queryClient, wrapper: createQueryWrapper(queryClient) };
}

describe("useMessages", () => {
  it("pages backwards from the newest message", async () => {
    const messages = Array.from({ length: MESSAGES_PAGE_SIZE + 5 }, (_, i) =>
      makeMessage({ id: `m${i}`, createdAt: new Date(Date.UTC(2026, 9, 2, 10, i)).toISOString() }),
    );
    const { hooks, wrapper } = setup({ messages });
    const { result } = await renderHook(() => hooks.useMessages("conversation-1"), { wrapper });

    await waitFor(() => expect(result.current.messages).toHaveLength(MESSAGES_PAGE_SIZE));
    expect(result.current.messages[0].id).toBe(`m${MESSAGES_PAGE_SIZE + 4}`);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(MESSAGES_PAGE_SIZE + 5));
    expect(result.current.messages.at(-1)?.id).toBe("m0");
    expect(result.current.hasNextPage).toBe(false);
  });

  it("shows messages arriving over Realtime, once, and stops listening when unmounted", async () => {
    const { fake, hooks, wrapper } = setup({ messages: [makeMessage()] });
    const { result, unmount } = await renderHook(() => hooks.useMessages("conversation-1"), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    const incoming = makeMessage({ id: "m2", body: "Still there?", createdAt: "2026-10-02T11:00:00Z" });
    await act(async () => {
      fake.emit(incoming);
      fake.emit(incoming);
      fake.emit(makeMessage({ id: "elsewhere", conversationId: "conversation-2" }));
    });

    await waitFor(() => expect(result.current.messages.map((message) => message.id)).toEqual(["m2", "message-1"]));
    await unmount();
    expect(fake.listenerCount()).toBe(0);
  });
});

describe("useSendMessage", () => {
  it("shows the message while sending, then keeps it in the conversation", async () => {
    const { fake, hooks, wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderHook(
      () => ({ send: hooks.useSendMessage("conversation-1", "me"), list: hooks.useMessages("conversation-1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      expect(result.current.send.send("  On my way  ")).toBeNull();
    });

    await waitFor(() => expect(result.current.send.outgoing).toEqual([]));
    expect(fake.sent.get("new-1")?.body).toBe("On my way");
    expect(result.current.list.messages.map((message) => message.id)).toEqual(["new-1"]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatKeys.all });
  });

  it("doesn't send a blank message", async () => {
    const { fake, hooks, wrapper } = setup();
    const { result } = await renderHook(() => hooks.useSendMessage("conversation-1", "me"), { wrapper });

    let issue: string | null = null;
    await act(async () => {
      issue = result.current.send("   ");
    });

    expect(issue).toBe("Write a message first.");
    expect(fake.calls.sendMessage).toBe(0);
  });

  it("marks a failed send and retries it with the same id", async () => {
    const { fake, hooks, wrapper } = setup();
    const { result } = await renderHook(() => hooks.useSendMessage("conversation-1", "me"), { wrapper });
    fake.failSend(new WriteError("offline"));

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.outgoing[0]?.failed?.code).toBe("offline"));

    fake.failSend(undefined);
    await act(async () => {
      result.current.retry("new-1");
    });

    await waitFor(() => expect(result.current.outgoing).toEqual([]));
    expect(fake.calls.sendMessage).toBe(2);
    expect([...fake.sent.keys()]).toEqual(["new-1"]);
  });
});

it("starts a conversation and refreshes the inbox", async () => {
  const { fake, hooks, wrapper, queryClient } = setup();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(() => hooks.useStartConversation(), { wrapper });

  let id = "";
  await act(async () => {
    id = await result.current.mutateAsync("report-9");
  });

  expect(id).toBe("conversation-for-report-9");
  expect(fake.calls.startConversation).toBe(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: chatKeys.all });
});

it("doesn't load or listen for conversations while signed out", async () => {
  const { fake, hooks, wrapper } = setup({ conversations: [makeConversation()] });
  const { result, rerender } = await renderHook(({ enabled }: { enabled: boolean }) => hooks.useConversations(enabled), {
    wrapper,
    initialProps: { enabled: false },
  });

  expect(result.current.fetchStatus).toBe("idle");
  expect(fake.listenerCount()).toBe(0);

  await rerender({ enabled: true });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(fake.listenerCount()).toBe(1);
});

describe("upsertMessage", () => {
  const page = (ids: string[]) => ({ pages: [ids.map((id, i) => makeMessage({ id, createdAt: `2026-10-02T10:0${9 - i}:00Z` }))], pageParams: [null] });

  it("replaces a message it already has, so the server's copy wins", () => {
    const updated = upsertMessage(page(["a", "b"]), makeMessage({ id: "b", body: "server copy", createdAt: "2026-10-02T10:08:00Z" }));
    expect(updated?.pages[0].map((message) => message.body)).toEqual(["I think I saw your dog", "server copy"]);
  });

  it("puts a new message in time order", () => {
    const updated = upsertMessage(page(["a", "b"]), makeMessage({ id: "c", createdAt: "2026-10-02T10:08:30Z" }));
    expect(updated?.pages[0].map((message) => message.id)).toEqual(["a", "c", "b"]);
  });

  it("leaves a conversation that isn't loaded alone", () => {
    expect(upsertMessage(undefined, makeMessage())).toBeUndefined();
  });
});
