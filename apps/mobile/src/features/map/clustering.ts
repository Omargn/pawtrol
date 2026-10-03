import Supercluster from "supercluster";
import type { Region } from "@/domain/reports/bbox";
import type { ApproximateLocation, MapReport } from "@/domain/reports/report";

export type MapItem =
  | { type: "report"; key: string; report: MapReport }
  | { type: "cluster"; key: string; count: number; location: ApproximateLocation; expansionZoom: number };

type ReportProperties = { report: MapReport };

const MAX_ZOOM = 18;

/** react-native-maps works in deltas; supercluster in web-map zoom levels (0 = whole world). */
export function regionZoom(region: Region) {
  return Math.min(MAX_ZOOM, Math.max(0, Math.log2(360 / region.longitudeDelta)));
}

export function deltaForZoom(zoom: number) {
  return 360 / 2 ** zoom;
}

/**
 * Builds once per set of reports; `itemsInRegion` is then cheap to call on
 * every camera move. Many reports share a snapped ~100 m point, so even at
 * the closest zoom a cluster can remain: its expansion zoom then stays at the
 * max, and the screen shows a list instead of zooming further.
 */
export function createClusterIndex(reports: MapReport[]) {
  const index = new Supercluster<ReportProperties>({ radius: 48, maxZoom: MAX_ZOOM - 1 });
  index.load(
    reports.map((report) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [report.location.longitude, report.location.latitude] },
      properties: { report },
    })),
  );

  function itemsInRegion(region: Region): MapItem[] {
    const bbox: [number, number, number, number] = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude + region.latitudeDelta / 2,
    ];
    return index.getClusters(bbox, Math.floor(regionZoom(region))).map((feature): MapItem => {
      const [longitude, latitude] = feature.geometry.coordinates;
      if ("cluster" in feature.properties && feature.properties.cluster) {
        const id = feature.properties.cluster_id;
        return {
          type: "cluster",
          key: `cluster-${id}`,
          count: feature.properties.point_count,
          location: { latitude, longitude },
          expansionZoom: Math.min(index.getClusterExpansionZoom(id), MAX_ZOOM),
        };
      }
      const { report } = feature.properties as ReportProperties;
      return { type: "report", key: report.id, report };
    });
  }

  /** The reports inside a cluster, for when zooming in can't separate them. */
  function reportsInCluster(key: string): MapReport[] {
    const id = Number(key.replace("cluster-", ""));
    return index.getLeaves(id, Infinity).map((leaf) => leaf.properties.report);
  }

  return { itemsInRegion, reportsInCluster };
}

export const CLUSTER_MAX_ZOOM = MAX_ZOOM;
