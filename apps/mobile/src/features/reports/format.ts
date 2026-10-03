import type { MapReport, MyReport } from "@/domain/reports/report";
import type { Species } from "@/domain/species/species";
import { KIND_LABEL } from "@/ui/KindBadge";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "12 min ago", "5 h ago", "3 days ago", then a date. Plain English until i18n lands. */
export function timeAgo(iso: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  const days = Math.floor(elapsed / DAY);
  if (days < 14) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function speciesLabel(speciesId: number, species: Species[] | undefined) {
  return species?.find((entry) => entry.id === speciesId)?.label ?? "Pet";
}

/** "Toby" for a named pet; "Found dog" when the finder doesn't know the name; "Found pet" for "Other". */
export function reportTitle(report: Pick<MapReport, "petName" | "kind" | "speciesId">, species: Species[] | undefined) {
  if (report.petName) return report.petName;
  const entry = species?.find((candidate) => candidate.id === report.speciesId);
  const noun = !entry || entry.slug === "other" ? "pet" : entry.label.toLowerCase();
  return `${KIND_LABEL[report.kind]} ${noun}`;
}

/** Where one of your own reports stands, in a few words. */
export function myReportStatus(report: Pick<MyReport, "status" | "expiresAt">, now = Date.now()): string {
  switch (report.status) {
    case "active": {
      const days = Math.ceil((Date.parse(report.expiresAt) - now) / DAY);
      if (days <= 0) return "Expiring now";
      return `On the map · expires ${days === 1 ? "tomorrow" : `in ${days} days`}`;
    }
    case "reunited":
      return "Reunited";
    case "expired":
      return "Expired · renew it to show it again";
    case "hidden":
      return "Hidden while moderators review it";
    case "removed":
      return "Removed by moderators";
  }
}
