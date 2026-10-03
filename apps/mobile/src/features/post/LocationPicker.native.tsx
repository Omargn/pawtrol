import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import type { Coordinates } from "@/domain/location/locationService";
import { radii } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type LocationPickerProps = {
  initial: Coordinates;
  /** Fires when the map settles; the point under the center pin is the chosen location. */
  onChange: (location: Coordinates) => void;
  color: string;
};

const DELTA = 0.008;

/** The pin stays still and the map moves under it: easier to place precisely with a thumb than dragging a pin. */
export function LocationPicker({ initial, onChange, color }: LocationPickerProps) {
  const { scheme } = useTheme();
  return (
    <View style={styles.frame}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initial, latitudeDelta: DELTA, longitudeDelta: DELTA }}
        onRegionChangeComplete={(region) => onChange({ latitude: region.latitude, longitude: region.longitude })}
        showsUserLocation
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        userInterfaceStyle={scheme}
        accessibilityLabel="Map. Move it so the pin sits where the pet was last seen."
      />
      <View pointerEvents="none" style={styles.pin}>
        <Ionicons name="location-sharp" size={44} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 360, borderRadius: radii.lg, overflow: "hidden" },
  // The icon's tip, not its center, marks the point: lift it by half its height.
  pin: { position: "absolute", left: "50%", top: "50%", marginLeft: -22, marginTop: -44 },
});
