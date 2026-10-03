import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { FLAG_DETAILS_MAX, FLAG_REASONS, type FlagReason, type FlagTargetType } from "@/domain/moderation/moderation";
import { useFlagContent } from "@/hooks/useModeration";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { TextField } from "@/ui/TextField";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

const TARGET_LABEL: Record<FlagTargetType, string> = { report: "report", sighting: "sighting", message: "message" };

export function isFlagTarget(value: string | undefined): value is FlagTargetType {
  return value === "report" || value === "sighting" || value === "message";
}

export function FlagScreen({ targetType, targetId }: { targetType: FlagTargetType; targetId: string }) {
  const { colors } = useTheme();
  const { session, loading } = useSession();
  const flag = useFlagContent();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [details, setDetails] = useState("");

  if (loading) return <ScreenLoading />;
  if (!session) {
    return (
      <ScreenMessage
        title="Sign in to report content"
        action={{ label: "Sign in", onPress: () => router.push("/sign-in") }}
      />
    );
  }

  const submit = () => {
    if (!reason) return;
    flag.mutate(
      { targetType, targetId, reason, details: details.trim() || null },
      {
        onSuccess: () => {
          router.back();
          Alert.alert("Thanks for letting us know", "Moderators will take a look. Content several people report is hidden right away.");
        },
      },
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        What&apos;s wrong with this {TARGET_LABEL[targetType]}? The person who posted it won&apos;t know who reported it.
      </Text>
      <View style={styles.reasons}>
        {FLAG_REASONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={reason === option.value}
            onPress={() => setReason(option.value)}
          />
        ))}
      </View>
      <TextField
        label="Details (optional)"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={FLAG_DETAILS_MAX}
        hint={`${details.length}/${FLAG_DETAILS_MAX}`}
      />
      {flag.isError ? (
        <Text selectable style={[typography.body, styles.error, { color: colors.danger, borderColor: colors.danger }]}>
          {flag.error.message}
        </Text>
      ) : null}
      <Button label="Send report" onPress={submit} disabled={!reason} busy={flag.isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { padding: spacing.md, borderWidth: 1, borderRadius: radii.md },
});
