import type { ComponentProps, Ref } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type TextFieldProps = Omit<ComponentProps<typeof TextInput>, "ref"> & {
  ref?: Ref<TextInputInstance>;
  label: string;
  /** Shown under the field, e.g. a character count or a hint. */
  hint?: string;
};

export function TextField({ ref, label, hint, style, multiline, ...props }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        style={[
          typography.body,
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          style,
        ]}
        {...props}
      />
      {hint ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
});
