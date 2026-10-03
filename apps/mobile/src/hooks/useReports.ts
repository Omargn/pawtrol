import { reportRepository } from "@/composition/reportRepository";
import { createReportHooks } from "@/hooks/createReportHooks";

export const { useReportsInBbox, useReport, useSightings, useMyReports, useReportStatusActions } =
  createReportHooks(reportRepository);
