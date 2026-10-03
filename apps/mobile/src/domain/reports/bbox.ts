import type { Bbox } from "@/domain/reports/report";

/** The shape react-native-maps reports a visible area in. */
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function regionToBbox(region: Region): Bbox {
  return {
    minLng: clamp(region.longitude - region.longitudeDelta / 2, -180, 180),
    minLat: clamp(region.latitude - region.latitudeDelta / 2, -90, 90),
    maxLng: clamp(region.longitude + region.longitudeDelta / 2, -180, 180),
    maxLat: clamp(region.latitude + region.latitudeDelta / 2, -90, 90),
  };
}

/** The largest of 1, 2 or 5 × 10ⁿ that is ≤ value: steps that read as round numbers. */
function niceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const leading = value / magnitude;
  return (leading >= 5 ? 5 : leading >= 2 ? 2 : 1) * magnitude;
}

/**
 * Grows a box outward onto a grid about a quarter of its size. Used as the
 * query key and the query itself, so panning a little inside the same cells
 * reuses the cached answer instead of fetching again, and the server is asked
 * for a slightly larger area than the screen — never a smaller one.
 */
export function snapBbox(bbox: Bbox): Bbox {
  const span = Math.max(bbox.maxLng - bbox.minLng, bbox.maxLat - bbox.minLat);
  const step = niceStep(Math.max(span / 4, 1e-4));
  // Rounded so float noise (0.30000000000000004) doesn't split one cell into two cache keys.
  const snap = (value: number, round: (n: number) => number) => +(round(value / step) * step).toFixed(6);
  return {
    minLng: clamp(snap(bbox.minLng, Math.floor), -180, 180),
    minLat: clamp(snap(bbox.minLat, Math.floor), -90, 90),
    maxLng: clamp(snap(bbox.maxLng, Math.ceil), -180, 180),
    maxLat: clamp(snap(bbox.maxLat, Math.ceil), -90, 90),
  };
}
