import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { toWriteError } from "@/domain/errors/writeError";
import type {
  MapReport,
  MyReport,
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
const MY_REPORTS_LIMIT = 100;

// Named columns are required, not a style choice: the exact `location` column
// isn't granted, so `select=*` is refused.
const DETAIL_COLUMNS = `
  id, kind, status, species_id, pet_name, description, color, size, last_seen_at,
  public_lng, public_lat, sighting_count, expires_at, created_at, created_by,
  author:profiles!pet_reports_created_by_fkey ( display_name ),
  photos:report_photos ( id, storage_path, position )
`;

const SIGHTING_COLUMNS = `
  id, seen_at, note, photo_path, public_lng, public_lat, created_by,
  author:profiles!sightings_created_by_fkey ( display_name )
`;

// The cover is the first photo, embedded and limited to one in the same request.
const MY_REPORT_COLUMNS = `
  id, kind, status, species_id, pet_name, public_lng, public_lat, last_seen_at, sighting_count, expires_at,
  photos:report_photos ( storage_path )
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
        authorId: data.created_by,
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
          authorId: row.created_by,
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

    async listMine(userId) {
      // RLS lets an author read every status of their own reports; the filter
      // keeps out everyone else's public ones.
      const { data, error } = await client
        .from("pet_reports")
        .select(MY_REPORT_COLUMNS)
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .order("position", { referencedTable: "report_photos" })
        .limit(1, { referencedTable: "report_photos" })
        .limit(MY_REPORTS_LIMIT);
      if (error) throw error;
      return data.map(
        (row): MyReport => ({
          id: row.id,
          kind: asKind(row.kind),
          status: row.status as ReportStatus,
          speciesId: row.species_id,
          petName: row.pet_name,
          location: location(row.public_lng, row.public_lat),
          lastSeenAt: row.last_seen_at,
          sightingCount: row.sighting_count,
          coverPhotoPath: row.photos[0]?.storage_path ?? null,
          expiresAt: row.expires_at,
        }),
      );
    },

    async markReunited(reportId) {
      const { error } = await client.rpc("mark_reunited", { p_report_id: reportId });
      if (error) throw toWriteError(error);
    },

    async renewReport(reportId) {
      const { data, error } = await client.rpc("renew_report", { p_report_id: reportId });
      if (error) throw toWriteError(error);
      return data;
    },

    async addSighting(sighting) {
      const { data, error } = await client.rpc("add_sighting", {
        p_client_id: sighting.clientId,
        p_report_id: sighting.reportId,
        p_seen_at: sighting.seenAt,
        p_lng: sighting.location.longitude,
        p_lat: sighting.location.latitude,
        p_note: sighting.note ?? undefined,
        p_photo_path: sighting.photoPath ?? undefined,
      });
      if (error) throw toWriteError(error);
      return data;
    },
  };
}
