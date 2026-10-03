import type { MapReport, ReportDetail, ReportRepository, Sighting } from "@/domain/reports/report";

export function makeMapReport(overrides: Partial<MapReport> = {}): MapReport {
  return {
    id: "report-1",
    kind: "lost",
    speciesId: 1,
    petName: "Toby",
    location: { latitude: 19.433, longitude: -99.133 },
    lastSeenAt: "2026-10-01T10:00:00Z",
    sightingCount: 0,
    coverPhotoPath: null,
    ...overrides,
  };
}

export function makeReportDetail(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: "report-1",
    kind: "lost",
    status: "active",
    speciesId: 1,
    petName: "Toby",
    description: "Brown dog, red collar",
    color: "brown",
    size: "medium",
    lastSeenAt: "2026-10-01T10:00:00Z",
    location: { latitude: 19.433, longitude: -99.133 },
    sightingCount: 0,
    expiresAt: "2026-10-31T10:00:00Z",
    createdAt: "2026-10-01T11:00:00Z",
    authorName: "Ana",
    photos: [],
    ...overrides,
  };
}

/** A ReportRepository over plain arrays, filtering like the server does. `calls` counts requests per method. */
export function createInMemoryReportRepository({
  reports = [] as MapReport[],
  details = [] as ReportDetail[],
  sightings = {} as Record<string, Sighting[]>,
  failWith,
}: { reports?: MapReport[]; details?: ReportDetail[]; sightings?: Record<string, Sighting[]>; failWith?: Error } = {}) {
  const calls = { listInBbox: 0, getReport: 0, listSightings: 0 };

  const repository: ReportRepository = {
    async listInBbox(bbox, filters) {
      calls.listInBbox++;
      if (failWith) throw failWith;
      return reports.filter(
        (report) =>
          report.location.longitude >= bbox.minLng &&
          report.location.longitude <= bbox.maxLng &&
          report.location.latitude >= bbox.minLat &&
          report.location.latitude <= bbox.maxLat &&
          (filters.kinds === null || filters.kinds.includes(report.kind)) &&
          (filters.speciesIds === null || filters.speciesIds.includes(report.speciesId)),
      );
    },
    async getReport(id) {
      calls.getReport++;
      if (failWith) throw failWith;
      return details.find((detail) => detail.id === id) ?? null;
    },
    async listSightings(reportId) {
      calls.listSightings++;
      if (failWith) throw failWith;
      return sightings[reportId] ?? [];
    },
  };

  return { repository, calls };
}
