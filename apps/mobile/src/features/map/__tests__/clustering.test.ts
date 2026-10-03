import { CLUSTER_MAX_ZOOM, createClusterIndex, deltaForZoom, regionZoom } from "@/features/map/clustering";
import { makeMapReport } from "@/test-utils/inMemoryReportRepository";

const at = (id: string, latitude: number, longitude: number) => makeMapReport({ id, location: { latitude, longitude } });

const cityRegion = { latitude: 19.43, longitude: -99.13, latitudeDelta: 0.2, longitudeDelta: 0.2 };
const streetRegion = { latitude: 19.43, longitude: -99.13, latitudeDelta: 0.006, longitudeDelta: 0.006 };

it("converts between map deltas and zoom levels", () => {
  expect(regionZoom({ ...cityRegion, longitudeDelta: 360 })).toBe(0);
  expect(deltaForZoom(regionZoom(cityRegion))).toBeCloseTo(cityRegion.longitudeDelta);
});

it("groups nearby reports when zoomed out and separates them when zoomed in", () => {
  const index = createClusterIndex([at("a", 19.43, -99.13), at("b", 19.431, -99.131), at("far", 19.6, -99.4)]);

  const city = index.itemsInRegion(cityRegion);
  expect(city).toHaveLength(1);
  expect(city[0]).toMatchObject({ type: "cluster", count: 2 });

  const street = index.itemsInRegion(streetRegion);
  expect(street.map((item) => item.key).sort()).toEqual(["a", "b"]);
});

it("tells how far to zoom to open a cluster", () => {
  const index = createClusterIndex([at("a", 19.43, -99.13), at("b", 19.431, -99.131)]);

  const [cluster] = index.itemsInRegion(cityRegion);

  expect(cluster.type === "cluster" && cluster.expansionZoom).toBeGreaterThan(regionZoom(cityRegion));
});

it("keeps reports on the same snapped point together, with their reports listed", () => {
  const index = createClusterIndex([at("a", 19.43, -99.13), at("b", 19.43, -99.13)]);

  const [cluster] = index.itemsInRegion(streetRegion);

  expect(cluster).toMatchObject({ type: "cluster", count: 2, expansionZoom: CLUSTER_MAX_ZOOM });
  expect(index.reportsInCluster(cluster.key).map((report) => report.id).sort()).toEqual(["a", "b"]);
});

it("only returns what's in view", () => {
  const index = createClusterIndex([at("here", 19.43, -99.13), at("paris", 48.85, 2.35)]);

  expect(index.itemsInRegion(streetRegion).map((item) => item.key)).toEqual(["here"]);
});
