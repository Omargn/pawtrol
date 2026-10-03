import { ScrollView, StyleSheet } from "react-native";
import type { ReportKind } from "@/domain/reports/report";
import type { Species } from "@/domain/species/species";
import { Chip } from "@/ui/Chip";
import { KIND_LABEL } from "@/ui/KindBadge";
import { spacing } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

export type KindFilter = ReportKind | "all";

type FilterBarProps = {
  kind: KindFilter;
  onKindChange: (kind: KindFilter) => void;
  speciesId: number | null;
  onSpeciesChange: (speciesId: number | null) => void;
  species: Species[] | undefined;
};

/** One row: who (all / lost / found), then which animal. Tapping the active species clears it. */
export function FilterBar({ kind, onKindChange, speciesId, onSpeciesChange, species }: FilterBarProps) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <Chip label="All" selected={kind === "all"} onPress={() => onKindChange("all")} />
      {(["lost", "found"] as const).map((value) => (
        <Chip
          key={value}
          label={KIND_LABEL[value]}
          selected={kind === value}
          selectedColor={colors[value]}
          onPress={() => onKindChange(value)}
        />
      ))}
      {species?.map((entry) => (
        <Chip
          key={entry.id}
          label={entry.label}
          selected={speciesId === entry.id}
          onPress={() => onSpeciesChange(speciesId === entry.id ? null : entry.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
});
