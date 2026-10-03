import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { counterpart, MESSAGE_MAX, type Conversation, type Message } from "@/domain/chat/chat";
import { reportTitle, timeAgo } from "@/features/reports/format";
import type { OutgoingMessage } from "@/hooks/createChatHooks";
import { useConversation, useMessages, useSendMessage } from "@/hooks/useChat";
import { useSession } from "@/hooks/useSession";
import { useSpecies } from "@/hooks/useSpecies";
import { Icon } from "@/ui/Icon";
import { KeyboardAvoidingScreen } from "@/ui/KeyboardAvoidingScreen";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export function ConversationScreen({ id }: { id: string }) {
  const { session, loading } = useSession();
  const conversation = useConversation(id);

  if (loading || conversation.isPending) return <ScreenLoading />;
  if (!session) {
    return (
      <ScreenMessage
        title="Sign in to see this conversation"
        action={{ label: "Sign in", onPress: () => router.push("/sign-in") }}
      />
    );
  }
  if (conversation.isError) {
    return (
      <ScreenMessage
        title="Couldn't load this conversation"
        body="Check your connection and try again."
        action={{ label: "Retry", onPress: () => conversation.refetch() }}
      />
    );
  }
  if (!conversation.data) return <ScreenMessage title="Conversation not available" />;
  return <Thread conversation={conversation.data} userId={session.user.id} />;
}

type Row = { kind: "message"; message: Message } | { kind: "outgoing"; message: OutgoingMessage };

function Thread({ conversation, userId }: { conversation: Conversation; userId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const messages = useMessages(conversation.id);
  const { outgoing, send, retry } = useSendMessage(conversation.id, userId);
  const [draft, setDraft] = useState("");
  const [issue, setIssue] = useState<string | null>(null);
  const other = counterpart(conversation, userId);

  // Newest first, for an inverted list: what's still sending sits below everything delivered.
  const rows: Row[] = [
    ...outgoing.map((message): Row => ({ kind: "outgoing", message })),
    ...messages.messages.map((message): Row => ({ kind: "message", message })),
  ];

  const submit = () => {
    const problem = send(draft);
    setIssue(problem);
    if (!problem) setDraft("");
  };

  return (
    <>
      <Stack.Screen options={{ title: other.name }} />
      <KeyboardAvoidingScreen style={{ backgroundColor: colors.background }}>
        {messages.isError ? (
          <ScreenMessage
            title="Couldn't load messages"
            body="Check your connection and try again."
            action={{ label: "Retry", onPress: () => messages.refetch() }}
          />
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => row.message.id}
            renderItem={({ item }) =>
              item.kind === "message" ? (
                <Bubble message={item.message} mine={item.message.senderId === userId} />
              ) : (
                <OutgoingBubble message={item.message} onRetry={() => retry(item.message.id)} />
              )
            }
            onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()}
            onEndReachedThreshold={0.3}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            // An inverted list's footer renders at the top, above the oldest message.
            ListFooterComponent={<AboutReport conversation={conversation} />}
          />
        )}

        <View
          style={[
            styles.composer,
            { borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
        >
          {issue ? <Text style={[typography.caption, { color: colors.danger }]}>{issue}</Text> : null}
          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (issue) setIssue(null);
              }}
              placeholder={`Message ${other.name}`}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={`Message ${other.name}`}
              multiline
              maxLength={MESSAGE_MAX}
              style={[
                typography.body,
                styles.input,
                { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
              ]}
            />
            <Pressable
              onPress={submit}
              disabled={draft.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Send"
              hitSlop={8}
              style={[styles.send, { backgroundColor: colors.accent, opacity: draft.trim().length === 0 ? 0.45 : 1 }]}
            >
              <Icon name={{ ios: "arrow.up", android: "arrow_upward" }} color={colors.onAccent} size={18} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingScreen>
    </>
  );
}

function AboutReport({ conversation }: { conversation: Conversation }) {
  const { colors } = useTheme();
  const species = useSpecies();
  const report = conversation.report;

  return (
    <View style={[styles.about, { backgroundColor: colors.surfaceMuted }]}>
      {report ? (
        <Pressable
          onPress={() => router.push({ pathname: "/report/[id]", params: { id: report.id } })}
          accessibilityRole="link"
        >
          <Text style={[typography.body, { color: colors.accent }]}>
            About {reportTitle(report, species.data)} · View report
          </Text>
        </Pressable>
      ) : (
        <Text style={[typography.body, { color: colors.textSecondary }]}>The report is no longer available.</Text>
      )}
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        Meet in a public place and never pay anyone to get a pet back.
      </Text>
    </View>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const { colors } = useTheme();
  const moderated = message.status !== "visible";
  // Someone else's message can be reported; there's nothing to report about your own.
  const offerFlag = () =>
    Alert.alert("Report this message?", "Moderators can read a message only once it's been reported.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", onPress: () => router.push({ pathname: "/flag", params: { type: "message", id: message.id } }) },
    ]);

  return (
    <Pressable
      onLongPress={mine || moderated ? undefined : offerFlag}
      accessibilityHint={mine || moderated ? undefined : "Long press to report it"}
      style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}
    >
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.accent }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
          moderated && styles.moderated,
        ]}
      >
        <Text selectable={mine} style={[typography.body, { color: mine ? colors.onAccent : colors.text }]}>
          {message.body}
        </Text>
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {moderated ? "Hidden by moderators · only you can see it" : timeAgo(message.createdAt)}
      </Text>
    </Pressable>
  );
}

function OutgoingBubble({ message, onRetry }: { message: OutgoingMessage; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={message.failed ? onRetry : undefined}
      disabled={!message.failed}
      accessibilityRole={message.failed ? "button" : undefined}
      accessibilityHint={message.failed ? "Sends it again" : undefined}
      style={[styles.bubbleRow, styles.mine]}
    >
      <View style={[styles.bubble, styles.pending, { backgroundColor: colors.accent }]}>
        <Text style={[typography.body, { color: colors.onAccent }]}>{message.body}</Text>
      </View>
      <Text style={[typography.caption, { color: message.failed ? colors.danger : colors.textSecondary }]}>
        {message.failed ? `${message.failed.message} Tap to retry.` : "Sending…"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  about: { padding: spacing.md, borderRadius: radii.md, gap: spacing.xs, marginBottom: spacing.sm },
  bubbleRow: { gap: 2, maxWidth: "80%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, borderCurve: "continuous" },
  pending: { opacity: 0.6 },
  moderated: { opacity: 0.5 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 2 },
});
