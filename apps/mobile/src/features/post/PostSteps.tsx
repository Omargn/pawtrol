import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Coordinates } from "@/domain/location/locationService";
import { MAX_PHOTOS_PER_REPORT } from "@/domain/photos/photos";
import type { PetSize, ReportKind } from "@/domain/reports/report";
import type { Species } from "@/domain/species/species";
import { LocationPicker } from "@/features/post/LocationPicker";
import { timeAgo } from "@/features/reports/format";
import {
  COLOR_MAX,
  DESCRIPTION_MAX,
  LAST_SEEN_MAX_AGE_DAYS,
  PET_NAME_MAX,
  type Draft,
  type PostAction,
  type Step,
} from "@/hooks/postDraftMachine";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { KIND_LABEL } from "@/ui/KindBadge";
import { TextField } from "@/ui/TextField";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type Dispatch = (action: PostAction) => void;

export function KindStep({ draft, dispatch }: { draft: Draft; dispatch: Dispatch }) {
  const { colors } = useTheme();
  const options: { kind: ReportKind; title: string; body: string }[] = [
    { kind: "lost", title: "I lost a pet", body: "Let neighbors know who to look out for." },
    { kind: "found", title: "I found a pet", body: "Help it get back home." },
  ];
  return (
    <View style={styles.stack}>
      {options.map((option) => {
        const selected = draft.kind === option.kind;
        return (
          <Pressable
            key={option.kind}
            onPress={() => dispatch({ type: "setKind", kind: option.kind })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected ? colors[option.kind] : colors.surface,
                borderColor: selected ? colors[option.kind] : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[typography.heading, { color: selected ? colors.onAccent : colors.text }]}>{option.title}</Text>
            <Text style={[typography.body, { color: selected ? colors.onAccent : colors.textSecondary }]}>{option.body}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SIZES: { value: PetSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function DetailsStep({ draft, dispatch, species }: { draft: Draft; dispatch: Dispatch; species: Species[] | undefined }) {
  const { colors, scheme } = useTheme();
  const update = (fields: Extract<PostAction, { type: "update" }>["fields"]) => dispatch({ type: "update", fields });
  const now = new Date();

  return (
    <View style={styles.stack}>
      <View style={styles.field}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Animal</Text>
        <View style={styles.wrap}>
          {species?.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              selected={draft.speciesId === entry.id}
              onPress={() => update({ speciesId: entry.id })}
            />
          ))}
        </View>
      </View>

      <TextField
        label={draft.kind === "found" ? "Name, if it has a tag (optional)" : "Name (optional)"}
        value={draft.petName}
        onChangeText={(petName) => update({ petName })}
        maxLength={PET_NAME_MAX}
        returnKeyType="next"
      />
      <TextField
        label="Description"
        placeholder={
          draft.kind === "found"
            ? "Where you found it, how it's doing, anything that helps the owner recognize it."
            : "Breed, markings, collar, temperament. Anything that helps someone recognize it."
        }
        value={draft.description}
        onChangeText={(description) => update({ description })}
        multiline
        maxLength={DESCRIPTION_MAX}
        hint={`${draft.description.length}/${DESCRIPTION_MAX}`}
      />
      <TextField
        label="Color (optional)"
        value={draft.color}
        onChangeText={(color) => update({ color })}
        maxLength={COLOR_MAX}
      />

      <View style={styles.field}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Size (optional)</Text>
        <View style={styles.wrap}>
          {SIZES.map((size) => (
            <Chip
              key={size.value}
              label={size.label}
              selected={draft.size === size.value}
              onPress={() => update({ size: draft.size === size.value ? null : size.value })}
            />
          ))}
        </View>
      </View>

      <View style={[styles.row, styles.field]}>
        <Text style={[typography.body, styles.grow, { color: colors.text }]}>
          {draft.kind === "found" ? "Found" : "Last seen"}
        </Text>
        <DateTimePicker
          value={draft.lastSeenAt}
          mode="datetime"
          display="compact"
          maximumDate={now}
          minimumDate={new Date(now.getTime() - LAST_SEEN_MAX_AGE_DAYS * 86_400_000)}
          accentColor={colors.accent}
          themeVariant={scheme}
          onValueChange={(_, date) => update({ lastSeenAt: date })}
        />
      </View>
    </View>
  );
}

export function LocationStep({
  draft,
  dispatch,
  fallback,
}: {
  draft: Draft;
  dispatch: Dispatch;
  fallback: Coordinates;
}) {
  const { colors } = useTheme();
  const initial = draft.location ?? fallback;

  // The map opens on a sensible point; treat it as chosen until the user moves it.
  useEffect(() => {
    if (!draft.location) dispatch({ type: "setLocation", location: fallback });
  }, [draft.location, dispatch, fallback]);

  return (
    <View style={styles.stack}>
      <LocationPicker
        initial={initial}
        onChange={(location) => dispatch({ type: "setLocation", location })}
        color={draft.kind ? colors[draft.kind] : colors.accent}
      />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        Others only see an area of about 100 m around this point, never the exact spot.
      </Text>
    </View>
  );
}

export function PhotosStep({
  draft,
  dispatch,
  pickPhotos,
  takePhoto,
  remaining,
}: {
  draft: Draft;
  dispatch: Dispatch;
  pickPhotos: () => Promise<string | null>;
  takePhoto: () => Promise<string | null>;
  remaining: number;
}) {
  const { colors } = useTheme();
  const show = async (action: () => Promise<string | null>) => {
    const message = await action();
    if (message) Alert.alert("Photos", message);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.wrap}>
        {draft.photos.map((photo, index) => (
          <View key={photo.localUri} style={styles.thumbFrame}>
            <Image source={{ uri: photo.localUri }} style={styles.thumb} contentFit="cover" accessibilityLabel={`Photo ${index + 1}`} />
            <Pressable
              onPress={() => dispatch({ type: "removePhoto", localUri: photo.localUri })}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={8}
              style={[styles.remove, { backgroundColor: colors.text }]}
            >
              <Ionicons name="close" size={14} color={colors.background} />
            </Pressable>
          </View>
        ))}
      </View>
      {remaining > 0 ? (
        <View style={styles.row}>
          <View style={styles.grow}>
            <Button label="Take photo" variant="secondary" onPress={() => show(takePhoto)} />
          </View>
          <View style={styles.grow}>
            <Button label="Choose" variant="secondary" onPress={() => show(pickPhotos)} />
          </View>
        </View>
      ) : null}
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        Up to {MAX_PHOTOS_PER_REPORT} photos. They&apos;re re-encoded on your phone before uploading, so they don&apos;t
        reveal where they were taken.
      </Text>
    </View>
  );
}

export function ReviewStep({
  draft,
  dispatch,
  species,
}: {
  draft: Draft;
  dispatch: Dispatch;
  species: Species[] | undefined;
}) {
  const { colors } = useTheme();
  const speciesName = species?.find((entry) => entry.id === draft.speciesId)?.label ?? "—";
  const rows: { label: string; value: string; step: Step }[] = [
    { label: "Report", value: draft.kind ? KIND_LABEL[draft.kind] : "—", step: "kind" },
    { label: "Animal", value: [speciesName, draft.petName.trim()].filter(Boolean).join(" · "), step: "details" },
    { label: "Description", value: draft.description.trim(), step: "details" },
    {
      label: draft.kind === "found" ? "Found" : "Last seen",
      value: `${draft.lastSeenAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${timeAgo(draft.lastSeenAt.toISOString())})`,
      step: "details",
    },
    { label: "Where", value: "Set on the map (shown within ~100 m)", step: "location" },
    { label: "Photos", value: draft.photos.length === 0 ? "None" : `${draft.photos.length}`, step: "photos" },
  ];
  return (
    <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map((row) => (
        <Pressable
          key={row.label}
          onPress={() => dispatch({ type: "goTo", step: row.step })}
          accessibilityRole="button"
          accessibilityHint={`Edit ${row.label.toLowerCase()}`}
          style={styles.summaryRow}
        >
          <View style={styles.grow}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{row.label}</Text>
            <Text style={[typography.body, { color: colors.text }]} numberOfLines={3}>
              {row.value}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.accent }]}>Edit</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  field: { gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  option: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  thumbFrame: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: radii.md },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
});
