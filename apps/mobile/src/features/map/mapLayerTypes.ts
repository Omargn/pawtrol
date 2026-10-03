import type { Region } from "@/domain/reports/bbox";
import type { MapItem } from "@/features/map/clustering";

/** Shared by MapLayer.native and MapLayer.web, which must keep the same API. */
export type MapLayerProps = {
  initialRegion: Region;
  items: MapItem[];
  selectedId: string | null;
  /** Fires once the camera settles, not on every frame of a pan. */
  onRegionChange: (region: Region) => void;
  onPressReport: (id: string) => void;
  onPressCluster: (item: Extract<MapItem, { type: "cluster" }>) => void;
  onPressMap: () => void;
  /** Animates the camera whenever `key` changes, so asking twice for the same region still moves. */
  cameraTarget: { region: Region; key: number } | null;
};
