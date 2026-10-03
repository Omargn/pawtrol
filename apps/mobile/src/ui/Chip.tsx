import { Pressable, StyleSheet, Text } from "react-native";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Fills the chip with this color when selected (e.g. the lost/found colors). Defaults to the accent. */
  selectedColor?: string;
};

export function Chip({ label, selected, onPress, selectedColor }: ChipProps) {
  const { colors } = useTheme();
  const fill = selectedColor ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? fill : colors.surface,
          borderColor: selected ? fill : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[typography.caption, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
  },
});
