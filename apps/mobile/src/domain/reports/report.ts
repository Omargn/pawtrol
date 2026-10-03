export type ReportKind = "lost" | "found";
export type ReportStatus = "active" | "reunited" | "expired" | "hidden" | "removed";
export type PetSize = "small" | "medium" | "large";

/**
 * Coordinates as the server publishes them: snapped to a ~100 m grid. The app
 * never sees a report's exact location, so nothing here should present these
 * as a precise point.
 */
export type ApproximateLocation = { latitude: number; longitude: number };

/** What the map and the list need about a report, nothing more. */
export type MapReport = {
  id: string;
  kind: ReportKind;
  speciesId: number;
  petName: string | null;
  location: ApproximateLocation;
  lastSeenAt: string;
  sightingCount: number;
  coverPhotoPath: string | null;
};

export type ReportPhoto = { id: string; path: string };

export type ReportDetail = {
  id: string;
  kind: ReportKind;
  status: ReportStatus;
  speciesId: number;
  petName: string | null;
  description: string;
  color: string | null;
  size: PetSize | null;
  lastSeenAt: string;
  location: ApproximateLocation;
  sightingCount: number;
  expiresAt: string;
  createdAt: string;
  /** Display name only: contact happens through in-app chat, never details. */
  authorName: string;
  photos: ReportPhoto[];
};

export type Sighting = {
  id: string;
  seenAt: string;
  note: string | null;
  photoPath: string | null;
  location: ApproximateLocation;
  authorName: string;
};

export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/** null means "no filter" for that dimension. */
export type ReportFilters = { kinds: ReportKind[] | null; speciesIds: number[] | null };

/** Reads every report screen needs. Rejects with the underlying error when a read fails. */
export type ReportRepository = {
  /** Active reports inside `bbox`, newest first, capped by the server. */
  listInBbox(bbox: Bbox, filters: ReportFilters): Promise<MapReport[]>;
  /** null when the report doesn't exist or isn't visible to the caller. */
  getReport(id: string): Promise<ReportDetail | null>;
  /** Visible sightings, newest first. */
  listSightings(reportId: string): Promise<Sighting[]>;
};
