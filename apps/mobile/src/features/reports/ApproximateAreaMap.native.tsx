import { StyleSheet } from "react-native";
import MapView, { Circle } from "react-native-maps";
import type { ApproximateLocation } from "@/domain/reports/report";
import { radii } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

/** The public location is only good to ~100 m, so it's drawn as an area, never a pin. */
export const APPROXIMATE_RADIUS_M = 100;

export function ApproximateAreaMap({ location, color }: { location: ApproximateLocation; color: string }) {
  const { scheme } = useTheme();
  return (
    <MapView
      style={styles.map}
      initialRegion={{ ...location, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      userInterfaceStyle={scheme}
      accessibilityLabel="Map of the approximate area where the pet was last seen"
    >
      <Circle center={location} radius={APPROXIMATE_RADIUS_M} strokeColor={color} fillColor={`${color}33`} strokeWidth={2} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 180, borderRadius: radii.lg, overflow: "hidden" },
});
