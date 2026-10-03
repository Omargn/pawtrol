import { useLocalSearchParams } from "expo-router";
import { ConversationScreen } from "@/features/chat/ConversationScreen";

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationScreen id={id} />;
}
