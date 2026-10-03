import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { myReportStatus } from "@/features/reports/format";
import { ReportCard } from "@/features/reports/ReportCard";
import { useMyReports } from "@/hooks/useReports";
import { useSignedUrls } from "@/hooks/useSignedUrls";
import { useSpecies } from "@/hooks/useSpecies";
import { spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

/** Your reports in every status, so expired and hidden ones can still be found and acted on. */
export function MyReports({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const reports = useMyReports(userId);
  const species = useSpecies();
  const urls = useSignedUrls(reports.data?.flatMap((report) => report.coverPhotoPath ?? []) ?? []);

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
        Your reports
      </Text>
      {reports.isPending ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>Loading…</Text>
      ) : reports.isError ? (
        <Pressable onPress={() => reports.refetch()} accessibilityRole="button">
          <Text style={[typography.body, { color: colors.accent }]}>Couldn&apos;t load your reports. Tap to retry.</Text>
        </Pressable>
      ) : reports.data.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          You haven&apos;t posted anything yet. Use Post when you lose or find a pet.
        </Text>
      ) : (
        reports.data.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            species={species.data}
            photoUrl={report.coverPhotoPath ? urls.data?.[report.coverPhotoPath] : undefined}
            note={myReportStatus(report)}
            onPress={() => router.push({ pathname: "/report/[id]", params: { id: report.id } })}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
});
