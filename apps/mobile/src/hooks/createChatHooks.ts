import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { MESSAGES_PAGE_SIZE, messageIssue, type ChatRepository, type Message } from "@/domain/chat/chat";
import { toWriteError, type WriteError } from "@/domain/errors/writeError";

/**
 * Query keys are part of the behavior: a new message (sent or received over
 * Realtime) updates `messages` in place and invalidates `conversations` for
 * the inbox order and preview.
 */
export const chatKeys = {
  all: ["conversations"] as const,
  list: () => ["conversations", "list"] as const,
  detail: (id: string) => ["conversations", "detail", id] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
};

/** A message this device is sending or failed to send, shown until the server has it. */
export type OutgoingMessage = { id: string; body: string; createdAt: string; failed: WriteError | null };

type MessagePages = InfiniteData<Message[], string | null>;

/**
 * Adds or replaces `message` in the cached pages, newest first. Replacing by
 * id means the server's copy of a message wins over the local one, and a
 * message delivered twice (our own send echoed by Realtime) shows once.
 */
export function upsertMessage(data: MessagePages | undefined, message: Message): MessagePages | undefined {
  if (!data) return data;
  const exists = data.pages.some((page) => page.some((item) => item.id === message.id));
  if (exists) {
    return { ...data, pages: data.pages.map((page) => page.map((item) => (item.id === message.id ? message : item))) };
  }
  const [first = [], ...rest] = data.pages;
  const merged = [message, ...first].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { ...data, pages: [merged, ...rest] };
}

function receive(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<MessagePages>(chatKeys.messages(message.conversationId), (data) => upsertMessage(data, message));
  void queryClient.invalidateQueries({ queryKey: chatKeys.all });
}

export function createChatHooks(repository: ChatRepository, newId: () => string, now = () => new Date()) {
  /** The signed-in user's conversations, kept fresh while mounted by listening for new messages. */
  function useConversations(enabled: boolean) {
    const queryClient = useQueryClient();
    useEffect(() => {
      if (!enabled) return;
      return repository.subscribeToMessages((message) => receive(queryClient, message));
    }, [enabled, queryClient]);

    return useQuery({
      queryKey: chatKeys.list(),
      queryFn: () => repository.listConversations(),
      enabled,
      staleTime: 30_000,
    });
  }

  function useConversation(id: string) {
    return useQuery({
      queryKey: chatKeys.detail(id),
      queryFn: () => repository.getConversation(id),
      staleTime: 30_000,
    });
  }

  /** A conversation's messages, newest first, paged backwards and updated live. */
  function useMessages(conversationId: string) {
    const queryClient = useQueryClient();
    useEffect(
      () => repository.subscribeToMessages((message) => receive(queryClient, message), conversationId),
      [conversationId, queryClient],
    );

    const query = useInfiniteQuery({
      queryKey: chatKeys.messages(conversationId),
      queryFn: ({ pageParam }) => repository.listMessages(conversationId, pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => (last.length < MESSAGES_PAGE_SIZE ? undefined : last[last.length - 1].createdAt),
      // Realtime keeps an open conversation current; reopening it catches up on
      // anything sent while the subscription was down.
      staleTime: 30_000,
    });
    return { ...query, messages: query.data?.pages.flat() ?? [] };
  }

  /**
   * Sending from one device. Each message gets its id when written, and a
   * retry resends that same id, so a send that timed out after reaching the
   * server never shows up twice.
   */
  function useSendMessage(conversationId: string, userId: string) {
    const queryClient = useQueryClient();
    const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);

    const deliver = useCallback(
      async (pending: OutgoingMessage) => {
        setOutgoing((items) => items.map((item) => (item.id === pending.id ? { ...item, failed: null } : item)));
        try {
          await repository.sendMessage({ id: pending.id, conversationId, body: pending.body });
          receive(queryClient, {
            id: pending.id,
            conversationId,
            senderId: userId,
            body: pending.body,
            createdAt: pending.createdAt,
            status: "visible",
          });
          setOutgoing((items) => items.filter((item) => item.id !== pending.id));
        } catch (error) {
          const failed = toWriteError(error);
          setOutgoing((items) => items.map((item) => (item.id === pending.id ? { ...item, failed } : item)));
        }
      },
      [conversationId, userId, queryClient],
    );

    /** Resolves to a message to show instead of sending, or null once it's on its way. */
    const send = useCallback(
      (body: string): string | null => {
        const issue = messageIssue(body);
        if (issue) return issue;
        const pending = { id: newId(), body: body.trim(), createdAt: now().toISOString(), failed: null };
        setOutgoing((items) => [pending, ...items]);
        void deliver(pending);
        return null;
      },
      [deliver],
    );

    const retry = useCallback(
      (id: string) => {
        const pending = outgoing.find((item) => item.id === id);
        if (pending?.failed) void deliver(pending);
      },
      [outgoing, deliver],
    );

    return { outgoing, send, retry };
  }

  /** Opens (or finds) the caller's conversation about a report. Rejects with a WriteError. */
  function useStartConversation() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (reportId: string) => repository.startConversation(reportId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.all }),
    });
  }

  return { useConversations, useConversation, useMessages, useSendMessage, useStartConversation };
}
