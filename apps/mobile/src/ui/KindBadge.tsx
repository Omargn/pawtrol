import { StyleSheet, Text, View } from "react-native";
import type { ReportKind } from "@/domain/reports/report";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export const KIND_LABEL: Record<ReportKind, string> = { lost: "Lost", found: "Found" };

/** Color is never the only signal: the badge always carries the word too. */
export function KindBadge({ kind }: { kind: ReportKind }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors[kind] }]}>
      <Text style={[typography.caption, styles.text, { color: colors.onAccent }]}>{KIND_LABEL[kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm, borderCurve: "continuous" },
  text: { fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
});
