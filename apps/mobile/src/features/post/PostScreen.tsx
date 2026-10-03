import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { isRetryable } from "@/domain/errors/writeError";
import type { Coordinates } from "@/domain/location/locationService";
import { DetailsStep, KindStep, LocationStep, PhotosStep, ReviewStep } from "@/features/post/PostSteps";
import { STEPS, stepIssues, type Step } from "@/hooks/postDraftMachine";
import { usePostReport } from "@/hooks/usePostReport";
import { useSession } from "@/hooks/useSession";
import { useSpecies } from "@/hooks/useSpecies";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Button } from "@/ui/Button";
import { ScreenLoading, ScreenMessage } from "@/ui/ScreenState";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

const TITLES: Record<Step, string> = {
  kind: "What happened?",
  details: "Describe the pet",
  location: "Where?",
  photos: "Photos",
  review: "Review and post",
};

/** Where the location step opens without a fix: same default as the map. */
const DEFAULT_POINT: Coordinates = { latitude: 19.4326, longitude: -99.1332 };

export function PostScreen() {
  const { session, loading } = useSession();
  if (loading) return <ScreenLoading />;
  if (!session) {
    return (
      <ScreenMessage
        title="Sign in to post"
        body="Posting needs an account so neighbors can reach you through in-app chat. Your email is never shown."
        action={{ label: "Sign in", onPress: () => router.push("/sign-in") }}
      />
    );
  }
  return <PostFlow userId={session.user.id} />;
}

function PostFlow({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const species = useSpecies();
  const location = useUserLocation();
  const { state, dispatch, submit, pickPhotos, takePhoto, reset, remainingPhotos } = usePostReport();
  const { step, draft, submission } = state;
  const index = STEPS.indexOf(step);
  const issues = stepIssues(draft, step);
  const fallback = useMemo(() => location.coords ?? DEFAULT_POINT, [location.coords]);

  // Once posted, show the report and leave a fresh draft behind for next time.
  useEffect(() => {
    if (submission.status === "done") {
      router.push({ pathname: "/report/[id]", params: { id: submission.reportId } });
      reset();
    }
  }, [submission, reset]);

  const submitting = submission.status === "submitting";
  const submitLabel = !submitting
    ? "Post report"
    : submission.uploaded < submission.total
      ? `Uploading photo ${submission.uploaded + 1} of ${submission.total}…`
      : "Posting…";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      // The location step's map takes over vertical drags.
      scrollEnabled={step !== "location"}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Step {index + 1} of {STEPS.length}
        </Text>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.progress, { width: `${((index + 1) / STEPS.length) * 100}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {TITLES[step]}
        </Text>
      </View>

      {step === "kind" ? <KindStep draft={draft} dispatch={dispatch} /> : null}
      {step === "details" ? <DetailsStep draft={draft} dispatch={dispatch} species={species.data} /> : null}
      {step === "location" ? <LocationStep draft={draft} dispatch={dispatch} fallback={fallback} /> : null}
      {step === "photos" ? (
        <PhotosStep draft={draft} dispatch={dispatch} pickPhotos={pickPhotos} takePhoto={takePhoto} remaining={remainingPhotos} />
      ) : null}
      {step === "review" ? <ReviewStep draft={draft} dispatch={dispatch} species={species.data} /> : null}

      {submission.status === "failed" ? (
        <Text selectable style={[typography.body, styles.error, { color: colors.danger, borderColor: colors.danger }]}>
          {submission.error.message}
          {isRetryable(submission.error) ? " Your photos that already uploaded won't be sent again." : ""}
        </Text>
      ) : null}

      <View style={styles.footer}>
        {step === "review" ? (
          <Button
            label={submission.status === "failed" && isRetryable(submission.error) ? "Try again" : submitLabel}
            onPress={() => submit(userId)}
            busy={submitting}
            disabled={issues.length > 0}
          />
        ) : (
          <>
            {issues.length > 0 && step !== "kind" ? (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{issues[0]}</Text>
            ) : null}
            <Button label="Continue" onPress={() => dispatch({ type: "next" })} disabled={issues.length > 0} />
          </>
        )}
        {index > 0 && !submitting ? (
          <Button label="Back" variant="secondary" onPress={() => dispatch({ type: "back" })} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },
  header: { gap: spacing.sm },
  track: { height: 4, borderRadius: radii.pill, overflow: "hidden" },
  progress: { height: 4, borderRadius: radii.pill },
  error: { padding: spacing.md, borderWidth: 1, borderRadius: radii.md },
  footer: { gap: spacing.md },
});
