import { createSupabaseChatRepository } from "@/infrastructure/supabase/supabaseChatRepository";
import { makeQueryBuilder } from "@/test-utils/supabaseQueryBuilder";

function setup({ rpc, from }: { rpc?: { data: unknown; error: unknown }; from?: ReturnType<typeof makeQueryBuilder> }) {
  const handlers: ((payload: { new: unknown }) => void)[] = [];
  const channel: any = {
    on: jest.fn((_type, _filter, handler) => {
      handlers.push(handler);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const client = {
    rpc: jest.fn(async () => rpc ?? { data: null, error: null }),
    from: jest.fn(() => from),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => "ok"),
  };
  return { client, channel, handlers, repository: createSupabaseChatRepository(client as any) };
}

const conversationRow = {
  id: "c1",
  created_at: "2026-10-02T10:00:00Z",
  report: { id: "r1", kind: "lost", pet_name: "Toby", species_id: 1, status: "active" },
  owner: { id: "u1", display_name: "Ana" },
  contact: { id: "u2", display_name: "Ben" },
  messages: [{ body: "Seen near the park", sender_id: "u2", created_at: "2026-10-02T10:05:00Z" }],
};

const messageRow = {
  id: "m1", conversation_id: "c1", sender_id: "u2", body: "Hi", created_at: "2026-10-02T10:05:00Z", status: "visible",
};

describe("listConversations", () => {
  it("loads the inbox with each last message in one request, most recent first", async () => {
    const builder = makeQueryBuilder({ data: [conversationRow], error: null });
    const { client, repository } = setup({ from: builder });

    await expect(repository.listConversations()).resolves.toEqual([
      {
        id: "c1",
        report: { id: "r1", kind: "lost", petName: "Toby", speciesId: 1, status: "active" },
        owner: { id: "u1", name: "Ana" },
        contact: { id: "u2", name: "Ben" },
        lastMessage: { body: "Seen near the park", senderId: "u2", createdAt: "2026-10-02T10:05:00Z" },
        createdAt: "2026-10-02T10:00:00Z",
      },
    ]);
    expect(client.from).toHaveBeenCalledWith("conversations");
    expect(builder.limit).toHaveBeenCalledWith(1, { referencedTable: "messages" });
    expect(builder.order).toHaveBeenCalledWith("last_message_at", { ascending: false, nullsFirst: false });
    expect(builder.limit).toHaveBeenCalledWith(50);
  });

  it("keeps a conversation whose report the caller can no longer see", async () => {
    const { repository } = setup({ from: makeQueryBuilder({ data: [{ ...conversationRow, report: null, messages: [] }], error: null }) });

    await expect(repository.listConversations()).resolves.toMatchObject([{ report: null, lastMessage: null }]);
  });
});

describe("listMessages", () => {
  it("pages backwards from a cursor", async () => {
    const builder = makeQueryBuilder({ data: [messageRow], error: null });
    const { repository } = setup({ from: builder });

    const messages = await repository.listMessages("c1", "2026-10-02T11:00:00Z");

    expect(messages).toEqual([
      { id: "m1", conversationId: "c1", senderId: "u2", body: "Hi", createdAt: "2026-10-02T10:05:00Z", status: "visible" },
    ]);
    expect(builder.eq).toHaveBeenCalledWith("conversation_id", "c1");
    expect(builder.lt).toHaveBeenCalledWith("created_at", "2026-10-02T11:00:00Z");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("sendMessage", () => {
  const message = { id: "m1", conversationId: "c1", body: "Hi" };

  it("sends the client's id with the message, never a sender", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    const { repository } = setup({ from: builder });

    await repository.sendMessage(message);

    expect(builder.insert).toHaveBeenCalledWith({ id: "m1", conversation_id: "c1", body: "Hi" });
  });

  it("treats an id that's already taken as already sent", async () => {
    const { repository } = setup({ from: makeQueryBuilder({ data: null, error: { code: "23505", message: "duplicate key" } }) });

    await expect(repository.sendMessage(message)).resolves.toBeUndefined();
  });

  it("rejects anything else with a safe, typed error", async () => {
    const { repository } = setup({ from: makeQueryBuilder({ data: null, error: { code: "P0001", message: "rate_limited" } }) });

    await expect(repository.sendMessage(message)).rejects.toMatchObject({ name: "WriteError", code: "rate_limited" });
  });
});

it("starts conversations through the RPC and maps refusals", async () => {
  const { client, repository } = setup({ rpc: { data: null, error: { code: "42501", message: "not_allowed" } } });

  await expect(repository.startConversation("r1")).rejects.toMatchObject({ code: "not_allowed" });
  expect(client.rpc).toHaveBeenCalledWith("start_conversation", { p_report_id: "r1" });
});

describe("subscribeToMessages", () => {
  it("listens for inserts in one conversation and maps them", () => {
    const { channel, handlers, repository } = setup({});
    const received: unknown[] = [];

    repository.subscribeToMessages((message) => received.push(message), "c1");
    handlers[0]({ new: messageRow });

    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq.c1" },
      expect.any(Function),
    );
    expect(received).toEqual([expect.objectContaining({ id: "m1", conversationId: "c1" })]);
  });

  it("gives each subscription its own channel and removes it on unsubscribe", () => {
    const { client, channel, repository } = setup({});

    const first = repository.subscribeToMessages(() => {});
    repository.subscribeToMessages(() => {});
    first();

    const [[a], [b]] = client.channel.mock.calls as unknown as [string][];
    expect(a).not.toBe(b);
    expect(channel.on.mock.calls[0][1]).not.toHaveProperty("filter");
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
  });
});
