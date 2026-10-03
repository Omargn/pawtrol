import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export function ScreenLoading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

type ScreenMessageProps = { title: string; body?: string; action?: { label: string; onPress: () => void } };

/** Empty and error states: a short title, an optional line, and a way out when there is one. */
export function ScreenMessage({ title, body, action }: ScreenMessageProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text selectable style={[typography.heading, styles.center, { color: colors.text }]}>
        {title}
      </Text>
      {body ? (
        <Text selectable style={[typography.body, styles.center, { color: colors.textSecondary }]}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[typography.body, styles.buttonText, { color: colors.onAccent }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  center: { textAlign: "center" },
  button: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  buttonText: { fontWeight: "600" },
});
