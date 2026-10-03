import { router } from "expo-router";
import type { ReactNode } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  availableActions,
  FLAG_REASONS,
  type FlaggedContent,
  type FlagTargetType,
  type ModeratedItem,
  type ModerationAction,
  type QueueItem,
} from "@/domain/moderation/moderation";
import { timeAgo } from "@/features/reports/format";
import { useIsModerator, useModerate, useModerationQueue, useRecentlyModerated } from "@/hooks/useModeration";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/ui/Button";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

const ACTION_LABEL: Record<ModerationAction, string> = { hide: "Hide", remove: "Remove", restore: "Restore" };
const REASON_LABEL = Object.fromEntries(FLAG_REASONS.map((option) => [option.value, option.label]));
const EVENT_LABEL: Record<ModeratedItem["action"], string> = {
  auto_hidden: "hidden automatically",
  hidden: "hidden",
  removed: "removed",
};

/**
 * Open flags to review, then what was recently taken down, so a mistaken
 * hide or remove can be undone: once a moderator acts, the flags are resolved
 * and the item leaves the queue.
 */
export function ModerationScreen() {
  const { colors } = useTheme();
  const { session, loading } = useSession();
  const isModerator = useIsModerator(session?.user.id ?? null);
  const queue = useModerationQueue(isModerator);
  const recent = useRecentlyModerated(isModerator);

  const refresh = () => {
    void queue.refetch();
    void recent.refetch();
  };

  if (loading) return <ScreenLoading />;
  if (!isModerator) return <ScreenMessage title="Moderators only" />;
  if (queue.isPending || recent.isPending) return <ScreenLoading />;
  if (queue.isError || recent.isError) {
    return (
      <ScreenMessage
        title="Couldn't load moderation"
        body="Check your connection and try again."
        action={{ label: "Retry", onPress: refresh }}
      />
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={queue.isRefetching || recent.isRefetching}
          onRefresh={refresh}
        />
      }
    >
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
        To review
      </Text>
      {queue.data.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>No open reports right now.</Text>
      ) : (
        queue.data.map((item) => <QueueCard key={`${item.targetType}:${item.targetId}`} item={item} />)
      )}

      <Text accessibilityRole="header" style={[typography.heading, styles.section, { color: colors.text }]}>
        Recently hidden or removed
      </Text>
      {recent.data.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>Nothing is down right now.</Text>
      ) : (
        recent.data.map((item) => (
          <ContentCard
            key={`${item.targetType}:${item.targetId}`}
            targetType={item.targetType}
            targetId={item.targetId}
            content={item.content}
            summary={`${EVENT_LABEL[item.action]} ${timeAgo(item.at)}`}
          />
        ))
      )}
    </ScrollView>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const { colors } = useTheme();
  const reasons = [...new Set(item.flags.map((flag) => REASON_LABEL[flag.reason]))].join(", ");
  const details = item.flags.flatMap((flag) => (flag.details ? [flag.details] : []));
  const count = `${item.flags.length} ${item.flags.length === 1 ? "report" : "reports"}`;

  return (
    <ContentCard
      targetType={item.targetType}
      targetId={item.targetId}
      content={item.content}
      summary={`${count} · first ${timeAgo(item.flags[0].createdAt)}`}
    >
      <Text style={[typography.caption, { color: colors.text }]}>{reasons}</Text>
      {details.map((detail, index) => (
        <Text key={index} selectable style={[typography.caption, { color: colors.textSecondary }]}>
          “{detail}”
        </Text>
      ))}
    </ContentCard>
  );
}

function ContentCard({
  targetType,
  targetId,
  content,
  summary,
  children,
}: {
  targetType: FlagTargetType;
  targetId: string;
  content: FlaggedContent | null;
  summary: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const moderate = useModerate();
  const reportId = content?.reportId;

  const act = (action: ModerationAction) => {
    const run = () =>
      moderate.mutate(
        { targetType, targetId, action, reason: null },
        { onError: (error) => Alert.alert("Couldn't apply that", error.message) },
      );
    if (action !== "remove") return run();
    Alert.alert("Remove for good?", "It stays in the log but is never shown again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: run },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {targetType.toUpperCase()} · {content?.status ?? "deleted"} · {summary}
      </Text>
      <Text selectable style={[typography.body, { color: colors.text }]} numberOfLines={6}>
        {content ? (content.text ?? "(no text)") : "This content no longer exists."}
      </Text>
      {children}
      {reportId ? (
        <Pressable onPress={() => router.push({ pathname: "/report/[id]", params: { id: reportId } })} accessibilityRole="link">
          <Text style={[typography.caption, { color: colors.accent }]}>Open the report</Text>
        </Pressable>
      ) : null}
      {content ? (
        <View style={styles.actions}>
          {availableActions(content.status).map((action) => (
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
  section: { marginTop: spacing.lg },
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
