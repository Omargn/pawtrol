import type { ReportKind, ReportStatus } from "@/domain/reports/report";

export type MessageStatus = "visible" | "hidden" | "removed";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  /** Others only ever receive visible messages; a sender also sees their own hidden ones. */
  status: MessageStatus;
};

/** One side of a conversation, by display name only: contact never goes beyond the chat. */
export type Participant = { id: string; name: string };

export type Conversation = {
  id: string;
  /**
   * What the conversation is about. null when the caller can no longer see
   * the report (expired or moderated, and they aren't its author).
   */
  report: { id: string; kind: ReportKind; petName: string | null; speciesId: number; status: ReportStatus } | null;
  owner: Participant;
  contact: Participant;
  lastMessage: Pick<Message, "body" | "senderId" | "createdAt"> | null;
  createdAt: string;
};

export type NewMessage = {
  /** Generated once per message so a retry can't send it twice. */
  id: string;
  conversationId: string;
  body: string;
};

/** The server rejects longer messages, and blank ones. */
export const MESSAGE_MAX = 1000;
export const MESSAGES_PAGE_SIZE = 50;

/**
 * Conversations about reports, between the report's owner and one contact.
 * Reads reject with the underlying error; writes reject with a WriteError.
 */
export type ChatRepository = {
  /** Opens the caller's conversation about an active report, or returns the existing one. */
  startConversation(reportId: string): Promise<string>;
  /** The caller's conversations, most recently active first, capped. */
  listConversations(): Promise<Conversation[]>;
  /** null when it doesn't exist or the caller isn't a participant. */
  getConversation(id: string): Promise<Conversation | null>;
  /** Up to MESSAGES_PAGE_SIZE messages older than `before` (or the newest), newest first. */
  listMessages(conversationId: string, before: string | null): Promise<Message[]>;
  /** Idempotent on `id`: resending a message that already arrived resolves. */
  sendMessage(message: NewMessage): Promise<void>;
  /**
   * Calls `onMessage` for each new message the caller may read, in
   * `conversationId` or, without it, in any of their conversations.
   * Returns a function that unsubscribes.
   */
  subscribeToMessages(onMessage: (message: Message) => void, conversationId?: string): () => void;
};

/** The other participant, from where `userId` sits. */
export function counterpart(conversation: Conversation, userId: string): Participant {
  return conversation.owner.id === userId ? conversation.contact : conversation.owner;
}

/** What still stops a message from being sent, or null. */
export function messageIssue(body: string): string | null {
  const length = body.trim().length;
  if (length === 0) return "Write a message first.";
  if (length > MESSAGE_MAX) return `Keep messages under ${MESSAGE_MAX} characters.`;
  return null;
}
