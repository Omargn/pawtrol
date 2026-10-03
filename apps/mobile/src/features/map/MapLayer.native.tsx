import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { MapReport } from "@/domain/reports/report";
import type { MapLayerProps } from "@/features/map/mapLayerTypes";
import { useTheme } from "@/ui/useTheme";

const CAMERA_ANIMATION_MS = 400;

export function MapLayer({
  initialRegion,
  items,
  selectedId,
  onRegionChange,
  onPressReport,
  onPressCluster,
  onPressMap,
  cameraTarget,
}: MapLayerProps) {
  const mapRef = useRef<MapView>(null);
  const { scheme, colors } = useTheme();

  useEffect(() => {
    if (cameraTarget) mapRef.current?.animateToRegion(cameraTarget.region, CAMERA_ANIMATION_MS);
  }, [cameraTarget]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onRegionChangeComplete={(region) => onRegionChange(region)}
      onPress={(event) => {
        // Marker taps also reach the map on Android; only a tap on the map itself clears the selection.
        if (event.nativeEvent.action !== "marker-press") onPressMap();
      }}
      showsUserLocation
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      userInterfaceStyle={scheme}
      tintColor={colors.accent}
    >
      {items.map((item) =>
        item.type === "cluster" ? (
          <Marker
            key={item.key}
            coordinate={item.location}
            tracksViewChanges={false}
            onPress={(event) => {
              event.stopPropagation();
              onPressCluster(item);
            }}
            accessibilityLabel={`${item.count} reports`}
          >
            {/* Neutral, not the accent: a cluster mixes lost and found, and orange reads as "lost". */}
            <ClusterPin count={item.count} color={colors.text} textColor={colors.background} />
          </Marker>
        ) : (
          <Marker
            // Remounts when selection changes, so the pin can redraw while
            // tracksViewChanges stays off — that keeps hundreds of pins from
            // being re-snapshotted on every camera frame.
            key={`${item.key}-${item.key === selectedId}`}
            coordinate={item.report.location}
            tracksViewChanges={false}
            onPress={(event) => {
              // Otherwise iOS also delivers the tap to the map, which clears the selection.
              event.stopPropagation();
              onPressReport(item.report.id);
            }}
            accessibilityLabel={`${item.report.kind} ${item.report.petName ?? "pet"}`}
          >
            <ReportPin report={item.report} selected={item.key === selectedId} />
          </Marker>
        ),
      )}
    </MapView>
  );
}

const ReportPin = memo(function ReportPin({ report, selected }: { report: MapReport; selected: boolean }) {
  const { colors } = useTheme();
  const size = selected ? 38 : 30;
  return (
    <View
      style={[
        styles.pin,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors[report.kind],
          borderColor: selected ? colors.text : colors.surface,
        },
      ]}
    >
      <Ionicons name="paw" size={selected ? 20 : 16} color={colors.onAccent} />
    </View>
  );
});

const ClusterPin = memo(function ClusterPin({ count, color, textColor }: { count: number; color: string; textColor: string }) {
  const size = count < 10 ? 34 : count < 100 ? 40 : 46;
  return (
    <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.count, { color: textColor }]}>{count}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pin: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.3)",
  },
  count: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
