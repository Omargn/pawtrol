import { randomUUID } from "expo-crypto";
import { chatRepository } from "@/composition/chatRepository";
import { createChatHooks } from "@/hooks/createChatHooks";

export const { useConversations, useConversation, useMessages, useSendMessage, useStartConversation } = createChatHooks(
  chatRepository,
  randomUUID,
);
