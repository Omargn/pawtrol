import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { counterpart, type Conversation } from "@/domain/chat/chat";
import { reportTitle, timeAgo } from "@/features/reports/format";
import { useConversations } from "@/hooks/useChat";
import { useSession } from "@/hooks/useSession";
import { useSpecies } from "@/hooks/useSpecies";
import { KindBadge } from "@/ui/KindBadge";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export function InboxScreen() {
  const { session, loading } = useSession();
  const userId = session?.user.id ?? null;
  const conversations = useConversations(userId !== null);

  if (loading) return <ScreenLoading />;
  if (!userId) {
    return (
      <ScreenMessage
        title="Sign in to see your messages"
        body="Neighbors reach you here about your reports. Your email is never shown."
        action={{ label: "Sign in", onPress: () => router.push("/sign-in") }}
      />
    );
  }
  if (conversations.isPending) return <ScreenLoading />;
  if (conversations.isError) {
    return (
      <ScreenMessage
        title="Couldn't load your messages"
        body="Check your connection and try again."
        action={{ label: "Retry", onPress: () => conversations.refetch() }}
      />
    );
  }
  if (conversations.data.length === 0) {
    return (
      <ScreenMessage
        title="No messages yet"
        body="Message someone from a report's page, or wait for neighbors to reach you about yours."
      />
    );
  }
  return <InboxList conversations={conversations.data} userId={userId} onRefresh={() => conversations.refetch()} refreshing={conversations.isRefetching} />;
}

function InboxList({
  conversations,
  userId,
  onRefresh,
  refreshing,
}: {
  conversations: Conversation[];
  userId: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { colors } = useTheme();
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={conversations}
      keyExtractor={(conversation) => conversation.id}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={({ item }) => <InboxRow conversation={item} userId={userId} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
    />
  );
}

function InboxRow({ conversation, userId }: { conversation: Conversation; userId: string }) {
  const { colors } = useTheme();
  const species = useSpecies();
  const other = counterpart(conversation, userId);
  const last = conversation.lastMessage;
  const about = conversation.report ? reportTitle(conversation.report, species.data) : "Report no longer available";
  const preview = last ? `${last.senderId === userId ? "You: " : ""}${last.body}` : "No messages yet";

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conversation.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${other.name} about ${about}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : colors.background }]}
    >
      <View style={styles.rowHeader}>
        <Text style={[typography.heading, styles.grow, { color: colors.text }]} numberOfLines={1}>
          {other.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {timeAgo(last?.createdAt ?? conversation.createdAt)}
        </Text>
      </View>
      <View style={styles.about}>
        {conversation.report ? <KindBadge kind={conversation.report.kind} /> : null}
        <Text style={[typography.caption, styles.grow, { color: colors.textSecondary }]} numberOfLines={1}>
          {about}
        </Text>
      </View>
      <Text style={[typography.body, { color: colors.text }]} numberOfLines={2}>
        {preview}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  about: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
});
