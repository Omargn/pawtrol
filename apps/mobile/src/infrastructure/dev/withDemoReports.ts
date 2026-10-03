import { WriteError } from "@/domain/errors/writeError";
import type { MapReport, ReportDetail, ReportKind, ReportRepository } from "@/domain/reports/report";

/** Ids carry this prefix so a demo report can never collide with, or be mistaken for, a real one. */
export const DEMO_ID_PREFIX = "demo-";
const DEMO_COUNT = 60;
const CENTER = { latitude: 19.4326, longitude: -99.1332 };
const NAMES = ["Luna", "Max", "Kira", "Rocky", "Nala", "Toby", "Mia", "Simba", "Coco", "Bruno"];
const SPECIES = [1, 1, 1, 2, 2, 3, 4, 99];
const HOUR = 3_600_000;

// Same grid the server snaps public locations to.
const snap = (value: number) => Math.round(value * 1000) / 1000;

/** Deterministic, so every reload shows the same map. */
export function makeDemoReports(now: number): ReportDetail[] {
  return Array.from({ length: DEMO_COUNT }, (_, index) => {
    const n = index + 1;
    const kind: ReportKind = n % 3 === 0 ? "found" : "lost";
    const lastSeenAt = new Date(now - n * 7 * HOUR).toISOString();
    return {
      id: `${DEMO_ID_PREFIX}${n}`,
      kind,
      status: "active",
      speciesId: SPECIES[n % SPECIES.length],
      petName: kind === "found" ? null : NAMES[n % NAMES.length],
      description:
        kind === "found"
          ? "Found wandering near the market, friendly and well cared for."
          : "Slipped out of the gate in the evening. Very shy, please call out gently.",
      color: ["black", "white", "brown", "grey", "orange", "spotted"][n % 6],
      size: (["small", "medium", "large"] as const)[n % 3],
      lastSeenAt,
      location: {
        latitude: snap(CENTER.latitude + 0.05 * Math.cos(n * 1.731)),
        longitude: snap(CENTER.longitude + 0.055 * Math.sin(n * 2.399)),
      },
      sightingCount: n % 4,
      expiresAt: new Date(now + 30 * 24 * HOUR - n * 7 * HOUR).toISOString(),
      createdAt: lastSeenAt,
      authorId: `${DEMO_ID_PREFIX}neighbor`,
      authorName: "Demo neighbor",
      photos: [],
    };
  });
}

const toMapReport = (report: ReportDetail): MapReport => ({
  id: report.id,
  kind: report.kind,
  speciesId: report.speciesId,
  petName: report.petName,
  location: report.location,
  lastSeenAt: report.lastSeenAt,
  sightingCount: report.sightingCount,
  coverPhotoPath: null,
});

/**
 * Development only: adds deterministic demo reports around Mexico City to
 * whatever the real repository returns, so the map can be worked on before a
 * project has data. Wraps the contract rather than replacing the adapter, so
 * real reports, errors and latency still come through unchanged.
 */
export function withDemoReports(repository: ReportRepository, now = Date.now()): ReportRepository {
  const demo = makeDemoReports(now);

  return {
    async listInBbox(bbox, filters) {
      const real = await repository.listInBbox(bbox, filters);
      const extra = demo
        .filter(
          (report) =>
            report.location.longitude >= bbox.minLng &&
            report.location.longitude <= bbox.maxLng &&
            report.location.latitude >= bbox.minLat &&
            report.location.latitude <= bbox.maxLat &&
            (filters.kinds === null || filters.kinds.includes(report.kind)) &&
            (filters.speciesIds === null || filters.speciesIds.includes(report.speciesId)),
        )
        .map(toMapReport);
      return [...real, ...extra].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
    },

    async getReport(id) {
      if (id.startsWith(DEMO_ID_PREFIX)) return demo.find((report) => report.id === id) ?? null;
      return repository.getReport(id);
    },

    async listSightings(reportId) {
      if (reportId.startsWith(DEMO_ID_PREFIX)) return [];
      return repository.listSightings(reportId);
    },

    // Writes always go to the real backend; demo data is read-only.
    createReport: (report) => repository.createReport(report),

    listMine: (userId) => repository.listMine(userId),
    markReunited: (reportId) => repository.markReunited(reportId),
    renewReport: (reportId) => repository.renewReport(reportId),

    async addSighting(sighting) {
      if (sighting.reportId.startsWith(DEMO_ID_PREFIX)) throw new WriteError("not_found");
      return repository.addSighting(sighting);
    },
  };
}
