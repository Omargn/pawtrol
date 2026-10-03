import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  /** Shows a spinner and ignores presses. */
  busy?: boolean;
};

export function Button({ label, onPress, variant = "primary", disabled, busy }: ButtonProps) {
  const { colors } = useTheme();
  const primary = variant === "primary";
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={primary ? colors.onAccent : colors.accent} /> : null}
      <Text style={[typography.body, styles.label, { color: primary ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  label: { fontWeight: "600" },
});
