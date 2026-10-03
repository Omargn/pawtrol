import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { regionToBbox, type Region } from "@/domain/reports/bbox";
import type { MapReport, ReportFilters } from "@/domain/reports/report";
import { CLUSTER_MAX_ZOOM, createClusterIndex, deltaForZoom, type MapItem } from "@/features/map/clustering";
import { FilterBar, type KindFilter } from "@/features/map/FilterBar";
import { MapLayer } from "@/features/map/MapLayer";
import { ReportCard } from "@/features/reports/ReportCard";
import { useReportsInBbox } from "@/hooks/useReports";
import { useSignedUrls } from "@/hooks/useSignedUrls";
import { useSpecies } from "@/hooks/useSpecies";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Icon } from "@/ui/Icon";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

/** Where the map opens without a location fix: central Mexico City, where the demo data lives. */
const DEFAULT_REGION: Region = { latitude: 19.4326, longitude: -99.1332, latitudeDelta: 0.12, longitudeDelta: 0.12 };
/** Neighborhood scale: a lost pet is usually within walking distance. */
const USER_DELTA = 0.04;
/** Height of the native tab bar the screen sits under. */
const TAB_BAR_HEIGHT = 50;

type Mode = "map" | "list";

export function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const location = useUserLocation();
  const species = useSpecies();

  const [region, setRegion] = useState<Region | null>(null);
  const [cameraTarget, setCameraTarget] = useState<{ region: Region; key: number } | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("map");
  /** Reports sharing one spot the map can't zoom apart; shown as a list instead. */
  const [stacked, setStacked] = useState<MapReport[] | null>(null);
  const movedByUser = useRef(false);

  const filters = useMemo<ReportFilters>(
    () => ({ kinds: kind === "all" ? null : [kind], speciesIds: speciesId === null ? null : [speciesId] }),
    [kind, speciesId],
  );
  const reports = useReportsInBbox(region ? regionToBbox(region) : null, filters);
  const index = useMemo(() => createClusterIndex(reports.data ?? []), [reports.data]);
  const items = useMemo<MapItem[]>(() => (region ? index.itemsInRegion(region) : []), [index, region]);
  const selected = reports.data?.find((report) => report.id === selectedId) ?? null;

  // The query covers a snapped area slightly larger than the screen; the list shows what's actually in view.
  const visible = useMemo(() => {
    if (!region || !reports.data) return [];
    const box = regionToBbox(region);
    return reports.data.filter(
      ({ location }) =>
        location.longitude >= box.minLng &&
        location.longitude <= box.maxLng &&
        location.latitude >= box.minLat &&
        location.latitude <= box.maxLat,
    );
  }, [region, reports.data]);
  const listed = stacked ?? (mode === "list" ? visible : selected ? [selected] : []);
  const photos = useSignedUrls(listed.flatMap((report) => (report.coverPhotoPath ? [report.coverPhotoPath] : [])));

  // Center on the user once their first fix arrives, unless they've already started exploring.
  useEffect(() => {
    if (location.coords && !movedByUser.current) {
      moveCamera({ ...location.coords, latitudeDelta: USER_DELTA, longitudeDelta: USER_DELTA });
    }
  }, [location.coords]);

  function moveCamera(target: Region) {
    setCameraTarget((current) => ({ region: target, key: (current?.key ?? 0) + 1 }));
  }

  async function centerOnUser() {
    movedByUser.current = true;
    try {
      const coords = await location.getFreshPosition();
      moveCamera({ ...coords, latitudeDelta: USER_DELTA, longitudeDelta: USER_DELTA });
    } catch {
      location.refresh();
    }
  }

  function openReport(id: string) {
    router.push({ pathname: "/report/[id]", params: { id } });
  }

  function handleCluster(item: Extract<MapItem, { type: "cluster" }>) {
    movedByUser.current = true;
    if (item.expansionZoom >= CLUSTER_MAX_ZOOM) {
      setStacked(index.reportsInCluster(item.key));
      return;
    }
    const delta = deltaForZoom(item.expansionZoom);
    moveCamera({ ...item.location, latitudeDelta: delta, longitudeDelta: delta });
  }

  const bottom = insets.bottom + TAB_BAR_HEIGHT + spacing.md;
  const showList = mode === "list" || stacked !== null;
  const empty = reports.isSuccess && !reports.isPlaceholderData && visible.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <MapLayer
        initialRegion={DEFAULT_REGION}
        items={items}
        selectedId={selectedId}
        onRegionChange={(next) => {
          setRegion(next);
          // The first settle is the map's own initial layout, not the user.
          if (region) movedByUser.current = true;
        }}
        onPressReport={setSelectedId}
        onPressCluster={handleCluster}
        onPressMap={() => setSelectedId(null)}
        cameraTarget={cameraTarget}
      />

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <FilterBar
          kind={kind}
          onKindChange={(next) => {
            setKind(next);
            setSelectedId(null);
          }}
          speciesId={speciesId}
          onSpeciesChange={(next) => {
            setSpeciesId(next);
            setSelectedId(null);
          }}
          species={species.data}
        />
        <View style={styles.status} pointerEvents="box-none">
          {reports.isFetching ? <StatusPill text="Loading…" spinner /> : null}
          {reports.isError ? (
            <StatusPill text="Couldn't load reports. Tap to retry." onPress={() => reports.refetch()} />
          ) : null}
          {empty ? <StatusPill text="No reports in this area." /> : null}
          {location.status === "denied" ? (
            <StatusPill
              text={location.canAskAgain ? "Allow location to see pets near you." : "Location is off. Tap to open Settings."}
              onPress={location.refresh}
            />
          ) : null}
        </View>
      </View>

      {showList ? (
        <View style={[styles.listPanel, { backgroundColor: colors.background, paddingTop: insets.top + 96 }]}>
          {stacked ? (
            <ListHeader title={`${stacked.length} reports at this spot`} onClose={() => setStacked(null)} />
          ) : null}
          <FlatList
            data={listed}
            keyExtractor={(report) => report.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 56 }]}
            renderItem={({ item }) => (
              <ReportCard
                report={item}
                species={species.data}
                photoUrl={item.coverPhotoPath ? photos.data?.[item.coverPhotoPath] : undefined}
                onPress={() => openReport(item.id)}
              />
            )}
            ListEmptyComponent={
              reports.isPending ? undefined : (
                <Text style={[typography.body, styles.emptyText, { color: colors.textSecondary }]}>
                  No reports in this area. Move the map or change the filters.
                </Text>
              )
            }
          />
        </View>
      ) : null}

      <View style={[styles.bottom, { bottom }]} pointerEvents="box-none">
        <View style={styles.controls} pointerEvents="box-none">
          <RoundButton
            label={showList ? "Show map" : "Show list"}
            icon={showList ? { ios: "map", android: "map" } : { ios: "list.bullet", android: "list" }}
            onPress={() => {
              setStacked(null);
              setMode(showList ? "map" : "list");
            }}
          />
          {showList ? null : (
            <RoundButton label="Center on my location" icon={{ ios: "location", android: "my_location" }} onPress={centerOnUser} />
          )}
        </View>
        {selected && !showList ? (
          <ReportCard
            report={selected}
            species={species.data}
            photoUrl={selected.coverPhotoPath ? photos.data?.[selected.coverPhotoPath] : undefined}
            onPress={() => openReport(selected.id)}
          />
        ) : null}
      </View>
    </View>
  );
}

function StatusPill({ text, spinner, onPress }: { text: string; spinner?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {spinner ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      <Text selectable style={[typography.caption, { color: colors.text }]}>
        {text}
      </Text>
    </Pressable>
  );
}

function RoundButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: { ios: "map" | "list.bullet" | "location"; android: "map" | "list" | "my_location" };
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={icon} size={20} color={colors.accent} />
    </Pressable>
  );
}

function ListHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.listHeader}>
      <Text style={[typography.heading, { color: colors.text }]}>{title}</Text>
      <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
        <Text style={[typography.body, { color: colors.accent }]}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: "absolute", top: 0, left: 0, right: 0, gap: spacing.sm, zIndex: 2 },
  status: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.12)",
  },
  listPanel: { ...StyleSheet.absoluteFill, zIndex: 1 },
  listContent: { gap: spacing.md, paddingHorizontal: spacing.lg },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyText: { textAlign: "center", marginTop: spacing.xxl },
  bottom: { position: "absolute", left: spacing.lg, right: spacing.lg, gap: spacing.md, zIndex: 3 },
  controls: { flexDirection: "row-reverse", gap: spacing.sm },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.2)",
  },
});
