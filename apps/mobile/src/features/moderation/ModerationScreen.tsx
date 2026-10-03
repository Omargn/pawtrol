import { router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { availableActions, FLAG_REASONS, type ModerationAction, type QueueItem } from "@/domain/moderation/moderation";
import { timeAgo } from "@/features/reports/format";
import { useIsModerator, useModerate, useModerationQueue } from "@/hooks/useModeration";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/ui/Button";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

const ACTION_LABEL: Record<ModerationAction, string> = { hide: "Hide", remove: "Remove", restore: "Restore" };
const REASON_LABEL = Object.fromEntries(FLAG_REASONS.map((option) => [option.value, option.label]));

export function ModerationScreen() {
  const { colors } = useTheme();
  const { session, loading } = useSession();
  const isModerator = useIsModerator(session?.user.id ?? null);
  const queue = useModerationQueue(isModerator);

  if (loading) return <ScreenLoading />;
  if (!isModerator) return <ScreenMessage title="Moderators only" />;
  if (queue.isPending) return <ScreenLoading />;
  if (queue.isError) {
    return (
      <ScreenMessage
        title="Couldn't load the queue"
        body="Check your connection and try again."
        action={{ label: "Retry", onPress: () => queue.refetch() }}
      />
    );
  }
  if (queue.data.length === 0) return <ScreenMessage title="Nothing to review" body="No open reports right now." />;

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={queue.data}
      keyExtractor={(item) => `${item.targetType}:${item.targetId}`}
      renderItem={({ item }) => <QueueRow item={item} />}
      onRefresh={() => queue.refetch()}
      refreshing={queue.isRefetching}
      contentContainerStyle={styles.list}
    />
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const { colors } = useTheme();
  const moderate = useModerate();
  const reasons = [...new Set(item.flags.map((flag) => REASON_LABEL[flag.reason]))].join(", ");
  const details = item.flags.flatMap((flag) => (flag.details ? [flag.details] : []));

  const act = (action: ModerationAction) => {
    const run = () =>
      moderate.mutate(
        { targetType: item.targetType, targetId: item.targetId, action, reason: null },
        { onError: (error) => Alert.alert("Couldn't apply that", error.message) },
      );
    if (action === "remove") {
      Alert.alert("Remove for good?", "It stays in the log but is never shown again.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: run },
      ]);
    } else {
      run();
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {item.targetType.toUpperCase()} · {item.content?.status ?? "deleted"} · {item.flags.length}{" "}
        {item.flags.length === 1 ? "report" : "reports"} · first {timeAgo(item.flags[0].createdAt)}
      </Text>
      <Text selectable style={[typography.body, { color: colors.text }]} numberOfLines={6}>
        {item.content?.text ?? (item.content ? "(no text)" : "This content no longer exists.")}
      </Text>
      <Text style={[typography.caption, { color: colors.text }]}>{reasons}</Text>
      {details.map((detail, index) => (
        <Text key={index} selectable style={[typography.caption, { color: colors.textSecondary }]}>
          “{detail}”
        </Text>
      ))}
      {item.content?.reportId ? (
        <Pressable
          onPress={() => router.push({ pathname: "/report/[id]", params: { id: item.content!.reportId! } })}
          accessibilityRole="link"
        >
          <Text style={[typography.caption, { color: colors.accent }]}>Open the report</Text>
        </Pressable>
      ) : null}
      {item.content ? (
        <View style={styles.actions}>
          {availableActions(item.content.status).map((action) => (
            <View key={action} style={styles.grow}>
              <Button
                label={ACTION_LABEL[action]}
                variant={action === "restore" ? "primary" : "secondary"}
                onPress={() => act(action)}
                busy={moderate.isPending && moderate.variables?.action === action}
                disabled={moderate.isPending}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  grow: { flex: 1 },
});
