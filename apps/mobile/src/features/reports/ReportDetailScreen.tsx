import { router, Stack } from "expo-router";
import { FlatList, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ReportDetail, Sighting } from "@/domain/reports/report";
import { ApproximateAreaMap, APPROXIMATE_RADIUS_M } from "@/features/reports/ApproximateAreaMap";
import { reportTitle, speciesLabel, timeAgo } from "@/features/reports/format";
import { useReport, useSightings } from "@/hooks/useReports";
import { useSession } from "@/hooks/useSession";
import { useSignedUrls } from "@/hooks/useSignedUrls";
import { useSpecies } from "@/hooks/useSpecies";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { KindBadge } from "@/ui/KindBadge";
import { Photo } from "@/ui/Photo";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

const STATUS_NOTE: Partial<Record<ReportDetail["status"], string>> = {
  reunited: "Good news: this pet is back home.",
  expired: "This report expired and no longer shows on the map.",
  hidden: "This report is hidden while moderators review it.",
  removed: "This report was removed by moderators.",
};

export function ReportDetailScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const report = useReport(id);
  const species = useSpecies();
  const { session } = useSession();

  if (report.isPending) return <ScreenLoading />;
  if (report.isError) {
    return <ScreenMessage title="Couldn't load this report" body="Check your connection and try again." action={{ label: "Retry", onPress: () => report.refetch() }} />;
  }
  if (!report.data) {
    return <ScreenMessage title="Report not available" body="It may have been closed or removed." />;
  }

  const detail = report.data;
  const title = reportTitle(detail, species.data);

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable onPress={() => shareReport(detail, title)} accessibilityRole="button" accessibilityLabel="Share" hitSlop={8}>
              <Icon name={{ ios: "square.and.arrow.up", android: "share" }} color={colors.accent} size={20} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <Gallery detail={detail} title={title} />

        <View style={styles.section}>
          <KindBadge kind={detail.kind} />
          <Text selectable style={[typography.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>
            {[speciesLabel(detail.speciesId, species.data), detail.color, detail.size].filter(Boolean).join(" · ")}
          </Text>
          {STATUS_NOTE[detail.status] ? (
            <Text style={[typography.body, styles.note, { backgroundColor: colors.surfaceMuted, color: colors.text }]}>
              {STATUS_NOTE[detail.status]}
            </Text>
          ) : null}
          {detail.status === "active" && session?.user.id !== detail.authorId ? (
            <Button
              label={detail.kind === "lost" ? "I saw this pet" : "I've seen this pet before"}
              onPress={() =>
                session
                  ? router.push({ pathname: "/sighting/[reportId]", params: { reportId: detail.id } })
                  : router.push("/sign-in")
              }
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {detail.description}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {detail.kind === "lost" ? "Last seen" : "Found"} {timeAgo(detail.lastSeenAt)} · posted by {detail.authorName}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[typography.heading, { color: colors.text }]}>Where</Text>
          <ApproximateAreaMap location={detail.location} color={colors[detail.kind]} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Shown within about {APPROXIMATE_RADIUS_M} m to protect the poster&apos;s privacy.
          </Text>
        </View>

        <SightingsSection reportId={detail.id} />
      </ScrollView>
    </>
  );
}

function Gallery({ detail, title }: { detail: ReportDetail; title: string }) {
  const { width } = useWindowDimensions();
  const urls = useSignedUrls(detail.photos.map((photo) => photo.path));
  const photoWidth = width - spacing.lg * 2;

  if (detail.photos.length === 0) {
    return <Photo path={null} url={undefined} style={[styles.photo, { width: photoWidth }]} accessibilityLabel="No photo" />;
  }
  return (
    <FlatList
      horizontal
      data={detail.photos}
      keyExtractor={(photo) => photo.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={photoWidth + spacing.sm}
      decelerationRate="fast"
      contentContainerStyle={{ gap: spacing.sm }}
      renderItem={({ item, index }) => (
        <Photo
          path={item.path}
          url={urls.data?.[item.path]}
          style={[styles.photo, { width: photoWidth }]}
          accessibilityLabel={`Photo ${index + 1} of ${detail.photos.length} of ${title}`}
        />
      )}
    />
  );
}

function SightingsSection({ reportId }: { reportId: string }) {
  const { colors } = useTheme();
  const sightings = useSightings(reportId);
  // One signing request for the whole timeline, not one per row.
  const urls = useSignedUrls(sightings.data?.flatMap((sighting) => sighting.photoPath ?? []) ?? []);

  return (
    <View style={styles.section}>
      <Text style={[typography.heading, { color: colors.text }]}>Sightings</Text>
      {sightings.isPending ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>Loading…</Text>
      ) : sightings.isError ? (
        <Pressable onPress={() => sightings.refetch()} accessibilityRole="button">
          <Text style={[typography.body, { color: colors.accent }]}>Couldn&apos;t load sightings. Tap to retry.</Text>
        </Pressable>
      ) : sightings.data.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>No sightings yet.</Text>
      ) : (
        sightings.data.map((sighting) => (
          <SightingRow key={sighting.id} sighting={sighting} photoUrl={sighting.photoPath ? urls.data?.[sighting.photoPath] : undefined} />
        ))
      )}
    </View>
  );
}

function SightingRow({ sighting, photoUrl }: { sighting: Sighting; photoUrl: string | undefined }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sighting, { borderColor: colors.border }]}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {timeAgo(sighting.seenAt)} · {sighting.authorName}
      </Text>
      {sighting.note ? (
        <Text selectable style={[typography.body, { color: colors.text }]}>
          {sighting.note}
        </Text>
      ) : null}
      {sighting.photoPath ? (
        <Photo path={sighting.photoPath} url={photoUrl} style={styles.sightingPhoto} accessibilityLabel="Sighting photo" />
      ) : null}
    </View>
  );
}

function shareReport(detail: ReportDetail, title: string) {
  const what = detail.kind === "lost" ? "Help find" : "Found pet:";
  Share.share({ message: `${what} ${title} on Pawtrol: pawtrol://report/${detail.id}` });
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  photo: { height: 260, borderRadius: radii.lg },
  note: { padding: spacing.md, borderRadius: radii.md, overflow: "hidden" },
  sighting: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  sightingPhoto: { width: 160, height: 120, borderRadius: radii.md },
});
