import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { snapBbox } from "@/domain/reports/bbox";
import type { Bbox, ReportFilters, ReportRepository } from "@/domain/reports/report";

/**
 * Query keys are part of the behavior: mutations in later phases invalidate
 * by these prefixes (`reports` after posting or a status change, `sightings`
 * after adding one).
 */
export const reportKeys = {
  all: ["reports"] as const,
  bbox: (bbox: Bbox, filters: ReportFilters) => ["reports", "bbox", bbox, filters] as const,
  detail: (id: string) => ["reports", "detail", id] as const,
  mine: (userId: string) => ["reports", "mine", userId] as const,
  sightings: (reportId: string) => ["sightings", reportId] as const,
};

export function createReportHooks(repository: ReportRepository) {
  /**
   * Reports in the visible area. The box is snapped outward to a grid before
   * it becomes the key and the request, so a small pan reuses the cached
   * answer; while a new area loads, the previous pins stay up instead of
   * flashing away.
   */
  function useReportsInBbox(bbox: Bbox | null, filters: ReportFilters) {
    const snapped = bbox ? snapBbox(bbox) : null;
    return useQuery({
      queryKey: snapped ? reportKeys.bbox(snapped, filters) : ["reports", "bbox", "none"],
      queryFn: () => repository.listInBbox(snapped!, filters),
      enabled: snapped !== null,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
    });
  }

  function useReport(id: string) {
    return useQuery({
      queryKey: reportKeys.detail(id),
      queryFn: () => repository.getReport(id),
      staleTime: 30_000,
    });
  }

  function useSightings(reportId: string) {
    return useQuery({
      queryKey: reportKeys.sightings(reportId),
      queryFn: () => repository.listSightings(reportId),
      staleTime: 30_000,
    });
  }

  /** The signed-in user's own reports, every status. */
  function useMyReports(userId: string | null) {
    return useQuery({
      queryKey: reportKeys.mine(userId ?? "none"),
      queryFn: () => repository.listMine(userId!),
      enabled: userId !== null,
      staleTime: 30_000,
    });
  }

  /**
   * The author closing or renewing their report. Either changes what the map,
   * the report's page and "my reports" show, so every report query refreshes.
   * Rejects with a WriteError.
   */
  function useReportStatusActions() {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: reportKeys.all });
    const markReunited = useMutation({ mutationFn: (id: string) => repository.markReunited(id), onSuccess: refresh });
    const renew = useMutation({ mutationFn: (id: string) => repository.renewReport(id), onSuccess: refresh });
    return { markReunited, renew };
  }

  return { useReportsInBbox, useReport, useSightings, useMyReports, useReportStatusActions };
}
