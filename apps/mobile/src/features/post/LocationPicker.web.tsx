import { Text } from "react-native";
import type { Coordinates } from "@/domain/location/locationService";
import { typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

/** No map renderer on web yet; posting is an app feature for now. */
export function LocationPicker(_props: { initial: Coordinates; onChange: (location: Coordinates) => void; color: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.body, { color: colors.textSecondary }]}>Choosing a location needs the iOS or Android app.</Text>;
}
