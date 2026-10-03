import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MyReports } from "@/features/profile/MyReports";
import { useAuth } from "@/hooks/useAuth";
import { useIsModerator } from "@/hooks/useModeration";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/ui/Button";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export function ProfileScreen() {
  const { colors } = useTheme();
  const { session, loading } = useSession();
  const { signOut } = useAuth();
  const isModerator = useIsModerator(session?.user.id ?? null);

  if (loading) return <ScreenLoading />;
  if (!session) {
    return (
      <ScreenMessage
        title="You're browsing as a guest"
        body="Sign in to post a lost or found pet, add sightings and message owners."
        action={{ label: "Sign in", onPress: () => router.push("/sign-in") }}
      />
    );
  }

  const { user } = session;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          {user.fullName ?? "Neighbor"}
        </Text>
        {user.email ? (
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>
            {user.email}
          </Text>
        ) : null}
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Only your display name is shown to others. Your email stays private.
        </Text>
      </View>
      <MyReports userId={user.id} />
      {isModerator ? (
        <Button label="Moderation queue" variant="secondary" onPress={() => router.push("/moderation")} />
      ) : null}
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
