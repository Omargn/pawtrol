import { MESSAGES_PAGE_SIZE, type ChatRepository, type Conversation, type Message } from "@/domain/chat/chat";

export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conversation-1",
    report: { id: "report-1", kind: "lost", petName: "Toby", speciesId: 1, status: "active" },
    owner: { id: "user-owner", name: "Ana" },
    contact: { id: "user-contact", name: "Ben" },
    lastMessage: null,
    createdAt: "2026-10-02T10:00:00Z",
    ...overrides,
  };
}

export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "user-contact",
    body: "I think I saw your dog",
    createdAt: "2026-10-02T10:05:00Z",
    status: "visible",
    ...overrides,
  };
}

/**
 * A ChatRepository over plain arrays. `emit` plays the part of Realtime;
 * `sent` holds what was sent, keyed by id as the server's primary key is.
 */
export function createInMemoryChatRepository({
  conversations = [] as Conversation[],
  messages = [] as Message[],
}: { conversations?: Conversation[]; messages?: Message[] } = {}) {
  const calls = { listMessages: 0, sendMessage: 0, startConversation: 0 };
  const sent = new Map<string, Message>();
  const listeners = new Set<{ onMessage: (message: Message) => void; conversationId?: string }>();
  let failSendWith: Error | undefined;

  const repository: ChatRepository = {
    async startConversation(reportId) {
      calls.startConversation++;
      const existing = conversations.find((conversation) => conversation.report?.id === reportId);
      return existing?.id ?? `conversation-for-${reportId}`;
    },
    async listConversations() {
      return conversations;
    },
    async getConversation(id) {
      return conversations.find((conversation) => conversation.id === id) ?? null;
    },
    async listMessages(conversationId, before) {
      calls.listMessages++;
      return [...messages, ...sent.values()]
        .filter((message) => message.conversationId === conversationId && (!before || message.createdAt < before))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MESSAGES_PAGE_SIZE);
    },
    async sendMessage(message) {
      calls.sendMessage++;
      if (failSendWith) throw failSendWith;
      if (!sent.has(message.id)) {
        sent.set(message.id, { ...message, senderId: "me", createdAt: new Date().toISOString(), status: "visible" });
      }
    },
    subscribeToMessages(onMessage, conversationId) {
      const listener = { onMessage, conversationId };
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    repository,
    calls,
    sent,
    listenerCount: () => listeners.size,
    /** Delivers a message to subscribers, as Realtime would. */
    emit(message: Message) {
      for (const listener of listeners) {
        if (!listener.conversationId || listener.conversationId === message.conversationId) listener.onMessage(message);
      }
    },
    /** Makes the next sendMessage calls fail (or succeed again with undefined). */
    failSend(error: Error | undefined) {
      failSendWith = error;
    },
  };
}
