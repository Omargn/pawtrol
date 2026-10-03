import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { toWriteError } from "@/domain/errors/writeError";
import type {
  MapReport,
  PetSize,
  ReportDetail,
  ReportKind,
  ReportRepository,
  ReportStatus,
  Sighting,
} from "@/domain/reports/report";

/** More than a phone screen can show legibly even clustered; the server caps at 500. */
const MAP_ROW_LIMIT = 300;
const SIGHTING_LIMIT = 100;

// Named columns are required, not a style choice: the exact `location` column
// isn't granted, so `select=*` is refused.
const DETAIL_COLUMNS = `
  id, kind, status, species_id, pet_name, description, color, size, last_seen_at,
  public_lng, public_lat, sighting_count, expires_at, created_at,
  author:profiles!pet_reports_created_by_fkey ( display_name ),
  photos:report_photos ( id, storage_path, position )
`;

const SIGHTING_COLUMNS = `
  id, seen_at, note, photo_path, public_lng, public_lat,
  author:profiles!sightings_created_by_fkey ( display_name )
`;

// The generated types widen check-constrained columns to `string` and
// generated columns to nullable; these restore what the schema guarantees.
const asKind = (value: string) => value as ReportKind;
const location = (lng: number | null, lat: number | null) => ({ longitude: lng ?? 0, latitude: lat ?? 0 });

export function createSupabaseReportRepository(client: SupabaseClient<Database>): ReportRepository {
  return {
    async listInBbox(bbox, filters) {
      const { data, error } = await client.rpc("reports_in_bbox", {
        min_lng: bbox.minLng,
        min_lat: bbox.minLat,
        max_lng: bbox.maxLng,
        max_lat: bbox.maxLat,
        kinds: filters.kinds ?? undefined,
        species_ids: filters.speciesIds ?? undefined,
        max_rows: MAP_ROW_LIMIT,
      });
      if (error) throw error;
      return data.map(
        (row): MapReport => ({
          id: row.id,
          kind: asKind(row.kind),
          speciesId: row.species_id,
          petName: row.pet_name,
          location: location(row.lng, row.lat),
          lastSeenAt: row.last_seen_at,
          sightingCount: row.sighting_count,
          coverPhotoPath: row.cover_photo,
        }),
      );
    },

    async getReport(id) {
      const { data, error } = await client
        .from("pet_reports")
        .select(DETAIL_COLUMNS)
        .eq("id", id)
        .order("position", { referencedTable: "report_photos" })
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        kind: asKind(data.kind),
        status: data.status as ReportStatus,
        speciesId: data.species_id,
        petName: data.pet_name,
        description: data.description,
        color: data.color,
        size: data.size as PetSize | null,
        lastSeenAt: data.last_seen_at,
        location: location(data.public_lng, data.public_lat),
        sightingCount: data.sighting_count,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        authorName: data.author?.display_name ?? "",
        photos: data.photos.map((photo) => ({ id: photo.id, path: photo.storage_path })),
      } satisfies ReportDetail;
    },

    async listSightings(reportId) {
      // RLS also returns the caller's own hidden sightings; the timeline only shows visible ones.
      const { data, error } = await client
        .from("sightings")
        .select(SIGHTING_COLUMNS)
        .eq("report_id", reportId)
        .eq("status", "visible")
        .order("seen_at", { ascending: false })
        .limit(SIGHTING_LIMIT);
      if (error) throw error;
      return data.map(
        (row): Sighting => ({
          id: row.id,
          seenAt: row.seen_at,
          note: row.note,
          photoPath: row.photo_path,
          location: location(row.public_lng, row.public_lat),
          authorName: row.author?.display_name ?? "",
        }),
      );
    },

    async createReport(report) {
      const { data, error } = await client.rpc("create_report", {
        p_client_id: report.clientId,
        p_kind: report.kind,
        p_species_id: report.speciesId,
        p_description: report.description,
        p_last_seen_at: report.lastSeenAt,
        p_lng: report.location.longitude,
        p_lat: report.location.latitude,
        p_pet_name: report.petName ?? undefined,
        p_color: report.color ?? undefined,
        p_size: report.size ?? undefined,
        p_photo_paths: report.photoPaths,
      });
      if (error) throw toWriteError(error);
      return data;
    },
  };
}
