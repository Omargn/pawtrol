import type { ApproximateLocation } from "@/domain/reports/report";

export const APPROXIMATE_RADIUS_M = 100;

/** No map renderer on web yet; the screen still shows the text around it. */
export function ApproximateAreaMap(_props: { location: ApproximateLocation; color: string }) {
  return null;
}
