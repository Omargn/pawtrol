import { StyleSheet, Text, View } from "react-native";
import type { MapLayerProps } from "@/features/map/mapLayerTypes";
import { spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

/**
 * react-native-maps has no web renderer. The web build isn't a target yet
 * (see the roadmap); this keeps it compiling and points to the list view.
 */
export function MapLayer(_props: MapLayerProps) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        The map is available in the iOS and Android apps. Switch to the list to browse reports.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
