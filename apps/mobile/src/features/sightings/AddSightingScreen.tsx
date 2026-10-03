import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { isRetryable } from "@/domain/errors/writeError";
import { SEEN_MAX_AGE_DAYS, type ReportDetail } from "@/domain/reports/report";
import { LocationPicker } from "@/features/post/LocationPicker";
import { useAddSighting } from "@/hooks/useAddSighting";
import { useReport } from "@/hooks/useReports";
import { useSession } from "@/hooks/useSession";
import { useUserLocation } from "@/hooks/useUserLocation";
import { SIGHTING_NOTE_MAX, sightingIssues } from "@/hooks/sightingDraftMachine";
import { Button } from "@/ui/Button";
import { LocalPhotoThumb } from "@/ui/LocalPhotoThumb";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { TextField } from "@/ui/TextField";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export function AddSightingScreen({ reportId }: { reportId: string }) {
  const { session, loading } = useSession();
  const report = useReport(reportId);

  if (loading || report.isPending) return <ScreenLoading />;
  if (!session) {
    return (
      <ScreenMessage
        title="Sign in to add a sighting"
        body="So the owner can reach you through in-app chat. Your email is never shown."
        action={{ label: "Sign in", onPress: () => router.push("/sign-in") }}
      />
    );
  }
  if (report.isError) {
    return <ScreenMessage title="Couldn't load this report" body="Check your connection and try again." action={{ label: "Retry", onPress: () => report.refetch() }} />;
  }
  if (report.data?.status !== "active") {
    return <ScreenMessage title="This report is closed" body="Sightings can only be added while a report is active." />;
  }
  return <SightingFlow report={report.data} userId={session.user.id} />;
}

function SightingFlow({ report, userId }: { report: ReportDetail; userId: string }) {
  const { colors, scheme } = useTheme();
  const userLocation = useUserLocation();
  const { state, dispatch, submit, pickPhoto, takePhoto } = useAddSighting(report.id);
  const { step, draft, submission } = state;
  const issues = sightingIssues(draft, step);
  const submitting = submission.status === "submitting";
  const now = new Date();

  // The map opens on the user, or failing that on the report's area; treat it as chosen until moved.
  const initial = draft.location ?? userLocation.coords ?? report.location;
  useEffect(() => {
    if (!draft.location) dispatch({ type: "update", fields: { location: initial } });
  }, [draft.location, dispatch, initial]);

  useEffect(() => {
    if (submission.status === "done") router.back();
  }, [submission]);

  const showMessage = async (action: () => Promise<string | null>) => {
    const message = await action();
    if (message) Alert.alert("Photo", message);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      // The map takes over vertical drags.
      scrollEnabled={step !== "location"}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {step === "location" ? "Where did you see it?" : "When, and anything else?"}
      </Text>

      {step === "location" ? (
        <View style={styles.stack}>
          <LocationPicker
            initial={initial}
            onChange={(location) => dispatch({ type: "update", fields: { location } })}
            color={colors[report.kind]}
          />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Others only see an area of about 100 m around this point, never the exact spot.
          </Text>
        </View>
      ) : (
        <View style={styles.stack}>
          <View style={styles.row}>
            <Text style={[typography.body, styles.grow, { color: colors.text }]}>Seen</Text>
            <DateTimePicker
              value={draft.seenAt}
              mode="datetime"
              display="compact"
              maximumDate={now}
              minimumDate={new Date(now.getTime() - SEEN_MAX_AGE_DAYS * 86_400_000)}
              accentColor={colors.accent}
              themeVariant={scheme}
              onValueChange={(_, date) => dispatch({ type: "update", fields: { seenAt: date } })}
            />
          </View>
          <TextField
            label="Note (optional)"
            placeholder="Which way it went, how it looked, whether it let you get close."
            value={draft.note}
            onChangeText={(note) => dispatch({ type: "update", fields: { note } })}
            multiline
            maxLength={SIGHTING_NOTE_MAX}
            hint={`${draft.note.length}/${SIGHTING_NOTE_MAX}`}
          />
          {draft.photo ? (
            <LocalPhotoThumb
              uri={draft.photo.localUri}
              label="Photo"
              onRemove={submitting ? undefined : () => dispatch({ type: "removePhoto" })}
              size={120}
            />
          ) : (
            <View style={styles.row}>
              <View style={styles.grow}>
                <Button label="Take photo" variant="secondary" onPress={() => showMessage(takePhoto)} />
              </View>
              <View style={styles.grow}>
                <Button label="Choose photo" variant="secondary" onPress={() => showMessage(pickPhoto)} />
              </View>
            </View>
          )}
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            A photo is optional. It&apos;s re-encoded on your phone first, so it doesn&apos;t reveal where it was taken.
          </Text>
        </View>
      )}

      {submission.status === "failed" ? (
        <Text selectable style={[typography.body, styles.error, { color: colors.danger, borderColor: colors.danger }]}>
          {submission.error.message}
        </Text>
      ) : null}

      <View style={styles.stack}>
        {issues.length > 0 ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{issues[0]}</Text>
        ) : null}
        {step === "location" ? (
          <Button label="Continue" onPress={() => dispatch({ type: "next" })} disabled={issues.length > 0} />
        ) : (
          <>
            <Button
              label={
                submission.status === "failed" && isRetryable(submission.error)
                  ? "Try again"
                  : submitting && draft.photo && !draft.photo.uploadedPath
                    ? "Uploading photo…"
                    : "Add sighting"
              }
              onPress={() => submit(userId)}
              busy={submitting}
              disabled={issues.length > 0}
            />
            {!submitting ? <Button label="Back" variant="secondary" onPress={() => dispatch({ type: "back" })} /> : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 80 },
  stack: { gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  error: { padding: spacing.md, borderWidth: 1, borderRadius: radii.md },
});
