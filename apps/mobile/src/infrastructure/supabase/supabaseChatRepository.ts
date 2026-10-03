import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { MESSAGES_PAGE_SIZE, type ChatRepository, type Conversation, type Message, type MessageStatus } from "@/domain/chat/chat";
import { toWriteError } from "@/domain/errors/writeError";
import type { ReportKind, ReportStatus } from "@/domain/reports/report";

/** An inbox longer than this is past what a list on a phone is for. */
const CONVERSATION_LIMIT = 50;

// The embedded messages are ordered and limited to one below: the last message
// for the preview, in the same request instead of one per conversation.
const CONVERSATION_COLUMNS = `
  id, created_at,
  report:pet_reports ( id, kind, pet_name, species_id, status ),
  owner:profiles!conversations_owner_id_fkey ( id, display_name ),
  contact:profiles!conversations_contact_id_fkey ( id, display_name ),
  messages ( body, sender_id, created_at )
`;

const MESSAGE_COLUMNS = "id, conversation_id, sender_id, body, created_at, status";

type MessageRow = Pick<
  Database["public"]["Tables"]["messages"]["Row"],
  "id" | "conversation_id" | "sender_id" | "body" | "created_at" | "status"
>;

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    status: row.status as MessageStatus,
  };
}

/** Each subscription gets its own channel, so two screens on the same conversation don't share (and unsubscribe) one. */
let channelCount = 0;

export function createSupabaseChatRepository(client: SupabaseClient<Database>): ChatRepository {
  const conversations = () =>
    client
      .from("conversations")
      .select(CONVERSATION_COLUMNS)
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" });

  type ConversationRow = NonNullable<Awaited<ReturnType<typeof conversations>>["data"]>[number];

  const toConversation = (row: ConversationRow): Conversation => {
    const last = row.messages[0];
    return {
      id: row.id,
      report: row.report
        ? {
            id: row.report.id,
            kind: row.report.kind as ReportKind,
            petName: row.report.pet_name,
            speciesId: row.report.species_id,
            status: row.report.status as ReportStatus,
          }
        : null,
      owner: { id: row.owner?.id ?? "", name: row.owner?.display_name ?? "" },
      contact: { id: row.contact?.id ?? "", name: row.contact?.display_name ?? "" },
      lastMessage: last ? { body: last.body, senderId: last.sender_id, createdAt: last.created_at } : null,
      createdAt: row.created_at,
    };
  };

  return {
    async startConversation(reportId) {
      const { data, error } = await client.rpc("start_conversation", { p_report_id: reportId });
      if (error) throw toWriteError(error);
      return data;
    },

    async listConversations() {
      // RLS returns only the caller's own conversations.
      const { data, error } = await conversations()
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(CONVERSATION_LIMIT);
      if (error) throw error;
      return data.map(toConversation);
    },

    async getConversation(id) {
      const { data, error } = await conversations().eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toConversation(data) : null;
    },

    async listMessages(conversationId, before) {
      let query = client.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", conversationId);
      if (before) query = query.lt("created_at", before);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(MESSAGES_PAGE_SIZE);
      if (error) throw error;
      return data.map(toMessage);
    },

    async sendMessage(message) {
      const { error } = await client
        .from("messages")
        .insert({ id: message.id, conversation_id: message.conversationId, body: message.body });
      // The id is already taken: an earlier attempt of this same message got through.
      if (error && error.code !== "23505") throw toWriteError(error);
    },

    subscribeToMessages(onMessage, conversationId) {
      const channel = client
        .channel(`messages:${conversationId ?? "all"}:${++channelCount}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            // Realtime checks RLS per subscriber, so even unfiltered this only
            // delivers messages from the caller's own conversations.
            ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
          },
          (payload) => onMessage(toMessage(payload.new as MessageRow)),
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
