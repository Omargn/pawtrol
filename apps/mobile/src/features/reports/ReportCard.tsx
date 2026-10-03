import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapReport } from "@/domain/reports/report";
import type { Species } from "@/domain/species/species";
import { reportTitle, speciesLabel, timeAgo } from "@/features/reports/format";
import { KindBadge } from "@/ui/KindBadge";
import { Photo } from "@/ui/Photo";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type ReportCardProps = {
  report: MapReport;
  species: Species[] | undefined;
  photoUrl: string | undefined;
  onPress: () => void;
  /** An extra line, e.g. where one of your own reports stands. */
  note?: string;
};

/** One report at a glance: the map's preview and each row of the list. */
export function ReportCard({ report, species, photoUrl, onPress, note }: ReportCardProps) {
  const { colors } = useTheme();
  const title = reportTitle(report, species);
  const sightings =
    report.sightingCount === 0 ? null : `${report.sightingCount} sighting${report.sightingCount === 1 ? "" : "s"}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Opens the report"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Photo path={report.coverPhotoPath} url={photoUrl} style={styles.photo} accessibilityLabel={`Photo of ${title}`} />
      <View style={styles.body}>
        <KindBadge kind={report.kind} />
        <Text numberOfLines={1} style={[typography.heading, { color: colors.text }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: colors.textSecondary }]}>
          {[speciesLabel(report.speciesId, species), `seen ${timeAgo(report.lastSeenAt)}`, sightings]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {note ? (
          <Text numberOfLines={1} style={[typography.caption, { color: colors.text }]}>
            {note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.12)",
  },
  photo: { width: 76, height: 76, borderRadius: radii.md },
  body: { flex: 1, justifyContent: "center", gap: spacing.xs },
});
