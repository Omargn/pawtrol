import { WriteError } from "@/domain/errors/writeError";
import type { MapReport, NewReport, NewSighting, ReportDetail, ReportRepository, Sighting } from "@/domain/reports/report";

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
    authorId: "user-ana",
    authorName: "Ana",
    photos: [],
    ...overrides,
  };
}

/**
 * A ReportRepository over plain arrays, filtering like the server does.
 * `calls` counts requests per method; `created` and `addedSightings` hold what
 * was written, keyed by clientId as the server's idempotency is. Status
 * changes apply to `details` in place, with the server's allowed transitions.
 */
export function createInMemoryReportRepository({
  reports = [] as MapReport[],
  details = [] as ReportDetail[],
  sightings = {} as Record<string, Sighting[]>,
  failWith,
}: { reports?: MapReport[]; details?: ReportDetail[]; sightings?: Record<string, Sighting[]>; failWith?: Error } = {}) {
  const calls = {
    listInBbox: 0,
    getReport: 0,
    listSightings: 0,
    createReport: 0,
    addSighting: 0,
    markReunited: 0,
    renewReport: 0,
  };
  const own = (reportId: string) => {
    const detail = details.find((candidate) => candidate.id === reportId);
    if (!detail) throw new WriteError("not_found");
    if (detail.status !== "active" && detail.status !== "expired") throw new WriteError("not_allowed");
    return detail;
  };
  const created = new Map<string, { id: string; report: NewReport }>();
  const addedSightings = new Map<string, { id: string; sighting: NewSighting }>();
  let failCreateWith = failWith;

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
    async createReport(report) {
      calls.createReport++;
      if (failCreateWith) throw failCreateWith;
      const existing = created.get(report.clientId);
      if (existing) return existing.id;
      const id = `created-${created.size + 1}`;
      created.set(report.clientId, { id, report });
      return id;
    },
    async addSighting(sighting) {
      calls.addSighting++;
      if (failCreateWith) throw failCreateWith;
      const existing = addedSightings.get(sighting.clientId);
      if (existing) return existing.id;
      const id = `sighting-${addedSightings.size + 1}`;
      addedSightings.set(sighting.clientId, { id, sighting });
      return id;
    },
    async listMine(userId) {
      if (failWith) throw failWith;
      return details
        .filter((detail) => detail.authorId === userId)
        .map((detail) => ({
          id: detail.id,
          kind: detail.kind,
          status: detail.status,
          speciesId: detail.speciesId,
          petName: detail.petName,
          location: detail.location,
          lastSeenAt: detail.lastSeenAt,
          sightingCount: detail.sightingCount,
          coverPhotoPath: detail.photos[0]?.path ?? null,
          expiresAt: detail.expiresAt,
        }));
    },
    async markReunited(reportId) {
      calls.markReunited++;
      if (details.find((detail) => detail.id === reportId)?.status === "reunited") return;
      own(reportId).status = "reunited";
    },
    async renewReport(reportId) {
      calls.renewReport++;
      const detail = own(reportId);
      detail.status = "active";
      detail.expiresAt = "2026-11-01T12:00:00.000Z";
      return detail.expiresAt;
    },
  };

  return {
    repository,
    calls,
    created,
    addedSightings,
    /** Makes the next createReport and addSighting calls fail (or succeed again with undefined). */
    failCreate(error: Error | undefined) {
      failCreateWith = error;
    },
  };
}
