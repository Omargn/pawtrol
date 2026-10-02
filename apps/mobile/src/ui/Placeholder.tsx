import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type PlaceholderProps = { title: string; description: string };

/** Stands in for a screen whose feature hasn't been built yet, so the navigation shell can ship first. */
export function Placeholder({ title, description }: PlaceholderProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.title, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, styles.description, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  description: { marginTop: spacing.sm, textAlign: "center" },
});
